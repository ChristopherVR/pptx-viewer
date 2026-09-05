import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['diagram:element:whole', 'diagram:element:bg'], {
	parse: 'partial',
	preserve: 'partial',
	edit: 'partial',
	serialize: 'partial',
	note: 'dgm:bg solid fill and dgm:whole/ln colour and width are typed, edited, and independently re-serialized. Other fill or line variants on bg or whole remain out of scope, a documented gap rather than a defect.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSmartArtXmlUtils.test.ts',
			[
				'should parse background color from bg solidFill',
				'should parse outline color and width from whole/ln',
				'should parse both background and outline',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/smartart-save-chrome.test.ts',
			[
				'writes background fill as dgm:bg/a:solidFill/a:srgbClr',
				'writes outline colour and width onto dgm:whole/a:ln',
				'preserves existing children on an existing dgm:bg node',
			],
			['preserve', 'edit', 'serialize'],
		),
	],
});

assign(['diagram:element:dir'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'presLayoutVars direction (dir) is parsed and validated against its enum, then consumed by hierarchy layout. No independent edit or re-serialize path was found to evidence.',
	evidence: [
		testEvidence(
			'src/core/utils/smartart-pres-layout-vars.test.ts',
			[
				'parses dir + orgChart from a data-model prSet/presLayoutVars',
				'ignores unrecognised direction / hierBranch enum values',
			],
			['parse'],
		),
	],
});

assign(['diagram:simpleType:ST_CxnType'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Connection type values (parOf, presOf, presParOf) are parsed, validated, edited, and re-serialized as part of the typed CT_Cxn model, including synthesis of new connections of each type.',
	evidence: [
		testEvidence('src/core/core/runtime/smartart-data-model-attributes.test.ts', [
			'parses core identifiers and relationships',
			'serializes supplied identifiers and relationships',
			'edits typed attributes while preserving unknown XML and extLst',
		]),
		testEvidence(
			'src/core/core/runtime/smartart-node-synthesis.test.ts',
			['grafts a full point/connection family for a brand-new top-level node'],
			['parse', 'edit', 'serialize'],
		),
	],
});

assign(['diagram:simpleType:ST_PtType'], {
	parse: 'native',
	preserve: 'native',
	edit: 'partial',
	serialize: 'native',
	note: 'node and asst content points are parsed and user-editable; doc, pres, parTrans, and sibTrans structural point types are recognised and preserved verbatim rather than exposed as editable, matching PowerPoint own non-editable structural points.',
	evidence: [
		testEvidence('src/core/core/runtime/smartart-xml-builders.test.ts', [
			'should handle node with nodeType "pres"',
			'should handle node with nodeType "asst"',
			'preserves doc / pres / parTrans points untouched',
			'preserves a content node nodeType such as "asst"',
		]),
	],
});

assign(
	[
		'diagram:attribute:modelId',
		'diagram:attribute:srcOrd',
		'diagram:attribute:destOrd',
		'diagram:attribute:parTransId',
		'diagram:attribute:sibTransId',
		'diagram:attribute:presId',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Connection identifier and ordering attributes are typed, validated, edited, and re-serialized as part of CT_Cxn, with unknown XML and extLst preserved across an edit.',
		evidence: [
			testEvidence('src/core/core/runtime/smartart-data-model-attributes.test.ts', [
				'parses core identifiers and relationships',
				'rejects a connection missing a required endpoint',
				'serializes supplied identifiers and relationships',
				'edits typed attributes while preserving unknown XML and extLst',
				'supports explicit removal without deleting unspecified attributes',
			]),
		],
	},
);

assign(['diagram:simpleType:ST_HueDir', 'diagram:simpleType:ST_ClrAppMethod'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Colour-list span/cycle/repeat method and cw/ccw hue-direction values are parsed as interpolation metadata for palette resolution. No independent edit or re-serialize path was found to evidence.',
	evidence: [
		testEvidence(
			'src/core/utils/smartart-color-lists.test.ts',
			['captures span method + hue direction interpolation metadata'],
			['parse'],
		),
	],
});

assign(['diagram:attribute:lkTxEntry'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: "Since wave 2 (W2-E), dgm:shape/@lkTxEntry (the 'link text entry' flag marking a layout's decorative shape as mirroring its paired content node's text) is fully typed, editable, and re-serialized (smartart-layout-node-shape.ts: parseSmartArtLkTxEntry / parseSmartArtLkTxEntryFromLayoutNode for read, a surgical merge for write that preserves unrelated dgm:shape attributes). The layout interpreter now honours it too: a pyramid's decorative level-node band keeps its own text instead of going blank when lkTxEntry is set (smartart-layout-interpreter-pyramid.ts). A COM sweep of all 176 built-in Office SmartArt gallery layouts found none that actually author this attribute, so the path is exercised only by hand-built fixtures, not real-world decks.",
	evidence: [
		testEvidence(
			'src/core/utils/smartart-layout-node-shape.test.ts',
			[
				'parses lkTxEntry="1" onto the typed model',
				'omits lkTxEntry from the typed model when absent or "0"',
				'reads lkTxEntry="1" as true',
				'reads lkTxEntry="0" and an absent attribute as false',
				'writes @lkTxEntry="1" back and removes it when cleared',
				'round-trips a parsed lkTxEntry shape unchanged',
			],
			['parse', 'preserve', 'edit', 'serialize'],
		),
	],
});

assign(['diagram:attribute:coherent3DOff'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Since wave 2 (W2-E), dgm:prSet/@coherent3DOff is resolved per data-model point (via its presOf-linked pres point, the same pattern styleRole already uses) into PptxSmartArtNode.coherent3DOff (core/utils/smartart-node-style-role.ts, resolveSmartArtNodeCoherent3DOff). It has no rendering consumer: no scene3d/sp3d SmartArt renderer exists in this project, so disabling the coherent-3D shape variation has nothing to disable yet, and no editor writes the attribute independently, so preserve/edit/serialize are left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/utils/smartart-node-style-role.test.ts',
			[
				'resolves coherent3DOff="1" from the presOf-linked pres point',
				'treats an absent attribute or "0" as not set',
				'returns an empty set when there are no pres points',
			],
			['parse'],
		),
	],
});

export const OPENXML_DIAGRAM_SUPPLEMENT_COVERAGE: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
