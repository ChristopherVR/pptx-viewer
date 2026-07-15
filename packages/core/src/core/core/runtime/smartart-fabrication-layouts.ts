/**
 * Fabricated diagram LAYOUT definitions (`ppt/diagrams/layoutN.xml`) for
 * SDK-created SmartArt. Named presets retain their own layout identity while
 * sharing a compact set of schema-safe algorithm families. The cached drawing
 * part supplies the precise node geometry PowerPoint displays.
 */
import type { PptxSmartArtData, SmartArtLayout } from '../../types';
import { XML_PROLOG, DGM_XMLNS } from './smartart-fabrication-data';
import { HIERARCHY_LAYOUT_DEF_BODY } from './smartart-fabrication-hierarchy';

export type FabricatedLayoutFamily =
	| 'list'
	| 'process'
	| 'cycle'
	| 'hierarchy'
	| 'matrix'
	| 'pyramid'
	| 'funnel'
	| 'target'
	| 'gear'
	| 'venn'
	| 'timeline'
	| 'relationship'
	| 'chevron'
	| 'bending';

export function fabricatedLayoutUniqueId(
	family: FabricatedLayoutFamily,
	layoutIdentity?: string,
): string {
	return `urn:pptx-viewer/layout/${layoutIdentity || family}`;
}

const PRESET_FAMILY: Partial<Record<SmartArtLayout, FabricatedLayoutFamily>> = {
	basicBlockList: 'list',
	alternatingHexagons: 'list',
	horizontalBulletList: 'list',
	stackedList: 'list',
	tableList: 'list',
	trapezoidList: 'list',
	pictureAccentList: 'list',
	verticalBlockList: 'list',
	groupedList: 'list',
	pyramidList: 'pyramid',
	horizontalPictureList: 'list',
	basicPyramid: 'pyramid',
	invertedPyramid: 'pyramid',
	basicMatrix: 'matrix',
	basicChevronProcess: 'chevron',
	continuousBlockProcess: 'process',
	segmentedProcess: 'process',
	upwardArrow: 'process',
	basicTimeline: 'timeline',
	bendingProcess: 'bending',
	stepDownProcess: 'process',
	alternatingFlow: 'process',
	descendingProcess: 'process',
	accentProcess: 'process',
	verticalChevronList: 'chevron',
	basicFunnel: 'funnel',
	basicCycle: 'cycle',
	basicPie: 'cycle',
	basicRadial: 'cycle',
	basicVenn: 'venn',
	convergingRadial: 'cycle',
	linearVenn: 'venn',
	basicTarget: 'target',
	interlockingGears: 'gear',
	hierarchy: 'hierarchy',
};

/** Resolve the fabricated layout family for an SDK-created SmartArt. */
export function resolveFabricatedLayoutFamily(data: PptxSmartArtData): FabricatedLayoutFamily {
	if (data.layout && PRESET_FAMILY[data.layout]) {
		return PRESET_FAMILY[data.layout]!;
	}
	const resolved = data.resolvedLayoutType;
	if (resolved === 'process' || resolved === 'timeline' || resolved === 'chevron') {
		return 'process';
	}
	if (resolved === 'cycle' || resolved === 'venn' || resolved === 'target') {
		return 'cycle';
	}
	if (resolved === 'hierarchy' || resolved === 'pyramid') {
		return resolved;
	}
	if (
		resolved === 'matrix' ||
		resolved === 'funnel' ||
		resolved === 'gear' ||
		resolved === 'relationship' ||
		resolved === 'bending'
	) {
		return resolved;
	}
	return 'list';
}

const SHAPE_NONE =
	'<dgm:shape xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:blip=""><dgm:adjLst/></dgm:shape>';

/** Build the text layout node shared by the compact algorithm families. */
function textNodeBody(shapeType: string): string {
	return (
		`<dgm:varLst><dgm:bulletEnabled val="1"/></dgm:varLst>` +
		`<dgm:alg type="tx"/><dgm:shape type="${shapeType}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:blip=""><dgm:adjLst/></dgm:shape><dgm:presOf axis="desOrSelf" ptType="node"/>` +
		`<dgm:constrLst>` +
		`<dgm:constr type="lMarg" refType="primFontSz" fact="0.3"/>` +
		`<dgm:constr type="rMarg" refType="primFontSz" fact="0.3"/>` +
		`<dgm:constr type="tMarg" refType="primFontSz" fact="0.3"/>` +
		`<dgm:constr type="bMarg" refType="primFontSz" fact="0.3"/>` +
		`</dgm:constrLst>` +
		`<dgm:ruleLst><dgm:rule type="primFontSz" val="5" fact="NaN" max="NaN"/></dgm:ruleLst>`
	);
}

/** Invisible spacer occupying each `sibTrans` slot between nodes. */
const SPACER_FOR_EACH =
	`<dgm:forEach name="spacerForEach" axis="followSib" ptType="sibTrans" cnt="1">` +
	`<dgm:layoutNode name="spacer">` +
	`<dgm:alg type="sp"/>${SHAPE_NONE}<dgm:presOf/>` +
	`<dgm:constrLst/>` +
	`<dgm:ruleLst/>` +
	`</dgm:layoutNode>` +
	`</dgm:forEach>`;

