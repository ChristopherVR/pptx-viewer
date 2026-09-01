import type {
	PptxBackgroundRemoval,
	PptxBackgroundRemovalMark,
	PptxImageEffects,
	XmlObject,
} from '../../types';
import {
	A14_IMAGE_PROPS_EXT_URI,
	attrByLocalName,
	childByLocalName,
	childrenByLocalName,
	localName,
	numberAttrByLocalName,
	percent100k,
} from './image-a14-xml';

export { A14_IMAGE_PROPS_EXT_URI } from './image-a14-xml';

/**
 * Parser for the Microsoft `a14` picture-editing blip extension
 * (`{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}`), which carries PowerPoint 2010+
 * artistic effects, the Corrections / Color panel settings and the "Remove
 * Background" state. The writer is `image-a14-effects-writer.ts`.
 *
 * ## Shape on disk
 *
 * ```xml
 * <a:blip r:embed="rId4">
 *   <a:extLst>
 *     <a:ext uri="{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}">
 *       <a14:imgProps xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main">
 *         <a14:imgLayer r:embed="rId5">
 *           <a14:imgEffect><a14:backgroundRemoval t="12000" b="88000" l="7000" r="93000"/></a14:imgEffect>
 *           <a14:imgEffect><a14:sharpenSoften amount="25000"/></a14:imgEffect>
 *           <a14:imgEffect><a14:artisticPencilSketch trans="16000" pressure="80000"/></a14:imgEffect>
 *         </a14:imgLayer>
 *       </a14:imgProps>
 *     </a:ext>
 *   </a:extLst>
 * </a:blip>
 * ```
 *
 * `a14:imgProps` is the direct child of `a:ext`; `a14:imgEffect` is nested two
 * levels below it and may repeat. `a14:imgLayer/@r:embed` points at the
 * PRISTINE original (PowerPoint stores it as an HD Photo `.wdp` part).
 *
 * ## Why nothing here feeds the renderer
 *
 * PowerPoint BAKES these effects into the bitmap referenced by the main
 * `a:blip/@r:embed` and keeps this extension only so the effect can be re-edited
 * from the pristine original. Measured with PowerPoint COM (`Slide.Export`) on
 * an unmodified picture: adding `a14:artisticPencilSketch`, or a
 * `a14:backgroundRemoval` retaining only the middle 50% x 50%, produced a
 * BYTE-IDENTICAL slide render to the untouched control. So a viewer that
 * re-applies these effects on top of the stored bitmap double-applies them, and
 * one that clips to the retained rectangle clips an image whose background was
 * already removed.
 *
 * The data is therefore modelled (editors, tooling and the AI layer want it) and
 * flagged `artisticPrerendered`, but the render layer must leave it alone.
 */

/** Everything the `a14` blip extension contributes to the image-effects model. */
export interface A14ImageExtension {
	/** Local element name of the artistic effect, without the `a14:` prefix. */
	artisticEffect?: string;
	/** Primary size/strength parameter normalised to 0..100. */
	artisticRadius?: number;
	/** Every numeric attribute of the artistic effect, raw and un-normalised. */
	artisticParams?: Record<string, number>;
	/** PowerPoint "Remove Background" state. */
	backgroundRemoval?: PptxBackgroundRemoval;
	/** `a14:imgLayer/@r:embed`: relationship id of the pristine original image. */
	originalImageRelId?: string;
	/** `a14:sharpenSoften`, raw. */
	sharpenSoften?: PptxImageEffects['sharpenSoften'];
	/** `a14:brightnessContrast`, raw. */
	brightnessContrast?: PptxImageEffects['brightnessContrast'];
	/** `a14:colorTemperature`, raw. */
	colorTemperature?: PptxImageEffects['colorTemperature'];
	/** `a14:saturation`, raw. */
	colorSaturation?: PptxImageEffects['colorSaturation'];
}

