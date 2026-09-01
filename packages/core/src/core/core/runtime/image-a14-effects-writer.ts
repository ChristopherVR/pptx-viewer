import type { PptxBackgroundRemoval, PptxImageEffects, XmlObject } from '../../types';
import { ARTISTIC_PRIMARY_ATTRIBUTE } from './image-a14-effects';
import {
	A14_IMAGE_PROPS_EXT_URI,
	A14_NAMESPACE,
	attrByLocalName,
	blipExtensionEntries,
	childByLocalName,
} from './image-a14-xml';

/**
 * Writer for the `a14` picture-editing blip extension: the inverse of
 * `parseA14ImageExtension` in `image-a14-effects.ts`.
 *
 * Rebuilds `a:extLst > a:ext[uri=BEBA8EAE...] > a14:imgProps > a14:imgLayer >
 * a14:imgEffect/*` from the typed model. Every OTHER `a:ext` entry of the blip
 * (`asvg:svgBlip`, `a14:useLocalDpi`, ...) is left in place, and the entry is
 * removed outright when the model carries nothing for it, so clearing the
 * artistic effect in an inspector really clears it on disk.
 *
 * `xmlns:a14` is declared on `a14:imgProps`, exactly where PowerPoint puts it.
 */

/**
 * Gallery names the bindings store in `imageEffects.artisticEffect` (see
 * `pptx-viewer-shared/render/image-artistic-presets`), mapped to the `a14`
 * element that carries them. Names already in `artistic*` form pass through.
 * `grayscale`, `sepia` and `sharpen` are not artistic effects in OOXML (they
 * are Color / Corrections panel settings) and have no entry.
 */
const GALLERY_TO_A14: Readonly<Record<string, string>> = {
	blur: 'artisticBlur',
	cement: 'artisticCement',
	chalkSketch: 'artisticChalkSketch',
	crisscrossEtching: 'artisticCrisscrossEtching',
	cutout: 'artisticCutout',
	filmGrain: 'artisticFilmGrain',
	glass: 'artisticGlass',
	glowDiffused: 'artisticGlowDiffused',
	glow_edges: 'artisticGlowEdges',
	glowEdges: 'artisticGlowEdges',
	lightScreen: 'artisticLightScreen',
	lineDrawing: 'artisticLineDrawing',
	marker: 'artisticMarker',
	mosaic: 'artisticMosiaicBubbles',
	mosaicBubbles: 'artisticMosiaicBubbles',
	paint: 'artisticPaintBrush',
	paintBrush: 'artisticPaintBrush',
	paintStrokes: 'artisticPaintStrokes',
	pastelsSmooth: 'artisticPastelsSmooth',
	pencilGrayscale: 'artisticPencilGrayscale',
	pencilSketch: 'artisticPencilSketch',
	photocopy: 'artisticPhotocopy',
	plasticWrap: 'artisticPlasticWrap',
	texturizer: 'artisticTexturizer',
	watercolorSponge: 'artisticWatercolorSponge',
};

/**
 * Resolve a stored `artisticEffect` value to its `a14:artistic*` local name.
 * @returns `undefined` for `'none'`, empty, or a name OOXML has no artistic
 * element for.
 */
export function a14ArtisticElementName(effect: string | undefined): string | undefined {
	const trimmed = (effect ?? '').trim();
	if (trimmed.length === 0 || trimmed === 'none') {
		return undefined;
	}
	if (trimmed.startsWith('artistic')) {
		return trimmed;
	}
	return GALLERY_TO_A14[trimmed];
}

const round = (value: number): string => String(Math.round(value));

function buildArtisticNode(effects: PptxImageEffects, elementName: string): XmlObject {
	const node: XmlObject = {};
	const params = effects.artisticParams;
	if (params && Object.keys(params).length > 0) {
		for (const [name, value] of Object.entries(params)) {
			if (Number.isFinite(value)) {
				node[`@_${name}`] = round(value);
			}
		}
		return node;
	}
	const radius = effects.artisticRadius;
	const primary = ARTISTIC_PRIMARY_ATTRIBUTE[elementName];
	if (primary !== undefined && typeof radius === 'number' && Number.isFinite(radius)) {
		// `radius` is absolute; every other primary is a 1/1000th percent.
		node[`@_${primary}`] = primary === 'radius' ? round(radius) : round(radius * 1000);
	}
	return node;
}

function buildMarks(marks: PptxBackgroundRemoval['foregroundMarks']): XmlObject[] {
	return (marks ?? []).map((mark) => ({
		'@_x1': round(mark.x1 * 100000),
		'@_y1': round(mark.y1 * 100000),
		'@_x2': round(mark.x2 * 100000),
		'@_y2': round(mark.y2 * 100000),
	}));
}

