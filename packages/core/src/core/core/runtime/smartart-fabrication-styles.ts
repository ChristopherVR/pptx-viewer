/**
 * Fabricated diagram QUICK-STYLE (`quickStyleN.xml`) and COLORS
 * (`colorsN.xml`) parts for SDK-created SmartArt. Both define the standard
 * style labels the fabricated layout definitions reference (`node1`,
 * `parChTrans1D2`) plus `node0` as the conventional default. Colours map the
 * in-memory {@link SmartArtColorScheme} onto theme accent colours so the
 * saved diagram respects the hosting deck's theme.
 */
import type { SmartArtColorScheme } from '../../types';
import { XML_PROLOG, DGM_XMLNS } from './smartart-fabrication-data';

export const FABRICATED_QUICKSTYLE_UNIQUE_ID = 'urn:pptx-viewer/quickstyle/simple';

export function fabricatedColorsUniqueId(scheme: SmartArtColorScheme | undefined): string {
	return `urn:pptx-viewer/colors/${scheme ?? 'colorful1'}`;
}

export function fabricatedColorsCategory(scheme: SmartArtColorScheme | undefined): string {
	return scheme?.startsWith('monochromatic') ? 'accent1' : 'colorful';
}

const STYLE_LABEL_NAMES = ['node0', 'node1', 'parChTrans1D2', 'sibTrans2D1'] as const;

function quickStyleLabelXml(name: string): string {
	const isConnector = name === 'parChTrans1D2';
	return (
		`<dgm:styleLbl name="${name}">` +
		'<dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d>' +
		'<dgm:sp3d/>' +
		'<dgm:txPr/>' +
		'<dgm:style>' +
		`<a:lnRef idx="${isConnector ? '1' : '2'}"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef>` +
		'<a:fillRef idx="1"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef>' +
		'<a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef>' +
		'<a:fontRef idx="minor"/>' +
		'</dgm:style>' +
		'</dgm:styleLbl>'
	);
}

/** Build the complete `quickStyleN.xml` payload. */
export function buildFabricatedQuickStyleXml(): string {
	return (
		`${XML_PROLOG}\r\n<dgm:styleDef ${DGM_XMLNS} uniqueId="${FABRICATED_QUICKSTYLE_UNIQUE_ID}">` +
		`<dgm:title val="Simple"/><dgm:desc val=""/>` +
		`<dgm:catLst><dgm:cat type="simple" pri="10100"/></dgm:catLst>` +
		`<dgm:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="threePt" dir="t"/></dgm:scene3d>${STYLE_LABEL_NAMES.map(
			quickStyleLabelXml,
		).join('')}</dgm:styleDef>`
	);
}

/** Theme accent colours each scheme fills node shapes with, in cycle order. */
const SCHEME_FILL_ACCENTS: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'],
	colorful2: ['accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'accent1'],
	colorful3: ['accent3', 'accent4', 'accent5', 'accent6', 'accent1', 'accent2'],
	monochromatic1: ['accent1'],
	monochromatic2: ['accent2'],
};

function schemeClrListXml(accents: string[]): string {
	return accents.map((accent) => `<a:schemeClr val="${accent}"/>`).join('');
}

function colorsLabelXml(name: string, accents: string[]): string {
	const isConnector = name === 'parChTrans1D2' || name === 'sibTrans2D1';
	const fill = isConnector
		? '<dgm:fillClrLst meth="repeat"><a:schemeClr val="accent1"><a:shade val="60000"/></a:schemeClr></dgm:fillClrLst>'
		: `<dgm:fillClrLst meth="cycle">${schemeClrListXml(accents)}</dgm:fillClrLst>`;
	const line = isConnector
		? '<dgm:linClrLst meth="repeat"><a:schemeClr val="accent1"><a:shade val="60000"/></a:schemeClr></dgm:linClrLst>'
		: '<dgm:linClrLst meth="repeat"><a:schemeClr val="lt1"/></dgm:linClrLst>';
	return (
		`<dgm:styleLbl name="${name}">${fill}${line}<dgm:effectClrLst/>` +
		`<dgm:txLinClrLst/>` +
		`<dgm:txFillClrLst meth="repeat"><a:schemeClr val="lt1"/></dgm:txFillClrLst>` +
		`<dgm:txEffectClrLst/>` +
		`</dgm:styleLbl>`
	);
}

/** Build the complete `colorsN.xml` payload for a colour scheme. */
export function buildFabricatedColorsXml(scheme: SmartArtColorScheme | undefined): string {
	const accents = SCHEME_FILL_ACCENTS[scheme ?? 'colorful1'] ?? SCHEME_FILL_ACCENTS.colorful1;
	return (
		`${XML_PROLOG}\r\n<dgm:colorsDef ${DGM_XMLNS} uniqueId="${fabricatedColorsUniqueId(scheme)}">` +
		`<dgm:title val=""/><dgm:desc val=""/>` +
		`<dgm:catLst><dgm:cat type="${fabricatedColorsCategory(scheme)}" pri="10200"/></dgm:catLst>${STYLE_LABEL_NAMES.map(
			(name) => colorsLabelXml(name, accents),
		).join('')}</dgm:colorsDef>`
	);
}
