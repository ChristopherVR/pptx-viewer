import { XmlObject } from '../../types';
import type { PptxImageEffects, MediaBookmark } from '../../types';
import { xmlAttr, xmlChild } from '../../utils/xml-access';
import { parseA14ImageExtension } from './image-a14-effects';
import { applyA14ExtensionToEffects } from './image-a14-effects-model';
import { parseImageAlphaEffects } from './image-alpha-effects';
import { parseImageColorEffects } from './image-color-effects';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeTableStylesAndActions';

/** Timing data extracted from the OOXML timing tree for a single media element. */
export interface MediaTimingData {
	trimStartMs?: number;
	trimEndMs?: number;
	fullScreen?: boolean;
	loop?: boolean;
	posterFramePath?: string;
	volume?: number;
	fadeInDuration?: number;
	fadeOutDuration?: number;
	autoPlay?: boolean;
	playAcrossSlides?: boolean;
	hideWhenNotPlaying?: boolean;
	bookmarks?: MediaBookmark[];
	/** Playback speed multiplier (1 = normal). From p14:media/@spd (percentage * 1000). */
	playbackSpeed?: number;
	/**
	 * Resolved media path from `p14:media/@r:embed`. Used as a fallback source
	 * when a media element is referenced only through the p14 extension and the
	 * primary `mediaPath` could not be resolved.
	 */
	mediaEmbedPath?: string;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Extract image recolour/brightness/contrast/artistic effects from blip extensions.
	 */
	protected extractImageEffects(blip: XmlObject | undefined): PptxImageEffects | null {
		if (!blip) {
			return null;
		}
		const effects: PptxImageEffects = {};
		let hasAny = false;

		// Brightness and contrast from a:blip @bright / @contrast (hundredths of %)
		const brightRaw = blip['@_bright'] ?? blip['@_brt'];
		if (brightRaw !== null) {
			const val = parseInt(String(brightRaw));
			if (Number.isFinite(val)) {
				effects.brightness = val / 1000;
				hasAny = true;
			}
		}
		const contrastRaw = blip['@_contrast'] ?? blip['@_cont'];
		if (contrastRaw !== null) {
			const val = parseInt(String(contrastRaw));
			if (Number.isFinite(val)) {
				effects.contrast = val / 1000;
				hasAny = true;
			}
		}

		const colorEffects = parseImageColorEffects(
			blip,
			(node) => this.parseColor(node),
			(node) => this.extractColorOpacity(node),
		);
		Object.assign(effects, colorEffects);
		if (Object.keys(colorEffects).length > 0) {
			hasAny = true;
		}

		const alphaEffects = parseImageAlphaEffects(blip, (node) => this.parseColor(node));
		Object.assign(effects, alphaEffects);
		if (Object.keys(alphaEffects).length > 0) {
			hasAny = true;
		}

		// a:lum: luminance modulation (@_bright, @_contrast in 1/1000ths of a percent)
		const lumNode = blip['a:lum'] as XmlObject | undefined;
		if (lumNode) {
			const lumEffect: NonNullable<PptxImageEffects['lum']> = {};
			const lumBright = lumNode['@_bright'];
			const lumContrast = lumNode['@_contrast'];
			if (lumBright !== undefined) {
				const v = parseInt(String(lumBright)) / 1000;
				if (Number.isFinite(v)) {
					lumEffect.bright = v;
				}
			}
			if (lumContrast !== undefined) {
				const v = parseInt(String(lumContrast)) / 1000;
				if (Number.isFinite(v)) {
					lumEffect.contrast = v;
				}
			}
			effects.lum = lumEffect;
			hasAny = true;
		}

		// a:hsl: HSL modulation (@_hue in 1/60000ths of a degree, @_sat/@_lum in 1/1000ths of a percent)
		const hslNode = blip['a:hsl'] as XmlObject | undefined;
		if (hslNode) {
			const hslEffect: NonNullable<PptxImageEffects['hsl']> = {};
			const hue = hslNode['@_hue'];
			const sat = hslNode['@_sat'];
			const lum = hslNode['@_lum'];
			if (hue !== undefined) {
				const v = parseInt(String(hue)) / 60000;
				if (Number.isFinite(v)) {
					hslEffect.hue = v;
				}
			}
			if (sat !== undefined) {
				const v = parseInt(String(sat)) / 1000;
				if (Number.isFinite(v)) {
					hslEffect.sat = v;
				}
			}
			if (lum !== undefined) {
				const v = parseInt(String(lum)) / 1000;
				if (Number.isFinite(v)) {
					hslEffect.lum = v;
				}
			}
			effects.hsl = hslEffect;
			hasAny = true;
		}

		// a:tint (image-effect tint inside blip): @_hue (1/60000ths degree), @_amt (1/1000ths %)
		const tintNode = blip['a:tint'] as XmlObject | undefined;
		if (tintNode) {
			const tintEffect: NonNullable<PptxImageEffects['tint']> = {};
			const hue = tintNode['@_hue'];
			const amt = tintNode['@_amt'];
			if (hue !== undefined) {
				const v = parseInt(String(hue)) / 60000;
				if (Number.isFinite(v)) {
					tintEffect.hue = v;
				}
			}
			if (amt !== undefined) {
				const v = parseInt(String(amt)) / 1000;
				if (Number.isFinite(v)) {
					tintEffect.amt = v;
				}
			}
			effects.tint = tintEffect;
			hasAny = true;
		}

		// a:fillOverlay: overlay fill (@_blend, child fill preserved opaquely)
		const fillOverlay = blip['a:fillOverlay'] as XmlObject | undefined;
		if (fillOverlay) {
			const blendRaw = String(fillOverlay['@_blend'] || 'over');
			const blend: NonNullable<PptxImageEffects['fillOverlay']>['blend'] = (
				['over', 'mult', 'screen', 'darken', 'lighten'] as const
			).includes(blendRaw as 'over' | 'mult' | 'screen' | 'darken' | 'lighten')
				? (blendRaw as 'over' | 'mult' | 'screen' | 'darken' | 'lighten')
				: 'over';
			// Preserve the entire fillOverlay node (minus the blend attribute) as raw XML.
			// fast-xml-parser returns child fill nodes as keys like a:solidFill, a:gradFill,
			// a:blipFill, a:pattFill, a:noFill: we just keep the whole object.
			const rawCopy: Record<string, unknown> = {};
			for (const key of Object.keys(fillOverlay)) {
				if (key === '@_blend') {
					continue;
				}
				rawCopy[key] = (fillOverlay as Record<string, unknown>)[key];
			}
			// Resolve a plain `a:solidFill` overlay to a hex colour + opacity so a
			// renderer can composite it (the common picture-style colour-overlay
			// case). A gradient/pattern overlay resolves to a structured paint
			// server instead (see `resolvedGradient` / `resolvedPattern`); a
			// picture overlay fill stays opaque in `fillRawXml` only - round-trip
			// is unaffected regardless of which of the three resolved.
			const solidFill = fillOverlay['a:solidFill'] as XmlObject | undefined;
			const resolvedColor = solidFill ? this.parseColor(solidFill) : undefined;
			const resolvedOpacity = solidFill ? (this.extractColorOpacity(solidFill) ?? 1) : undefined;

			const gradFill = fillOverlay['a:gradFill'] as XmlObject | undefined;
			const resolvedGradient = gradFill ? this.resolveFillOverlayGradient(gradFill) : undefined;

			const pattFill = fillOverlay['a:pattFill'] as XmlObject | undefined;
			const resolvedPattern = pattFill ? this.resolveFillOverlayPattern(pattFill) : undefined;

			effects.fillOverlay = {
				blend,
				fillRawXml: rawCopy,
				...(resolvedColor ? { resolvedColor, resolvedOpacity } : {}),
				...(resolvedGradient ? { resolvedGradient } : {}),
				...(resolvedPattern ? { resolvedPattern } : {}),
			};
			hasAny = true;
		}

		// a:blur: blur (@_rad in EMU, @_grow boolean)
		const blurNode = blip['a:blur'] as XmlObject | undefined;
		if (blurNode) {
			const blurEffect: NonNullable<PptxImageEffects['blur']> = {};
			const rad = blurNode['@_rad'];
			if (rad !== undefined) {
				const v = parseInt(String(rad));
				if (Number.isFinite(v)) {
					blurEffect.rad = v;
				}
			}
			const grow = blurNode['@_grow'];
			if (grow !== undefined) {
				const s = String(grow).toLowerCase();
				blurEffect.grow = s === '1' || s === 'true';
			}
			effects.blur = blurEffect;
			hasAny = true;
		}

		// Artistic effects / background removal from the a14 blip extension.
		// Everything the extension carries is edit-time metadata: PowerPoint bakes
		// the result into the bitmap the main a:blip points at, so the effects are
		// modelled but flagged as pre-rendered (see image-a14-effects.ts).
		const extLst = xmlChild(blip, 'a:extLst');
		if (extLst) {
			const a14 = parseA14ImageExtension(this.ensureArray(extLst['a:ext']));
			if (a14 && applyA14ExtensionToEffects(effects, a14)) {
				hasAny = true;
			}
		}

		return hasAny ? effects : null;
	}

