import { XmlObject } from '../../types';
import type { PptxImageEffects, MediaBookmark } from '../../types';
import { xmlAttr, xmlChild } from '../../utils/xml-access';
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

		// a:lum — luminance modulation (@_bright, @_contrast in 1/1000ths of a percent)
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

		// a:hsl — HSL modulation (@_hue in 1/60000ths of a degree, @_sat/@_lum in 1/1000ths of a percent)
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

		// a:tint (image-effect tint inside blip) — @_hue (1/60000ths degree), @_amt (1/1000ths %)
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

		// a:fillOverlay — overlay fill (@_blend, child fill preserved opaquely)
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
			// a:blipFill, a:pattFill, a:noFill — we just keep the whole object.
			const rawCopy: Record<string, unknown> = {};
			for (const key of Object.keys(fillOverlay)) {
				if (key === '@_blend') {
					continue;
				}
				rawCopy[key] = (fillOverlay as Record<string, unknown>)[key];
			}
			effects.fillOverlay = { blend, fillRawXml: rawCopy };
			hasAny = true;
		}

		// a:blur — blur (@_rad in EMU, @_grow boolean)
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

		// Artistic effects from extension list
		const extLst = xmlChild(blip, 'a:extLst');
		if (extLst) {
			const exts = this.ensureArray(extLst['a:ext']);
			for (const ext of exts) {
				const uri = xmlAttr(ext, 'uri') || '';
				if (uri === '{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}') {
					const imgEffect = xmlChild(ext, 'a14:imgEffect') || xmlChild(ext, 'a14:imgLayer');
					if (imgEffect) {
						// Find the actual effect child (e.g. a14:artisticBlur, a14:artisticPencilGrayscale, etc.)
						const keys = Object.keys(imgEffect).filter((k) => k.startsWith('a14:artistic'));
						if (keys.length > 0) {
							const effectName = keys[0].replace('a14:', '');
							effects.artisticEffect = effectName;
							hasAny = true;
							// Try to extract radius/amount
							const effectNode = imgEffect[keys[0]] as XmlObject | undefined;
							if (effectNode) {
								const rad =
									effectNode['@_radius'] ?? effectNode['@_amount'] ?? effectNode['@_pressure'];
								if (rad !== null) {
									effects.artisticRadius = parseInt(String(rad)) || 0;
								}
							}
						}
					}
				}
			}
		}

		return hasAny ? effects : null;
	}

	/**
	 * Check for artistic image effects (`a14:imgEffect`) on images and report warnings.
	 */
	// Artistic effects are fully round-tripped via rawXml — no warnings needed.
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
