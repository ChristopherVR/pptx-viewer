/**
 * slide-template-helpers.ts: element factory helpers for slide templates.
 *
 * Templates are authored in EMU on the standard 16:9 reference canvas
 * (12192000 x 6858000 EMU) and converted to the deck's pixel space here.
 * Every colour is a theme-scheme reference: the resolved hex comes from the
 * deck's scheme map, and a matching `a:schemeClr` node is stashed on the
 * element (`fillColorXml` / `colorXml`) so a save round-trip re-emits the
 * theme reference instead of a hardcoded RGB.
 */

import { DEFAULT_SCHEME_COLOR_MAP } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorScheme, TextStyle, XmlObject } from 'pptx-viewer-core';

import { translationsEn } from '../../i18n';
import type {
	EmuFrame,
	SlideTemplateBuildContext,
	SlideTemplateBuildOptions,
} from './slide-template-types';

/** Reference slide width in EMU (standard 16:9 deck). */
export const TEMPLATE_REF_WIDTH_EMU = 12192000;
/** Reference slide height in EMU (standard 16:9 deck). */
export const TEMPLATE_REF_HEIGHT_EMU = 6858000;
/** Default target canvas width in px. */
const DEFAULT_SLIDE_WIDTH_PX = 1280;
/** Default target canvas height in px. */
const DEFAULT_SLIDE_HEIGHT_PX = 720;

/** Standard content margin (0.5 inch) in EMU. */
export const TEMPLATE_MARGIN_EMU = 457200;
/** Content width between the standard left/right margins. */
export const TEMPLATE_CONTENT_WIDTH_EMU = TEMPLATE_REF_WIDTH_EMU - 2 * TEMPLATE_MARGIN_EMU;

/** Resolve a scheme colour key to hex, falling back to the Office defaults. */
export function resolveSchemeColor(scheme: Record<string, string>, key: string): string {
	return scheme[key] ?? DEFAULT_SCHEME_COLOR_MAP[key] ?? '#000000';
}

/**
 * Derive the template scheme map from a deck's parsed theme colour scheme,
 * adding the standard text/background aliases (`tx1` = `dk1`, `bg1` = `lt1`,
 * `tx2` = `dk2`, `bg2` = `lt2`) templates reference. Missing slots fall back
 * to the Office defaults at resolution time.
 */
export function templateSchemeFromTheme(
	colorScheme?: Partial<PptxThemeColorScheme> | Partial<Record<string, string>>,
): Record<string, string> {
	const scheme: Record<string, string> = {};
	if (colorScheme) {
		for (const [key, value] of Object.entries(colorScheme)) {
			if (typeof value === 'string' && value) {
				scheme[key] = value;
			}
		}
	}
	const alias: Array<[string, string]> = [
		['tx1', 'dk1'],
		['bg1', 'lt1'],
		['tx2', 'dk2'],
		['bg2', 'lt2'],
	];
	for (const [to, from] of alias) {
		const source = scheme[from];
		if (!scheme[to] && source) {
			scheme[to] = source;
		}
	}
	return scheme;
}

/** Build the `a:schemeClr` colour-choice node stashed for round-trip saves. */
export function schemeColorXml(key: string): XmlObject {
	return { 'a:schemeClr': { '@_val': key } };
}

/** Create the build context from public options. */
export function createTemplateContext(
	options: SlideTemplateBuildOptions = {},
): SlideTemplateBuildContext {
	const width = options.slideWidth ?? DEFAULT_SLIDE_WIDTH_PX;
	const height = options.slideHeight ?? DEFAULT_SLIDE_HEIGHT_PX;
	const scheme = { ...DEFAULT_SCHEME_COLOR_MAP, ...(options.scheme ?? {}) };
	let counter = 0;
	const idFor = options.idFor ?? ((index: number) => `template-el-${Date.now()}-${index}`);
	const dictionary: Record<string, string> = translationsEn;
	const translate = options.translate ?? ((key: string) => dictionary[key] ?? key);
	return {
		scheme,
		scaleX: width / TEMPLATE_REF_WIDTH_EMU,
		scaleY: height / TEMPLATE_REF_HEIGHT_EMU,
		nextId: () => idFor(counter++),
		t: (suffix: string) => translate(`pptx.slideTemplates.content.${suffix}`),
	};
}