/**
 * Primary size/strength attribute per artistic effect (MS-ODRAWXML `CT_Artistic*`).
 * Only `artisticBlur/@radius` is an absolute value; every other entry is a
 * percentage in 1/1000ths of a percent, so it is divided by 1000 to land on the
 * 0..100 scale {@link A14ImageExtension.artisticRadius} uses.
 */
export const ARTISTIC_PRIMARY_ATTRIBUTE: Readonly<Record<string, string>> = {
	artisticBlur: 'radius',
	artisticCement: 'crackSpacing',
	artisticChalkSketch: 'pressure',
	artisticCrisscrossEtching: 'pressure',
	artisticCutout: 'numberOfShades',
	artisticFilmGrain: 'grainSize',
	artisticGlass: 'scaling',
	artisticGlowDiffused: 'intensity',
	artisticGlowEdges: 'smoothness',
	artisticLightScreen: 'gridSize',
	artisticLineDrawing: 'pencilSize',
	artisticMarker: 'size',
	// Spelled "Mosiaic" in the schema; Microsoft's typo is part of the format.
	artisticMosiaicBubbles: 'pressure',
	artisticPaintBrush: 'brushSize',
	artisticPaintStrokes: 'intensity',
	artisticPastelsSmooth: 'scaling',
	artisticPencilGrayscale: 'pencilSize',
	artisticPencilSketch: 'pressure',
	artisticPhotocopy: 'detail',
	artisticPlasticWrap: 'smoothness',
	artisticTexturizer: 'scaling',
	artisticWatercolorSponge: 'brushSize',
};

/** Attributes that never describe the effect's size/strength. */
const NON_SIZE_ATTRIBUTES = new Set(['trans', 'visible']);

function parseMarks(parent: XmlObject, name: string): PptxBackgroundRemovalMark[] | undefined {
	const marks: PptxBackgroundRemovalMark[] = [];
	for (const node of childrenByLocalName(parent, name)) {
		const x1 = percent100k(node, 'x1');
		const y1 = percent100k(node, 'y1');
		const x2 = percent100k(node, 'x2');
		const y2 = percent100k(node, 'y2');
		if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
			continue;
		}
		marks.push({ x1, y1, x2, y2 });
	}
	return marks.length > 0 ? marks : undefined;
}

function parseBackgroundRemoval(node: XmlObject): PptxBackgroundRemoval | undefined {
	const top = percent100k(node, 't');
	const bottom = percent100k(node, 'b');
	const left = percent100k(node, 'l');
	const right = percent100k(node, 'r');
	if (top === undefined || bottom === undefined || left === undefined || right === undefined) {
		return undefined;
	}
	const removal: PptxBackgroundRemoval = { top, bottom, left, right, rawXml: node };
	const foregroundMarks = parseMarks(node, 'foregroundMark');
	if (foregroundMarks) {
		removal.foregroundMarks = foregroundMarks;
	}
	const backgroundMarks = parseMarks(node, 'backgroundMark');
	if (backgroundMarks) {
		removal.backgroundMarks = backgroundMarks;
	}
	return removal;
}

/** Collect every numeric attribute of an artistic-effect node, raw. */
function collectParams(node: XmlObject): Record<string, number> {
	const params: Record<string, number> = {};
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_')) {
			continue;
		}
		const parsed = Number(node[key]);
		if (Number.isFinite(parsed)) {
			params[localName(key.slice(2))] = parsed;
		}
	}
	return params;
}

/** Normalise the primary parameter of an artistic effect onto the 0..100 scale. */
function artisticRadiusOf(name: string, params: Record<string, number>): number | undefined {
	const primary = ARTISTIC_PRIMARY_ATTRIBUTE[name];
	const key =
		primary !== undefined && primary in params
			? primary
			: Object.keys(params).find((candidate) => !NON_SIZE_ATTRIBUTES.has(candidate));
	if (key === undefined) {
		return undefined;
	}
	const value = params[key];
	// `radius` is an absolute value; every other parameter is a 1/1000th percent.
	return key === 'radius' ? value : value / 1000;
}

