import {
	hslToRgb,
	parseDrawingFraction,
	parseDrawingHueDegrees,
	scrgbLinearToSrgb8,
} from '../../color/color-primitives';
import { applyDrawingColorTransforms } from '../../color/color-transforms';
import { PRESET_COLOR_MAP, SYSTEM_COLOR_MAP } from '../../constants';
import type { XmlObject } from '../../types';

export interface PptxColorTransformCodecContext {
	resolveThemeColor: (schemeKey: string) => string | undefined;
}

export interface IPptxColorTransformCodec {
	parseColorChoice(
		colorChoice: XmlObject | undefined,
		placeholderColor?: string,
	): string | undefined;
	parseColor(colorNode: XmlObject | undefined, placeholderColor?: string): string | undefined;
	percentAttrToUnit(value: unknown): number | undefined;
	clampUnitInterval(value: number): number;
	hexToRgb(hex: string): { r: number; g: number; b: number } | undefined;
	rgbToHex(r: number, g: number, b: number): string;
	applyColorTransforms(baseColor: string, colorNode: XmlObject): string;
}

export class PptxColorTransformCodec implements IPptxColorTransformCodec {
	private readonly context: PptxColorTransformCodecContext;

	public constructor(context: PptxColorTransformCodecContext) {
		this.context = context;
	}

	public parseColorChoice(
		colorChoice: XmlObject | undefined,
		placeholderColor?: string,
	): string | undefined {
		if (!colorChoice) {
			return undefined;
		}

		if (colorChoice['a:scrgbClr']) {
			const scrgb = colorChoice['a:scrgbClr'] as XmlObject;
			// scRGB channels are linear-light; compand (linear -> sRGB) before
			// mapping to 8-bit so mid-tones are not over-darkened.
			const red = parseDrawingFraction(scrgb['@_r']);
			const green = parseDrawingFraction(scrgb['@_g']);
			const blue = parseDrawingFraction(scrgb['@_b']);
			if (red !== undefined && green !== undefined && blue !== undefined) {
				const base = this.rgbToHex(
					scrgbLinearToSrgb8(red),
					scrgbLinearToSrgb8(green),
					scrgbLinearToSrgb8(blue),
				);
				return this.applyColorTransforms(base, scrgb);
			}
		}

		if (colorChoice['a:srgbClr']) {
			const srgb = colorChoice['a:srgbClr'] as XmlObject;
			const value = String(srgb['@_val'] || '').trim();
			if (/^[0-9a-fA-F]{6}$/.test(value)) {
				return this.applyColorTransforms(`#${value.toUpperCase()}`, srgb);
			}
		}

		if (colorChoice['a:sysClr']) {
			const systemColor = colorChoice['a:sysClr'] as XmlObject;
			const lastColor = String(systemColor['@_lastClr'] || '').trim();
			if (/^[0-9a-fA-F]{6}$/.test(lastColor)) {
				return this.applyColorTransforms(`#${lastColor.toUpperCase()}`, systemColor);
			}
			// Fallback: resolve @_val system color name
			const sysVal = String(systemColor['@_val'] || '').trim();
			if (sysVal) {
				const mapped = SYSTEM_COLOR_MAP[sysVal];
				if (mapped) {
					return this.applyColorTransforms(mapped, systemColor);
				}
			}
		}

		if (colorChoice['a:prstClr']) {
			const presetColor = colorChoice['a:prstClr'] as XmlObject;
			const presetName = String(presetColor['@_val'] || '').toLowerCase();
			const mappedColor = PRESET_COLOR_MAP[presetName];
			if (mappedColor) {
				return this.applyColorTransforms(mappedColor, presetColor);
			}
		}

		// `a:schemeClr` and `a:styleClr` (DrawingML §20.1.4.1.32 / §20.1.4.1.42).
		// `styleClr` is the table-style alias and behaves identically: its `@_val`
		// is one of the same scheme tokens (or `phClr`).
		const schemeNode =
			(colorChoice['a:schemeClr'] as XmlObject | undefined) ??
			(colorChoice['a:styleClr'] as XmlObject | undefined);
		if (schemeNode) {
			const schemeKey = String(schemeNode['@_val'] || '')
				.trim()
				.toLowerCase();
			if (!schemeKey) {
				return undefined;
			}

			let baseColor: string | undefined;
			if (schemeKey === 'phclr') {
				// `phClr` means "use the contextual placeholder colour from the
				// surrounding style ref". Only fall back to accent1 when no
				// placeholder is in scope (matches PowerPoint's defaulting).
				baseColor = placeholderColor ?? this.context.resolveThemeColor('phclr');
			} else {
				baseColor = this.context.resolveThemeColor(schemeKey);
			}
			if (!baseColor) {
				return undefined;
			}
			return this.applyColorTransforms(baseColor, schemeNode);
		}

		// OOXML_PARITY: a:hslClr now supported
		if (colorChoice['a:hslClr']) {
			const hslNode = colorChoice['a:hslClr'] as XmlObject;
			const hue = parseDrawingHueDegrees(hslNode['@_hue']);
			const sat = this.percentAttrToUnit(hslNode['@_sat']);
			const lum = this.percentAttrToUnit(hslNode['@_lum']);
			if (hue !== undefined && sat !== undefined && lum !== undefined) {
				const rgb = hslToRgb(hue, sat, lum);
				const base = this.rgbToHex(rgb.r, rgb.g, rgb.b);
				return this.applyColorTransforms(base, hslNode);
			}
		}

		return undefined;
	}

	public parseColor(
		colorNode: XmlObject | undefined,
		placeholderColor?: string,
	): string | undefined {
		if (!colorNode) {
			return undefined;
		}
		return this.parseColorChoice(colorNode, placeholderColor);
	}

	public percentAttrToUnit(value: unknown): number | undefined {
		const parsedValue = Number.parseFloat(String(value ?? '').trim());
		if (!Number.isFinite(parsedValue)) {
			return undefined;
		}
		return Math.min(1, Math.max(0, parsedValue / 100000));
	}

	public clampUnitInterval(value: number): number {
		return Math.min(1, Math.max(0, value));
	}

	public hexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
		const normalized = hex.replace('#', '');
		if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
			return undefined;
		}
		return {
			r: Number.parseInt(normalized.slice(0, 2), 16),
			g: Number.parseInt(normalized.slice(2, 4), 16),
			b: Number.parseInt(normalized.slice(4, 6), 16),
		};
	}

	public rgbToHex(r: number, g: number, b: number): string {
		const toHex = (channelValue: number): string =>
			this.clampColorChannel(channelValue).toString(16).padStart(2, '0').toUpperCase();
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}

	public applyColorTransforms(baseColor: string, colorNode: XmlObject): string {
		return applyDrawingColorTransforms(baseColor, colorNode);
	}

	private clampColorChannel(value: number): number {
		return Math.min(255, Math.max(0, Math.round(value)));
	}
}
