import type { PptxBackgroundRemoval, PptxBackgroundRemovalMark, XmlObject } from '../../types';

/**
 * Parser for the Microsoft `a14` picture-editing blip extension
 * (`{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}`), which carries PowerPoint 2010+
 * artistic effects and the "Remove Background" state.
 *
 * ## Shape on disk
 *
 * ```xml
 * <a:blip r:embed="rId4">
 *   <a:extLst>
 *     <a:ext uri="{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}">
 *       <a14:imgProps>
 *         <a14:imgLayer r:embed="rId5">
 *           <a14:imgEffect><a14:backgroundRemoval t="12000" b="88000" l="7000" r="93000"/></a14:imgEffect>
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

/** URI of the `a14` image-properties blip extension. */
export const A14_IMAGE_PROPS_EXT_URI = '{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B}';

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
	/** `a14:imgLayer/@r:embed` — relationship id of the pristine original image. */
	originalImageRelId?: string;
}

/**
 * Primary size/strength attribute per artistic effect (MS-ODRAWXML `CT_Artistic*`).
 * Only `artisticBlur/@radius` is an absolute value; every other entry is a
 * percentage in 1/1000ths of a percent, so it is divided by 1000 to land on the
 * 0..100 scale {@link A14ImageExtension.artisticRadius} uses.
 */
const ARTISTIC_PRIMARY_ATTRIBUTE: Record<string, string> = {
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

const localName = (key: string): string => key.split(':').at(-1) ?? key;

function childByLocalName(parent: XmlObject | undefined, name: string): XmlObject | undefined {
	if (!parent) {
		return undefined;
	}
	for (const key of Object.keys(parent)) {
		if (localName(key) !== name) {
			continue;
		}
		const value = parent[key];
		const first = Array.isArray(value) ? value[0] : value;
		if (first && typeof first === 'object') {
			return first as XmlObject;
		}
	}
	return undefined;
}

function childrenByLocalName(parent: XmlObject | undefined, name: string): XmlObject[] {
	if (!parent) {
		return [];
	}
	const out: XmlObject[] = [];
	for (const key of Object.keys(parent)) {
		if (localName(key) !== name) {
			continue;
		}
		const value = parent[key];
		for (const entry of Array.isArray(value) ? value : [value]) {
			if (entry && typeof entry === 'object') {
				out.push(entry as XmlObject);
			}
		}
	}
	return out;
}

/** Read an attribute (prefix-insensitive: `@_r:embed` and `@_embed` both match). */
function attrByLocalName(node: XmlObject | undefined, name: string): string | undefined {
	if (!node) {
		return undefined;
	}
	for (const key of Object.keys(node)) {
		if (!key.startsWith('@_')) {
			continue;
		}
		if (localName(key.slice(2)) === name) {
			const value = node[key];
			return value === undefined || value === null ? undefined : String(value);
		}
	}
	return undefined;
}

/** Parse a per-100000 relative unit (`ST_PositiveFixedPercentage`) to a 0..1 fraction. */
function percent100k(node: XmlObject | undefined, name: string): number | undefined {
	const raw = attrByLocalName(node, name);
	if (raw === undefined) {
		return undefined;
	}
	const parsed = Number(raw.endsWith('%') ? raw.slice(0, -1) : raw);
	return Number.isFinite(parsed) ? parsed / 100000 : undefined;
}

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

/** Read the artistic effect and background-removal state out of one `a14:imgEffect`. */
function readImgEffect(imgEffect: XmlObject, out: A14ImageExtension): void {
	for (const key of Object.keys(imgEffect)) {
		const name = localName(key);
		const node = childByLocalName(imgEffect, name);
		if (!node) {
			continue;
		}
		if (name === 'backgroundRemoval') {
			out.backgroundRemoval ??= parseBackgroundRemoval(node);
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