/**
 * Read one Corrections / Color panel effect (`a14:sharpenSoften`,
 * `a14:brightnessContrast`, `a14:colorTemperature`, `a14:saturation`). Values
 * are kept exactly as the XML carries them; the first occurrence wins.
 * @returns `true` when `name` was one of the four, whether or not it parsed.
 */
function readCorrectionEffect(name: string, node: XmlObject, out: A14ImageExtension): boolean {
	if (name === 'sharpenSoften') {
		const amount = numberAttrByLocalName(node, 'amount');
		if (amount !== undefined) {
			out.sharpenSoften ??= { amount };
		}
		return true;
	}
	if (name === 'brightnessContrast') {
		const bright = numberAttrByLocalName(node, 'bright');
		const contrast = numberAttrByLocalName(node, 'contrast');
		if (bright !== undefined || contrast !== undefined) {
			out.brightnessContrast ??= {
				...(bright !== undefined ? { bright } : {}),
				...(contrast !== undefined ? { contrast } : {}),
			};
		}
		return true;
	}
	if (name === 'colorTemperature') {
		const colorTemp = numberAttrByLocalName(node, 'colorTemp');
		if (colorTemp !== undefined) {
			out.colorTemperature ??= { colorTemp };
		}
		return true;
	}
	if (name === 'saturation') {
		const sat = numberAttrByLocalName(node, 'sat');
		if (sat !== undefined) {
			out.colorSaturation ??= { sat };
		}
		return true;
	}
	return false;
}

/** Read the effects out of one `a14:imgEffect`. */
function readImgEffect(imgEffect: XmlObject, out: A14ImageExtension): void {
	for (const key of Object.keys(imgEffect)) {
		if (key.startsWith('@_')) {
			continue;
		}
		const name = localName(key);
		// An attribute-less effect (`<a14:artisticMarker/>`, all defaults) parses
		// to an empty string rather than an object; it is still the effect.
		const node = childByLocalName(imgEffect, name) ?? {};
		if (name === 'backgroundRemoval') {
			out.backgroundRemoval ??= parseBackgroundRemoval(node);
			continue;
		}
		if (readCorrectionEffect(name, node, out)) {
			continue;
		}
		if (!name.startsWith('artistic') || out.artisticEffect !== undefined) {
			continue;
		}
		out.artisticEffect = name;
		const params = collectParams(node);
		if (Object.keys(params).length > 0) {
			out.artisticParams = params;
			const radius = artisticRadiusOf(name, params);
			if (radius !== undefined) {
				out.artisticRadius = radius;
			}
		}
	}
}

/**
 * Parse the `a14` image-properties extension off a `a:blip` extension list.
 *
 * Accepts both the real nesting (`a:ext > a14:imgProps > a14:imgLayer >
 * a14:imgEffect`) and the flattened shapes (`a:ext > a14:imgEffect`, `a:ext >
 * a14:imgLayer > a14:imgEffect`) that hand-written packages sometimes carry.
 *
 * @param exts The `a:ext` nodes of the blip's `a:extLst`.
 * @returns The parsed extension, or `undefined` when the URI is absent or empty.
 */
export function parseA14ImageExtension(exts: XmlObject[]): A14ImageExtension | undefined {
	const out: A14ImageExtension = {};
	for (const ext of exts) {
		if (attrByLocalName(ext, 'uri') !== A14_IMAGE_PROPS_EXT_URI) {
			continue;
		}
		const imgProps = childByLocalName(ext, 'imgProps') ?? ext;
		const imgLayer = childByLocalName(imgProps, 'imgLayer');
		const relId = attrByLocalName(imgLayer, 'embed');
		if (relId) {
			out.originalImageRelId = relId;
		}
		for (const imgEffect of childrenByLocalName(imgLayer ?? imgProps, 'imgEffect')) {
			readImgEffect(imgEffect, out);
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