/** Convert an EMU reference frame into target-canvas px geometry. */
export function frameToPx(
	ctx: SlideTemplateBuildContext,
	frame: EmuFrame,
): { x: number; y: number; width: number; height: number } {
	return {
		x: frame.x * ctx.scaleX,
		y: frame.y * ctx.scaleY,
		width: frame.w * ctx.scaleX,
		height: frame.h * ctx.scaleY,
	};
}

/** Styling knobs for {@link templateText}. */
export interface TemplateTextOptions {
	name: string;
	fontSize: number;
	colorKey: string;
	bold?: boolean;
	italic?: boolean;
	align?: TextStyle['align'];
	vAlign?: TextStyle['vAlign'];
	lineSpacing?: number;
	fontFamily?: string;
}

/** Create a theme-aware text box element. */
export function templateText(
	ctx: SlideTemplateBuildContext,
	frame: EmuFrame,
	text: string,
	opts: TemplateTextOptions,
): PptxElement {
	const style: TextStyle = {
		fontSize: opts.fontSize,
		color: resolveSchemeColor(ctx.scheme, opts.colorKey),
		colorXml: schemeColorXml(opts.colorKey),
	};
	if (opts.bold) {
		style.bold = true;
	}
	if (opts.italic) {
		style.italic = true;
	}
	if (opts.align) {
		style.align = opts.align;
	}
	if (opts.vAlign) {
		style.vAlign = opts.vAlign;
	}
	if (opts.lineSpacing !== undefined) {
		style.lineSpacing = opts.lineSpacing;
	}
	if (opts.fontFamily) {
		style.fontFamily = opts.fontFamily;
	}
	return {
		type: 'text',
		id: ctx.nextId(),
		name: opts.name,
		...frameToPx(ctx, frame),
		text,
		textStyle: style,
	};
}

/** Styling knobs for {@link templateShape}. */
export interface TemplateShapeOptions {
	name: string;
	fillKey: string;
	shapeType?: string;
	text?: string;
	textOptions?: Omit<TemplateTextOptions, 'name'>;
	strokeKey?: string;
	strokeWidth?: number;
}

/** Create a theme-aware filled shape (optionally carrying centred text). */
export function templateShape(
	ctx: SlideTemplateBuildContext,
	frame: EmuFrame,
	opts: TemplateShapeOptions,
): PptxElement {
	const element: PptxElement = {
		type: 'shape',
		id: ctx.nextId(),
		name: opts.name,
		...frameToPx(ctx, frame),
		shapeType: opts.shapeType ?? 'rect',
		shapeStyle: {
			fillMode: 'solid',
			fillColor: resolveSchemeColor(ctx.scheme, opts.fillKey),
			fillColorXml: schemeColorXml(opts.fillKey),
			...(opts.strokeKey
				? {
						strokeColor: resolveSchemeColor(ctx.scheme, opts.strokeKey),
						strokeColorXml: schemeColorXml(opts.strokeKey),
						strokeWidth: opts.strokeWidth ?? 1,
					}
				: { strokeWidth: 0 }),
		},
	};
	if (opts.text !== undefined && opts.textOptions) {
		const textStyle: TextStyle = {
			fontSize: opts.textOptions.fontSize,
			color: resolveSchemeColor(ctx.scheme, opts.textOptions.colorKey),
			colorXml: schemeColorXml(opts.textOptions.colorKey),
			align: opts.textOptions.align ?? 'center',
			vAlign: opts.textOptions.vAlign ?? 'middle',
		};
		if (opts.textOptions.bold) {
			textStyle.bold = true;
		}
		if (opts.textOptions.italic) {
			textStyle.italic = true;
		}
		if (opts.textOptions.lineSpacing !== undefined) {
			textStyle.lineSpacing = opts.textOptions.lineSpacing;
		}
		element.text = opts.text;
		element.textStyle = textStyle;
	}
	return element;
}