	/**
	 * Resolve a blip `a:fillOverlay/a:gradFill` to the structured gradient a
	 * renderer composites as an SVG paint server.
	 *
	 * This mirrors the table-style `a:gradFill` parse (`parseGradientFill` in
	 * `table-style-fill-parse.ts`) rather than calling the shape-fill
	 * pipeline's `extractGradientStops`/`extractGradientType`/
	 * `extractGradientAngle`: those live in a runtime mixin composed AFTER
	 * (more derived than) this one in the `PptxHandlerRuntime` chain, so they
	 * are not reachable via `this` here. `parseColor` / `extractColorOpacity`
	 * are, and are all this needs.
	 */
	private resolveFillOverlayGradient(
		gradFill: XmlObject,
	): NonNullable<PptxImageEffects['fillOverlay']>['resolvedGradient'] {
		const gsLst = gradFill['a:gsLst'] as XmlObject | undefined;
		const gsNodes = this.ensureArray(gsLst?.['a:gs']);
		const stops: Array<{ color: string; position: number; opacity?: number }> = [];
		for (const gsNode of gsNodes) {
			const gs = gsNode as XmlObject;
			const color = this.parseColor(gs);
			if (!color) {
				continue;
			}
			// `a:gs@pos` is a positive fixed percentage in 1000ths (0-100 000).
			const position = (parseInt(String(gs['@_pos'] || '0'), 10) || 0) / 100000;
			const opacity = this.extractColorOpacity(gs);
			stops.push({ color, position, ...(opacity !== undefined ? { opacity } : {}) });
		}
		if (stops.length === 0) {
			return undefined;
		}
		const lin = gradFill['a:lin'] as XmlObject | undefined;
		if (lin) {
			const angRaw = parseInt(String(lin['@_ang'] || '0'), 10) || 0;
			const angle = (((angRaw / 60000) % 360) + 360) % 360;
			return { type: 'linear', angle, stops };
		}
		if (gradFill['a:path'] !== undefined) {
			return { type: 'radial', stops };
		}
		return { type: 'linear', angle: 0, stops };
	}

