import { XmlObject, PlaceholderDefaults, PlaceholderTextLevelStyle } from '../../types';
import { isHeaderFooterPlaceholder } from '../../utils/header-footer-placeholder';
import { placeholderStyleFamily } from '../../utils/placeholder-style-family';
import { xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSummaryZoomParsing';
import type { PlaceholderInfo, PlaceholderLookupContext } from './PptxHandlerRuntimeTypes';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected findPlaceholderInShapeTree(
		spTree: XmlObject | undefined,
		expected: PlaceholderInfo | null,
	): PlaceholderLookupContext | undefined {
		if (!spTree) {
			return undefined;
		}

		const shapes = this.ensureArray(spTree['p:sp']) as XmlObject[];
		for (const shape of shapes) {
			const info = this.extractPlaceholderInfo(xmlPath(shape, 'p:nvSpPr', 'p:nvPr'));
			if (!this.placeholderMatches(expected, info)) {
				continue;
			}
			return { shape };
		}

		const pictures = this.ensureArray(spTree['p:pic']) as XmlObject[];
		for (const picture of pictures) {
			const info = this.extractPlaceholderInfo(xmlPath(picture, 'p:nvPicPr', 'p:nvPr'));
			if (!this.placeholderMatches(expected, info)) {
				continue;
			}
			return { picture };
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
	): PlaceholderLookupContext | undefined {
		const type = expected?.type;
		if (!spTree || !isHeaderFooterPlaceholder(type)) {
			return undefined;
		}

		for (const shape of this.ensureArray(spTree['p:sp']) as XmlObject[]) {
			if (this.extractPlaceholderInfo(xmlPath(shape, 'p:nvSpPr', 'p:nvPr'))?.type === type) {
				return { shape };
			}
		}
		for (const picture of this.ensureArray(spTree['p:pic']) as XmlObject[]) {
			if (this.extractPlaceholderInfo(xmlPath(picture, 'p:nvPicPr', 'p:nvPr'))?.type === type) {
				return { picture };
			}
		}
		return undefined;
	}

	protected findPlaceholderContext(
		slidePath: string,
		expected: PlaceholderInfo | null,
	): PlaceholderLookupContext | undefined {
		const layoutPath = this.resolveLayoutPathForSlide(slidePath);
		if (!layoutPath) {
			return undefined;
		}

		const layoutXmlObj = this.layoutXmlMap.get(layoutPath);
		const layoutSpTree = xmlPath(layoutXmlObj, 'p:sldLayout', 'p:cSld', 'p:spTree');
		const layoutContext =
			this.findPlaceholderInShapeTree(layoutSpTree, expected) ??
			this.findSingletonPlaceholderInShapeTree(layoutSpTree, expected);

		const masterPath = this.resolveMasterPathForLayout(layoutPath);
		const masterSpTree = masterPath
			? xmlPath(this.masterXmlMap.get(masterPath), 'p:sldMaster', 'p:cSld', 'p:spTree')
			: undefined;
		const masterContext =
			this.findPlaceholderInShapeTree(masterSpTree, expected) ??
			this.findSingletonPlaceholderInShapeTree(masterSpTree, expected);

		if (!layoutContext) {
			return masterContext;
		}
		if (!masterContext) {
			return layoutContext;
		}

		// A layout placeholder can override only its text properties and inherit
		// its transform and style from the matching master placeholder. Return a
		// merged node so slide shapes resolve the complete inheritance chain.
		return {
			shape:
				layoutContext.shape || masterContext.shape
					? this.mergeXmlObjects(masterContext.shape, layoutContext.shape)
					: undefined,
			picture:
				layoutContext.picture || masterContext.picture
					? this.mergeXmlObjects(masterContext.picture, layoutContext.picture)
					: undefined,
		};
	}

	protected mergeXmlObjects(
		base: XmlObject | undefined,
		override: XmlObject | undefined,
		depth: number = 0,
	): XmlObject | undefined {
		// Load H1: cap recursion depth on attacker-controlled XML structures
		// to prevent stack-overflow DoS. 64 is well above any plausible
		// placeholder property nesting (typical depth < 10).
		const MAX_MERGE_DEPTH = 64;
		if (depth > MAX_MERGE_DEPTH) {
			// Beyond cap: shallow-merge override onto base without further
			// recursion, preserving as much data as possible while bounding
			// stack usage.
			if (!base && !override) {
				return undefined;
			}
			if (!base) {
				return override ? { ...override } : undefined;
			}
			if (!override) {
				return { ...base };
			}
			return { ...base, ...override };
		}

		if (!base && !override) {
			return undefined;
		}
		if (!base) {
			return override ? { ...override } : undefined;
		}
		if (!override) {
			return { ...base };
		}

		const merged: XmlObject = { ...base };
		for (const [key, value] of Object.entries(override)) {
			const existing = merged[key];
			if (
				value &&
				typeof value === 'object' &&
				!Array.isArray(value) &&
				existing &&
				typeof existing === 'object' &&
				!Array.isArray(existing)
			) {
				merged[key] = this.mergeXmlObjects(existing as XmlObject, value as XmlObject, depth + 1);
			} else if (
				value === '' &&
				existing !== undefined &&
				existing !== '' &&
				typeof existing === 'object'
			) {
				// An empty element in the override (e.g. a self-closing
				// `<p:spPr/>` on a layout placeholder, parsed as "") means
				// "no explicit value at this level" and must NOT clobber a
				// populated value inherited from the base (master). Keeping the
				// base preserves inherited geometry (`a:xfrm`) so the slide
				// placeholder still resolves a position instead of being dropped.
				merged[key] = existing;
			} else {
				merged[key] = value;
			}
		}
		return merged;
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
