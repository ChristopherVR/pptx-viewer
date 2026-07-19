import { XmlObject, ShapeStyle, StrokeDashType, ConnectorArrowType } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSlideParsing';

/**
 * Canonical default `clrMap` aliasing used when an active master does NOT
 * supply its own `<p:clrMap>` element. Mirrors the PowerPoint defaults
 * (`bg1 → lt1`, `tx1 → dk1`, etc.) — every other alias maps onto itself
 * and is left unrouted.
 */
const DEFAULT_CLR_MAP_ALIAS: Record<string, string> = {
	bg1: 'lt1',
	tx1: 'dk1',
	bg2: 'lt2',
	tx2: 'dk2',
};

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Forward declaration – implemented in PptxHandlerRuntimeThemeProcessing.
	 * Re-resolves gradient stops by substituting `phClr` with the given colour.
	 */
	protected reResolveGradientWithPhClr(
		_gradNode: XmlObject,
		_phClrValue: string,
	): {
		stops: NonNullable<ShapeStyle['fillGradientStops']>;
		css: string | undefined;
	} {
		throw new Error('reResolveGradientWithPhClr not yet initialised');
	}

	/**
	 * Forward declaration – implemented in PptxHandlerRuntimeThemeProcessing.
	 * Parses a layout-level colour map override.
	 */
	protected parseLayoutClrMapOverride(_layoutXml: XmlObject): Record<string, string> | null {
		throw new Error('parseLayoutClrMapOverride not yet initialised');
	}

	protected getDefaultSchemeColorMap(): Record<string, string> {
		return {
			dk1: '#000000',
			lt1: '#FFFFFF',
			dk2: '#1F497D',
			lt2: '#EEECE1',
			accent1: '#4472C4',
			accent2: '#ED7D31',
			accent3: '#A5A5A5',
			accent4: '#FFC000',
			accent5: '#5B9BD5',
			accent6: '#70AD47',
			hlink: '#0563C1',
			folHlink: '#954F72',
			tx1: '#000000',
			tx2: '#44546A',
			bg1: '#FFFFFF',
			bg2: '#E7E6E6',
		};
	}

	protected resolveThemeColor(schemeKey: string): string | undefined {
		const normalized = schemeKey.trim().toLowerCase();
		if (!normalized) {
			return undefined;
		}

		// Scheme-slot and clrMap-alias names are stored lowercase everywhere
		// EXCEPT `folHlink`, which keeps its camelCase form in `themeColorMap`,
		// `getDefaultSchemeColorMap()`, and the parsed `p:clrMap`. `normalized`
		// is lowercased, so a `<a:schemeClr val="folHlink"/>` reference (a common
		// choice for themed accent art, e.g. the "Balloons" purple balloons)
		// would miss every map and resolve to `undefined` -> a transparent /
		// dropped shape. Canonicalise a lowercased token back to the stored key
		// before every map read.
		const canon = (key: string): string => (key.toLowerCase() === 'folhlink' ? 'folHlink' : key);

		// `phClr` is a contextual placeholder — its actual value is supplied
		// by the surrounding `fillRef`/`lnRef`/`effectRef`/`fontRef`. When
		// `parseColorChoice` is given a `placeholderColor` it short-circuits
		// before ever reaching `resolveThemeColor`. The only remaining route
		// here is via `reResolveGradientWithPhClr`, which temporarily injects
		// `themeColorMap['phclr']`. Honour that injection if present, then
		// fall back to `accent1` so a stray `phClr` token without context
		// still yields a visible colour rather than an undefined render.
		if (normalized === 'phclr') {
			const injected = this.themeColorMap['phclr'];
			if (injected) {
				return injected;
			}
			return this.themeColorMap['accent1'] || this.getDefaultSchemeColorMap()['accent1'];
		}

		// Resolve through the active clrMap layer:
		//   1. Slide / layout `p:clrMapOvr` (highest precedence — when present
		//      slides bypass the master entirely for the listed aliases).
		//   2. The master's own `p:clrMap` (routing for aliases like
		//      `bg1 → lt1`, `tx1 → dk1`, etc.).
		//   3. Default alias→slot mapping (`bg1 → lt1`, `tx1 → dk1`, etc.)
		//      when no clrMap is present — this matches PowerPoint's
		//      implicit behaviour for decks that omit the routing layer.
		//   4. Direct theme scheme slot lookup.
		//
		// Per ECMA-376 §19.3.1.7 (CT_ColorMapping) clrMap is a routing
		// layer, not a colour table; resolve it lazily at lookup time so
		// multi-master decks and layout overrides work correctly.
		// Phase 2 Stream B / C-H4 / C-H5.
		const overrideMap = this.currentSlideClrMapOverride ?? this.currentMasterClrMap;
		if (overrideMap) {
			const remapped = overrideMap[canon(normalized)];
			if (remapped) {
				const target = canon(remapped);
				return this.themeColorMap[target] || this.getDefaultSchemeColorMap()[target];
			}
		} else {
			// No clrMap on the active master — apply the canonical default
			// alias mapping so `bg1`/`tx1`/`bg2`/`tx2` resolve to their
			// dk/lt counterparts on the live theme rather than freezing on
			// the static default colour table.
			const defaultAliasTarget = DEFAULT_CLR_MAP_ALIAS[normalized];
			if (defaultAliasTarget) {
				return (
					this.themeColorMap[defaultAliasTarget] ||
					this.themeColorMap[canon(normalized)] ||
					this.getDefaultSchemeColorMap()[canon(normalized)]
				);
			}
		}

		return (
			this.themeColorMap[canon(normalized)] || this.getDefaultSchemeColorMap()[canon(normalized)]
		);
	}

	protected normalizeStrokeDashType(value: unknown): StrokeDashType | undefined {
		const normalized = String(value ?? '').trim();
		if (normalized.length === 0) {
			return undefined;
		}

		const canonicalMap: Record<string, StrokeDashType> = {
			solid: 'solid',
			dot: 'dot',
			dash: 'dash',
			lgdash: 'lgDash',
			dashdot: 'dashDot',
			lgdashdot: 'lgDashDot',
			lgdashdotdot: 'lgDashDotDot',
			sysdot: 'sysDot',
			sysdash: 'sysDash',
			sysdashdot: 'sysDashDot',
			sysdashdotdot: 'sysDashDotDot',
			custom: 'custom',
		};

		return canonicalMap[normalized.toLowerCase()];
	}

	protected normalizeConnectorArrowType(value: unknown): ConnectorArrowType | undefined {
		const normalized = String(value ?? '')
			.trim()
			.toLowerCase();
		if (!normalized) {
			return undefined;
		}
		if (
			normalized === 'none' ||
			normalized === 'triangle' ||
			normalized === 'stealth' ||
			normalized === 'diamond' ||
			normalized === 'oval' ||
			normalized === 'arrow'
		) {
			return normalized;
		}
		return undefined;
	}

	protected extractBlurStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractBlurStyle(shapeProps);
	}

	protected extractEffectDagStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractEffectDagStyle(shapeProps);
	}

	protected extractReflectionStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractReflectionStyle(shapeProps);
	}

	protected extractSoftEdgeStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractSoftEdgeStyle(shapeProps);
	}

	protected extractGlowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractGlowStyle(shapeProps);
	}

	protected extractInnerShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractInnerShadowStyle(shapeProps);
	}

	protected extractShadowStyle(shapeProps: XmlObject): Partial<ShapeStyle> {
		return this.colorStyleCodec.extractShadowStyle(shapeProps);
	}

	protected extractGradientFillCss(gradFill: XmlObject): string | undefined {
		return this.colorStyleCodec.extractGradientFillCss(gradFill);
	}

	protected buildGradientCssFromStops(
		stops: NonNullable<ShapeStyle['fillGradientStops']>,
		type: NonNullable<ShapeStyle['fillGradientType']>,
		angle: number,
	): string | undefined {
		return this.colorStyleCodec.buildGradientCssFromStops(stops, type, angle);
	}

	protected extractGradientAngle(gradFill: XmlObject): number {
		return this.colorStyleCodec.extractGradientAngle(gradFill);
	}

	protected extractGradientType(gradFill: XmlObject): NonNullable<ShapeStyle['fillGradientType']> {
		return this.colorStyleCodec.extractGradientType(gradFill);
	}

	protected extractGradientStops(
		gradFill: XmlObject,
	): NonNullable<ShapeStyle['fillGradientStops']> {
		return this.colorStyleCodec.extractGradientStops(gradFill);
	}

	protected extractGradientOpacity(gradFill: XmlObject): number | undefined {
		return this.colorStyleCodec.extractGradientOpacity(gradFill);
	}

	protected parseColorChoice(
		colorChoice: XmlObject | undefined,
		placeholderColor?: string,
	): string | undefined {
		return this.colorStyleCodec.parseColorChoice(colorChoice, placeholderColor);
	}
}
