import { XmlObject, PlaceholderDefaults, PlaceholderTextLevelStyle } from '../../types';
import { isHeaderFooterPlaceholder } from '../../utils/header-footer-placeholder';
import { placeholderStyleFamily } from '../../utils/placeholder-style-family';
import { xmlPath } from '../../utils/xml-access';
import { mergeXmlObjects } from './merge-xml-objects';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSummaryZoomParsing';
import type { PlaceholderInfo, PlaceholderLookupContext } from './PptxHandlerRuntimeTypes';

/**
 * {@link PlaceholderLookupContext} plus the graphic-frame slot. Kept local
 * until the base interface in `PptxHandlerRuntimeTypes` grows the field; it
 * is a structural superset, so every existing consumer keeps compiling.
 */
export interface PlaceholderNodeContext extends PlaceholderLookupContext {
	/** The inherited graphic frame XML object from the layout/master, if any. */
	graphicFrame?: XmlObject;
}

/**
 * The `p:spTree` buckets a placeholder can live in, with the non-visual
 * wrapper that holds its `p:nvPr/p:ph` and the context key it is reported
 * under. A layout or master placeholder is normally a `p:sp`, but a picture
 * placeholder is a `p:pic`, and a table/chart/SmartArt/OLE/media placeholder
 * is a `p:graphicFrame` (`p:nvGraphicFramePr/p:nvPr/p:ph`); the lookup used
 * to walk only the first two, so a frame placeholder never resolved its
 * layout/master counterpart.
 */