	/**
	 * Resolve a blip `a:fillOverlay/a:pattFill` to the structured preset
	 * pattern a renderer composites as a tiled SVG paint server.
	 */
	private resolveFillOverlayPattern(
		pattFill: XmlObject,
	): NonNullable<PptxImageEffects['fillOverlay']>['resolvedPattern'] {
		const preset = String(pattFill['@_prst'] || '').trim();
		if (!preset) {
			return undefined;
		}
		const foreground = this.parseColor(pattFill['a:fgClr'] as XmlObject | undefined);
		const background = this.parseColor(pattFill['a:bgClr'] as XmlObject | undefined);
		return { preset, foreground, background };
	}

	/**
	 * Check for artistic image effects (`a14:imgEffect`) on images and report warnings.
	 */
	// Artistic effects are fully round-tripped via rawXml: no warnings needed.
	protected inspectArtisticEffects(
		_blip: XmlObject | undefined,
		_slideId?: string,
		_elementId?: string,
	): void {
		// No-op: full parity achieved.
	}

	/**
	 * Check for SVG image references in blip extensions.
	 * OOXML stores SVG via `a:blip/a:extLst/a:ext` with `asvg:svgBlip` child.
	 */
	protected extractSvgBlipRelId(blip: XmlObject | undefined): string | undefined {
		if (!blip) {
			return undefined;
		}
		const extLst = xmlChild(blip, 'a:extLst');
		if (!extLst) {
			return undefined;
		}

		const exts = this.ensureArray(extLst['a:ext']);
		for (const ext of exts) {
			// SVG extension uses URI {96DAC541-7B7A-43D3-8B79-37D633B846F1}
			const uri = xmlAttr(ext, 'uri') || '';
			if (uri === '{96DAC541-7B7A-43D3-8B79-37D633B846F1}') {
				const svgBlip = xmlChild(ext, 'asvg:svgBlip') || xmlChild(ext, 'a16:svgBlip');
				if (svgBlip) {
					return xmlAttr(svgBlip, 'r:embed') || xmlAttr(svgBlip, 'r:link') || '';
				}
			}
		}
		return undefined;
	}

	/**
	 * Resolve a relationship ID to a target path.
	 * Uses the slideRelsMap (slidePath → Map<rId, target>).
	 */
	protected resolveRelationshipTarget(sourcePath: string, rId: string): string | undefined {
		return this.mediaDataParser.resolveRelationshipTarget(sourcePath, rId);
	}
}