function linearLayoutBody(vertical: boolean, shapeType: string): string {
	const constraints = vertical
		? '<dgm:constr type="w" for="ch" forName="node" refType="w"/>' +
			'<dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.3"/>' +
			'<dgm:constr type="h" for="ch" forName="spacer" refType="h" refFor="ch" refForName="node" fact="0.25"/>'
		: '<dgm:constr type="w" for="ch" forName="node" refType="w" fact="0.3"/>' +
			'<dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.55"/>' +
			'<dgm:constr type="w" for="ch" forName="spacer" refType="w" refFor="ch" refForName="node" fact="0.25"/>';
	return (
		`<dgm:layoutNode name="diagram">` +
		`<dgm:varLst><dgm:dir/><dgm:resizeHandles val="exact"/></dgm:varLst>` +
		`<dgm:alg type="lin"><dgm:param type="linDir" val="${vertical ? 'fromT' : 'fromL'}"/></dgm:alg>${
			SHAPE_NONE
		}<dgm:presOf/>` +
		`<dgm:constrLst>${
			constraints
		}<dgm:constr type="primFontSz" for="ch" forName="node" op="equ" val="65"/>` +
		`</dgm:constrLst>` +
		`<dgm:ruleLst/>` +
		`<dgm:forEach name="nodesForEach" axis="ch" ptType="node">` +
		`<dgm:layoutNode name="node" styleLbl="node1">${textNodeBody(shapeType)}</dgm:layoutNode>${
			SPACER_FOR_EACH
		}</dgm:forEach>` +
		`</dgm:layoutNode>`
	);
}

function cycleLayoutBody(shapeType: string): string {
	return (
		`<dgm:layoutNode name="diagram">` +
		`<dgm:varLst><dgm:dir/><dgm:resizeHandles val="exact"/></dgm:varLst>` +
		`<dgm:alg type="cycle"><dgm:param type="stAng" val="0"/><dgm:param type="spanAng" val="360"/></dgm:alg>${
			SHAPE_NONE
		}<dgm:presOf/>` +
		`<dgm:constrLst>` +
		`<dgm:constr type="w" for="ch" forName="node" refType="w" fact="0.32"/>` +
		`<dgm:constr type="h" for="ch" forName="node" refType="w" refFor="ch" refForName="node" fact="0.5"/>` +
		`<dgm:constr type="sibSp" refType="w" refFor="ch" refForName="node" fact="0.15"/>` +
		`<dgm:constr type="primFontSz" for="ch" forName="node" op="equ" val="65"/>` +
		`</dgm:constrLst>` +
		`<dgm:ruleLst/>` +
		`<dgm:forEach name="nodesForEach" axis="ch" ptType="node">` +
		`<dgm:layoutNode name="node" styleLbl="node1">${textNodeBody(shapeType)}</dgm:layoutNode>` +
		`</dgm:forEach>` +
		`</dgm:layoutNode>`
	);
}

const FAMILY_TITLE: Record<FabricatedLayoutFamily, string> = {
	list: 'Vertical List',
	process: 'Process',
	cycle: 'Cycle',
	hierarchy: 'Hierarchy',
	matrix: 'Matrix',
	pyramid: 'Pyramid',
	funnel: 'Funnel',
	target: 'Target',
	gear: 'Gears',
	venn: 'Venn',
	timeline: 'Timeline',
	relationship: 'Relationship',
	chevron: 'Chevron',
	bending: 'Bending Process',
};

const FAMILY_CATEGORY: Record<FabricatedLayoutFamily, string> = {
	list: 'list',
	process: 'process',
	cycle: 'cycle',
	hierarchy: 'hierarchy',
	matrix: 'matrix',
	pyramid: 'pyramid',
	funnel: 'pyramid',
	target: 'target',
	gear: 'relationship',
	venn: 'relationship',
	timeline: 'process',
	relationship: 'relationship',
	chevron: 'process',
	bending: 'process',
};

export function fabricatedLayoutCategory(family: FabricatedLayoutFamily): string {
	return FAMILY_CATEGORY[family];
}

/** Build the complete `layoutN.xml` payload for a fabricated layout family. */
function layoutShapeType(family: FabricatedLayoutFamily): string {
	if (family === 'cycle' || family === 'venn' || family === 'target' || family === 'timeline') {
		return 'ellipse';
	}
	if (family === 'pyramid' || family === 'funnel') {
		return 'trapezoid';
	}
	if (family === 'chevron') {
		return 'chevron';
	}
	if (family === 'gear') {
		return 'gear6';
	}
	return 'roundRect';
}

function layoutTitle(layoutIdentity: string | undefined, family: FabricatedLayoutFamily): string {
	if (!layoutIdentity) {
		return FAMILY_TITLE[family];
	}
	return layoutIdentity
		.replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
		.replace(/^./u, (value) => value.toUpperCase());
}

export function buildFabricatedLayoutDefXml(
	family: FabricatedLayoutFamily,
	layoutIdentity?: string,
): string {
	const shapeType = layoutShapeType(family);
	const body =
		family === 'cycle' || family === 'venn' || family === 'target' || family === 'gear'
			? cycleLayoutBody(shapeType)
			: family === 'hierarchy'
				? HIERARCHY_LAYOUT_DEF_BODY
				: linearLayoutBody(
						family === 'list' || family === 'pyramid' || family === 'funnel',
						shapeType,
					);
	return (
		`${XML_PROLOG}\r\n<dgm:layoutDef ${DGM_XMLNS} uniqueId="${fabricatedLayoutUniqueId(family, layoutIdentity)}">` +
		`<dgm:title val="${layoutTitle(layoutIdentity, family)}"/><dgm:desc val=""/>` +
		`<dgm:catLst><dgm:cat type="${FAMILY_CATEGORY[family]}" pri="1000"/></dgm:catLst>${
			body
		}</dgm:layoutDef>`
	);
}
