import { XmlObject, PlaceholderDefaults, PlaceholderTextLevelStyle } from '../../types';
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

	protected findPlaceholderContext(
		slidePath: string,
		expected: PlaceholderInfo | null,
	): PlaceholderLookupContext | undefined {
		const layoutPath = this.resolveLayoutPathForSlide(slidePath);
		if (!layoutPath) {
			return undefined;
		}

		const layoutXmlObj = this.layoutXmlMap.get(layoutPath);
		const layoutContext = this.findPlaceholderInShapeTree(
			xmlPath(layoutXmlObj, 'p:sldLayout', 'p:cSld', 'p:spTree'),
			expected,
		);

		const masterPath = this.resolveMasterPathForLayout(layoutPath);
		const masterContext = masterPath
			? this.findPlaceholderInShapeTree(
					xmlPath(this.masterXmlMap.get(masterPath), 'p:sldMaster', 'p:cSld', 'p:spTree'),
					expected,
				)
			: undefined;

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
	 * Build a cache-map key for a placeholder.  Prefers `idx` when present,
	 * otherwise falls back to `type`.
	 */
	protected buildPlaceholderDefaultsKey(phInfo: PlaceholderInfo): string {
		const normalizedType =
			phInfo.type === 'ctrtitle' ? 'title' : phInfo.type === 'subtitle' ? 'body' : phInfo.type;
		if (phInfo.idx !== undefined) {
			return normalizedType ? `${normalizedType}_${phInfo.idx}` : `_${phInfo.idx}`;
		}
		return normalizedType ?? 'body';
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
		const normalizedType = this.buildPlaceholderDefaultsKey(phInfo).split('_')[0];
		const masterTextStyleType =
			phInfo.type === 'title' || phInfo.type === 'ctrtitle'
				? 'title'
				: phInfo.type === 'body' || phInfo.type === 'obj' || phInfo.type === 'subtitle'
					? 'body'
					: 'other';
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