function buildBackgroundRemovalNode(removal: PptxBackgroundRemoval): XmlObject {
	if (removal.rawXml) {
		return removal.rawXml;
	}
	const node: XmlObject = {
		'@_t': round(removal.top * 100000),
		'@_b': round(removal.bottom * 100000),
		'@_l': round(removal.left * 100000),
		'@_r': round(removal.right * 100000),
	};
	const foreground = buildMarks(removal.foregroundMarks);
	if (foreground.length > 0) {
		node['a14:foregroundMark'] = foreground;
	}
	const background = buildMarks(removal.backgroundMarks);
	if (background.length > 0) {
		node['a14:backgroundMark'] = background;
	}
	return node;
}

const finite = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

/** The `a14:imgEffect` entries the model asks for, in PowerPoint's order. */
function buildImgEffects(effects: PptxImageEffects): XmlObject[] {
	const out: XmlObject[] = [];
	if (effects.backgroundRemoval) {
		out.push({ 'a14:backgroundRemoval': buildBackgroundRemovalNode(effects.backgroundRemoval) });
	}
	if (finite(effects.sharpenSoften?.amount)) {
		out.push({ 'a14:sharpenSoften': { '@_amount': round(effects.sharpenSoften.amount) } });
	}
	const bc = effects.brightnessContrast;
	if (bc && (finite(bc.bright) || finite(bc.contrast))) {
		const node: XmlObject = {};
		if (finite(bc.bright)) {
			node['@_bright'] = round(bc.bright);
		}
		if (finite(bc.contrast)) {
			node['@_contrast'] = round(bc.contrast);
		}
		out.push({ 'a14:brightnessContrast': node });
	}
	if (finite(effects.colorTemperature?.colorTemp)) {
		out.push({
			'a14:colorTemperature': { '@_colorTemp': round(effects.colorTemperature.colorTemp) },
		});
	}
	if (finite(effects.colorSaturation?.sat)) {
		out.push({ 'a14:saturation': { '@_sat': round(effects.colorSaturation.sat) } });
	}
	const artistic = a14ArtisticElementName(effects.artisticEffect);
	if (artistic !== undefined) {
		const imgEffect: XmlObject = {};
		imgEffect[`a14:${artistic}`] = buildArtisticNode(effects, artistic);
		out.push(imgEffect);
	}
	return out;
}

/** Build the `a:ext` entry for the given effects, or `undefined` when there is nothing to carry. */
export function buildA14ImageExtension(effects: PptxImageEffects): XmlObject | undefined {
	const imgEffects = buildImgEffects(effects);
	if (imgEffects.length === 0) {
		return undefined;
	}
	const imgLayer: XmlObject = {};
	const relId = (effects.originalImageRelId ?? '').trim();
	if (relId.length > 0) {
		imgLayer['@_r:embed'] = relId;
	}
	imgLayer['a14:imgEffect'] = imgEffects;
	return {
		'@_uri': A14_IMAGE_PROPS_EXT_URI,
		'a14:imgProps': {
			'@_xmlns:a14': A14_NAMESPACE,
			'a14:imgLayer': imgLayer,
		},
	};
}

/**
 * Write the `a14` image-properties extension onto an `a:blip`, replacing any
 * existing entry with the same URI and preserving every other `a:ext`.
 *
 * When the model carries no `a14` effect the entry is removed, and an
 * `a:extLst` left empty by that removal is dropped too.
 */
export function applyA14ImageExtension(blip: XmlObject, effects: PptxImageEffects): void {
	const built = buildA14ImageExtension(effects);
	const others = blipExtensionEntries(blip).filter(
		(ext) => attrByLocalName(ext, 'uri') !== A14_IMAGE_PROPS_EXT_URI,
	);
	const entries = built ? [...others, built] : others;

	const extLstKey = Object.keys(blip).find((key) => key.endsWith('extLst')) ?? 'a:extLst';
	if (entries.length === 0) {
		delete blip[extLstKey];
		return;
	}
	const existing = childByLocalName(blip, 'extLst');
	const extKey = existing
		? (Object.keys(existing).find((key) => key.endsWith('ext') && !key.endsWith('extLst')) ??
			'a:ext')
		: 'a:ext';
	const extLst: XmlObject = existing ?? {};
	extLst[extKey] = entries.length === 1 ? entries[0] : entries;
	blip[extLstKey] = extLst;
}