const PLACEHOLDER_BUCKETS: ReadonlyArray<{
	readonly bucket: string;
	readonly nvKey: string;
	readonly contextKey: keyof PlaceholderNodeContext;
}> = [
	{ bucket: 'p:sp', nvKey: 'p:nvSpPr', contextKey: 'shape' },
	{ bucket: 'p:pic', nvKey: 'p:nvPicPr', contextKey: 'picture' },
	{ bucket: 'p:graphicFrame', nvKey: 'p:nvGraphicFramePr', contextKey: 'graphicFrame' },
];

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected findPlaceholderInShapeTree(
		spTree: XmlObject | undefined,
		expected: PlaceholderInfo | null,
	): PlaceholderNodeContext | undefined {
		return this.scanPlaceholderBuckets(spTree, (info) => this.placeholderMatches(expected, info));
	}

	private scanPlaceholderBuckets(
		spTree: XmlObject | undefined,
		matches: (info: PlaceholderInfo | null) => boolean,
	): PlaceholderNodeContext | undefined {
		if (!spTree) {
			return undefined;
		}
		for (const { bucket, nvKey, contextKey } of PLACEHOLDER_BUCKETS) {
			for (const node of this.ensureArray(spTree[bucket]) as XmlObject[]) {
				if (matches(this.extractPlaceholderInfo(xmlPath(node, nvKey, 'p:nvPr')))) {
					return { [contextKey]: node };
				}
			}
		}
		return undefined;
	}

	/**
	 * Find the header / footer / date / slide-number placeholder in `spTree` by
	 * TYPE alone, ignoring `idx`.
	 *
	 * Those four are singletons per part, and PowerPoint does not keep their
	 * `@idx` aligned down the chain: it numbers them 10 / 11 / 12 on a layout and
	 * 2 / 3 / 4 on the master of the very decks it authors. Matching on idx
	 * therefore resolves nothing above the layout, which left every slide's
	 * `dt` / `sldNum` placeholder with no transform at all (parsed at 0x0 pixels,
	 * so invisible) and dropped the empty `ftr` shape outright.
	 *
	 * Used only as a FALLBACK, after {@link findPlaceholderInShapeTree} has
	 * failed, so an exact idx match still wins wherever a deck provides one.
	 */
	protected findSingletonPlaceholderInShapeTree(
		spTree: XmlObject | undefined,
		expected: PlaceholderInfo | null,
	): PlaceholderNodeContext | undefined {
		const type = expected?.type;
		if (!spTree || !isHeaderFooterPlaceholder(type)) {
			return undefined;
		}
		return this.scanPlaceholderBuckets(spTree, (info) => info?.type === type);
	}

	/** The layout and master counterparts of a placeholder, unmerged. */
	private findPlaceholderContexts(
		slidePath: string,
		expected: PlaceholderInfo | null,
	): { layout?: PlaceholderNodeContext; master?: PlaceholderNodeContext } {
		const layoutPath = this.resolveLayoutPathForSlide(slidePath);
		if (!layoutPath) {
			return {};
		}

		const layoutXmlObj = this.layoutXmlMap.get(layoutPath);
		const layoutSpTree = xmlPath(layoutXmlObj, 'p:sldLayout', 'p:cSld', 'p:spTree');
		const layout =
			this.findPlaceholderInShapeTree(layoutSpTree, expected) ??
			this.findSingletonPlaceholderInShapeTree(layoutSpTree, expected);

		const masterPath = this.resolveMasterPathForLayout(layoutPath);
		const masterSpTree = masterPath
			? xmlPath(this.masterXmlMap.get(masterPath), 'p:sldMaster', 'p:cSld', 'p:spTree')
			: undefined;
		const master =
			this.findPlaceholderInShapeTree(masterSpTree, expected) ??
			this.findSingletonPlaceholderInShapeTree(masterSpTree, expected);
		return { layout, master };
	}

	protected findPlaceholderContext(
		slidePath: string,
		expected: PlaceholderInfo | null,
	): PlaceholderNodeContext | undefined {
		const { layout: layoutContext, master: masterContext } = this.findPlaceholderContexts(
			slidePath,
			expected,
		);
		if (!layoutContext) {
			return masterContext;
		}
		if (!masterContext) {
			return layoutContext;
		}

		// A layout placeholder can override only its text properties and inherit
		// its transform and style from the matching master placeholder. Return a
		// merged node so slide shapes resolve the complete inheritance chain.
		const merged: PlaceholderNodeContext = {};
		for (const { contextKey } of PLACEHOLDER_BUCKETS) {
			const layoutNode = layoutContext[contextKey];
			const masterNode = masterContext[contextKey];
			merged[contextKey] =
				layoutNode || masterNode ? this.mergeXmlObjects(masterNode, layoutNode) : undefined;
		}
		return merged;
	}

	/**
	 * The single inherited node for a placeholder, whichever bucket the
	 * layout/master authored it in. This is what a parser that only needs "the
	 * counterpart's transform" consumes.
	 *
	 * The layout node is merged OVER the master node even when the two parts
	 * spell the slot in different buckets (a layout `p:graphicFrame` refining
	 * a master `p:sp`), so the layout keeps winning exactly as it does when
	 * both are shapes.
	 */
	protected findPlaceholderNode(
		slidePath: string,
		expected: PlaceholderInfo | null,
	): XmlObject | undefined {
		const { layout, master } = this.findPlaceholderContexts(slidePath, expected);
		const firstNode = (context: PlaceholderNodeContext | undefined): XmlObject | undefined =>
			context?.shape ?? context?.picture ?? context?.graphicFrame;
		const layoutNode = firstNode(layout);
		const masterNode = firstNode(master);
		if (!layoutNode || !masterNode) {
			return layoutNode ?? masterNode;
		}
		return this.mergeXmlObjects(masterNode, layoutNode);
	}

	protected mergeXmlObjects(
		base: XmlObject | undefined,
		override: XmlObject | undefined,
		depth: number = 0,
	): XmlObject | undefined {
		return mergeXmlObjects(base, override, depth);
	}

	protected readFlipState(xfrm: XmlObject | undefined): {
		flipHorizontal: boolean;
		flipVertical: boolean;
	} {
		if (!xfrm) {
			return {
				flipHorizontal: false,
				flipVertical: false,
			};
		}

		return {
			flipHorizontal: this.parseBooleanAttr(xfrm['@_flipH']),
			flipVertical: this.parseBooleanAttr(xfrm['@_flipV']),
		};
	}

	/**
	 * Build a cache-map key for a placeholder, combining the style family it
	 * inherits from with `idx` when the reference carries one.
	 *
	 * Keying on the family rather than the raw attribute is what lets a slide's
	 * `<p:ph idx="14"/>` find the layout's `type="obj" idx="14"` entry instead of
	 * falling through to the master and losing the layout's own values.
	 */
	protected buildPlaceholderDefaultsKey(phInfo: PlaceholderInfo): string {
		const family = placeholderStyleFamily(phInfo.type);
		return phInfo.idx !== undefined ? `${family}_${phInfo.idx}` : family;
	}

	/**
	 * Look up merged {@link PlaceholderDefaults} for a shape's placeholder
	 * reference. Checks the layout cache first, then the master cache, and
	 * merges them so that layout values take priority over master values.
	 */
	protected lookupPlaceholderDefaults(
		slidePath: string,
		phInfo: PlaceholderInfo,
	): PlaceholderDefaults | undefined {
		const layoutPath = this.resolveLayoutPathForSlide(slidePath);
		if (!layoutPath) {
			return undefined;
		}

		const phKey = this.buildPlaceholderDefaultsKey(phInfo);

		const layoutMap = this.layoutPlaceholderDefaultsCache.get(layoutPath);
		const layoutDefaults = layoutMap?.get(phKey);

		const masterPath = this.resolveMasterPathForLayout(layoutPath);
		const masterMap = masterPath ? this.masterPlaceholderDefaultsCache.get(masterPath) : undefined;
		const masterDefaults = masterMap?.get(phKey);
		const normalizedType = placeholderStyleFamily(phInfo.type);
		const masterTextStyleType =
			normalizedType === 'title' ? 'title' : normalizedType === 'body' ? 'body' : 'other';
		const masterTextStyles = masterPath ? this.masterTxStylesCache.get(masterPath) : undefined;
		const masterTextLevels =
			masterTextStyleType === 'title'
				? masterTextStyles?.titleStyle
				: masterTextStyleType === 'body'
					? masterTextStyles?.bodyStyle
					: masterTextStyles?.otherStyle;
		const resolvedMasterDefaults = masterTextLevels
			? {
					type: masterDefaults?.type ?? normalizedType,
					...masterDefaults,
					levelStyles: this.mergePlaceholderLevelStyles(
						masterTextLevels,
						masterDefaults?.levelStyles,
					),
				}
			: masterDefaults;

		if (!layoutDefaults && !resolvedMasterDefaults) {
			return undefined;
		}
		if (!resolvedMasterDefaults) {
			return layoutDefaults;
		}
		if (!layoutDefaults) {
			return resolvedMasterDefaults;
		}

		// Merge: layout wins over master
		const merged: PlaceholderDefaults = {
			type: layoutDefaults.type,
			idx: layoutDefaults.idx ?? resolvedMasterDefaults.idx,
			bodyInsetLeft: layoutDefaults.bodyInsetLeft ?? resolvedMasterDefaults.bodyInsetLeft,
			bodyInsetTop: layoutDefaults.bodyInsetTop ?? resolvedMasterDefaults.bodyInsetTop,
			bodyInsetRight: layoutDefaults.bodyInsetRight ?? resolvedMasterDefaults.bodyInsetRight,
			bodyInsetBottom: layoutDefaults.bodyInsetBottom ?? resolvedMasterDefaults.bodyInsetBottom,
			textAnchor: layoutDefaults.textAnchor ?? resolvedMasterDefaults.textAnchor,
			autoFit: layoutDefaults.autoFit ?? resolvedMasterDefaults.autoFit,
			textWrap: layoutDefaults.textWrap ?? resolvedMasterDefaults.textWrap,
			promptText: layoutDefaults.promptText ?? resolvedMasterDefaults.promptText,
		};

		// Merge level styles (layout levels override master levels, per-field)
		if (layoutDefaults.levelStyles || resolvedMasterDefaults.levelStyles) {
			merged.levelStyles = this.mergePlaceholderLevelStyles(
				resolvedMasterDefaults.levelStyles,
				layoutDefaults.levelStyles,
			);
		}

		return merged;
	}

	private mergePlaceholderLevelStyles(
		base: Record<number, PlaceholderTextLevelStyle> | undefined,
		override: Record<number, PlaceholderTextLevelStyle> | undefined,
	): Record<number, PlaceholderTextLevelStyle> {
		const merged: Record<number, PlaceholderTextLevelStyle> = {};
		for (const key of new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])) {
			const level = Number.parseInt(key, 10);
			merged[level] = { ...base?.[level], ...override?.[level] };
		}
		return merged;
	}
}
