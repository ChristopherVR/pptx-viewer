/**
 * The fabricated HIERARCHY layout-definition body (`dgm:layoutNode` tree for
 * `layoutN.xml`). Split from `smartart-fabrication-layouts.ts` for file-size
 * reasons; consumed only by {@link import('./smartart-fabrication-layouts').buildFabricatedLayoutDefXml}.
 *
 * Structure follows the canonical recursive org-chart shape from ECMA-376:
 * a `hierChild` diagram root iterating top-level nodes, each wrapped in a
 * `hierRoot` composite holding the text shape and a nested `hierChild` that
 * draws the `parTrans` connectors and recurses via `<dgm:forEach ref>`.
 */

const SHAPE_NONE =
	'<dgm:shape xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:blip=""><dgm:adjLst/></dgm:shape>';

const SHAPE_ROUND_RECT =
	'<dgm:shape type="roundRect" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:blip=""><dgm:adjLst/></dgm:shape>';

const SHAPE_CONN =
	'<dgm:shape type="conn" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:blip=""><dgm:adjLst/></dgm:shape>';

const HIERARCHY_TEXT_NODE =
	`<dgm:layoutNode name="node" styleLbl="node1">` +
	`<dgm:varLst><dgm:chPref val="3"/></dgm:varLst>` +
	`<dgm:alg type="tx"/>${SHAPE_ROUND_RECT}<dgm:presOf axis="self"/>` +
	`<dgm:constrLst>` +
	`<dgm:constr type="lMarg" refType="primFontSz" fact="0.3"/>` +
	`<dgm:constr type="rMarg" refType="primFontSz" fact="0.3"/>` +
	`<dgm:constr type="tMarg" refType="primFontSz" fact="0.3"/>` +
	`<dgm:constr type="bMarg" refType="primFontSz" fact="0.3"/>` +
	`</dgm:constrLst>` +
	`<dgm:ruleLst><dgm:rule type="primFontSz" val="5" fact="NaN" max="NaN"/></dgm:ruleLst>` +
	`</dgm:layoutNode>`;

const HIERARCHY_CONNECTOR_FOR_EACH =
	`<dgm:forEach name="connForEach" axis="ch" ptType="parTrans">` +
	`<dgm:layoutNode name="conn" styleLbl="parChTrans1D2">` +
	`<dgm:alg type="conn">` +
	`<dgm:param type="dim" val="1D"/>` +
	`<dgm:param type="endSty" val="noArr"/>` +
	`<dgm:param type="connRout" val="bend"/>` +
	`</dgm:alg>${SHAPE_CONN}<dgm:presOf axis="self"/>` +
	`<dgm:constrLst>` +
	`<dgm:constr type="w" val="1"/>` +
	`<dgm:constr type="connDist"/>` +
	`<dgm:constr type="begPad" refType="connDist" fact="-0.2"/>` +
	`<dgm:constr type="endPad" refType="connDist" fact="-0.2"/>` +
	`</dgm:constrLst>` +
	`<dgm:ruleLst/>` +
	`</dgm:layoutNode>` +
	`</dgm:forEach>`;

export const HIERARCHY_LAYOUT_DEF_BODY =
	`<dgm:layoutNode name="diagram">` +
	`<dgm:varLst><dgm:chPref val="1"/><dgm:dir/><dgm:resizeHandles val="exact"/></dgm:varLst>` +
	`<dgm:alg type="hierChild"><dgm:param type="linDir" val="fromL"/></dgm:alg>${
		SHAPE_NONE
	}<dgm:presOf/>` +
	`<dgm:constrLst>` +
	`<dgm:constr type="w" for="des" forName="node" refType="w" fact="0.25"/>` +
	`<dgm:constr type="h" for="des" forName="node" refType="w" refFor="des" refForName="node" fact="0.5"/>` +
	`<dgm:constr type="sibSp" refType="w" refFor="des" refForName="node" fact="0.15"/>` +
	`<dgm:constr type="sp" refType="sibSp"/>` +
	`<dgm:constr type="primFontSz" for="des" forName="node" op="equ" val="65"/>` +
	`</dgm:constrLst>` +
	`<dgm:ruleLst/>` +
	`<dgm:forEach name="hierarchyRepeat" axis="ch" ptType="node">` +
	`<dgm:layoutNode name="root">` +
	`<dgm:alg type="hierRoot"/>${SHAPE_NONE}<dgm:presOf/>` +
	`<dgm:constrLst/>` +
	`<dgm:ruleLst/>${HIERARCHY_TEXT_NODE}<dgm:layoutNode name="children">` +
	`<dgm:alg type="hierChild"><dgm:param type="linDir" val="fromL"/></dgm:alg>${
		SHAPE_NONE
	}<dgm:presOf/>` +
	`<dgm:constrLst/>` +
	`<dgm:ruleLst/>${HIERARCHY_CONNECTOR_FOR_EACH}<dgm:forEach ref="hierarchyRepeat"/>` +
	`</dgm:layoutNode>` +
	`</dgm:layoutNode>` +
	`</dgm:forEach>` +
	`</dgm:layoutNode>`;
