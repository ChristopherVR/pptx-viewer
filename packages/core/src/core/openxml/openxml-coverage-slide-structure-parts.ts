import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['presentation:element:contentPart'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Ink `p:contentPart` references round-trip as a direct spTree child, and their referenced InkML payload decodes into typed stroke data.',
	evidence: [
		testEvidence('src/__tests__/integration/contentpart-save-roundtrip.test.ts', [
			'round-trips contentPart as a direct child of spTree (not inside p:sp)',
		]),
		testEvidence(
			'src/core/utils/inkml-content-part.test.ts',
			['decodes a raw traceFormat/trace part into an SVG M..L.. path'],
			['parse'],
		),
	],
});

assign(['presentation:element:spTree'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'The shape-tree container preserves authored child document order (mixed shapes, groups, connectors, frames, ink) through an edit-and-save cycle.',
	evidence: [
		testEvidence('src/core/core/runtime/template-sp-tree-order.test.ts', [
			'preserves the spTree child sequence through a no-edit save',
		]),
		testEvidence('src/__tests__/integration/save-invariants.test.ts', [
			'preserves the exact child sequence of every p:spTree',
		]),
		testEvidence(
			'src/__tests__/integration/contentpart-save-roundtrip.test.ts',
			['round-trips contentPart as a direct child of spTree (not inside p:sp)'],
			['parse', 'edit'],
		),
	],
});

assign(['presentation:element:grpSp', 'presentation:element:grpSpPr'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Shape groups, including nested groups on a template layout, can be moved, retyped, and written back while keeping their children in document order.',
	evidence: [
		testEvidence('src/__tests__/integration/template-group-editing-roundtrip.test.ts', [
			'writes a moved + retyped layout group back into the layout part',
			'keeps the group children in document order across the write-back',
		]),
	],
});

assign(['presentation:element:cxnSp'], {
	parse: 'native',
	preserve: 'native',
	edit: 'unassessed',
	serialize: 'native',
	note: 'Connector shapes are typed on parse (shape/type detection) and keep their position in document order across a save. No dedicated connector-editing test was found, so edit stays unassessed.',
	evidence: [
		testEvidence(
			'src/core/core/builders/connector-parser.test.ts',
			['parses straightConnector1 as connector type'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/save-invariants.test.ts',
			['preserves the exact child sequence of every p:spTree'],
			['preserve', 'serialize'],
		),
	],
});

assign(['presentation:element:graphicFrame'], {
	parse: 'native',
	preserve: 'native',
	edit: 'partial',
	serialize: 'native',
	note: 'Graphic frames (tables, charts, OLE, SmartArt) are typed on parse and keep document order across a save; edit is assessed only for its lock sub-feature (`graphicFrameLocks`), not general frame-content editing.',
	evidence: [
		testEvidence(
			'src/core/core/builders/PptxGraphicFrameParser.test.ts',
			['detects OLE graphic frames by URI'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/save-invariants.test.ts',
			['preserves the exact child sequence of every p:spTree'],
			['preserve', 'serialize'],
		),
		testEvidence(
			'src/__tests__/integration/graphic-frame-locks-roundtrip.test.ts',
			['persists a lock added to a chart through the model'],
			['edit'],
		),
	],
});

assign(
	[
		'presentation:element:hf',
		'presentation:complexType:CT_HeaderFooter',
		'presentation:attribute:hdr',
		'presentation:attribute:ftr',
		'presentation:attribute:dt',
		'presentation:attribute:sldNum',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Header/footer visibility flags drive real placeholder inheritance (footer/date/slide-number type-matched master fallback), and an edited footer is written back as a per-slide override while an untouched one stays empty.',
		evidence: [
			testEvidence('src/core/core/runtime/placeholder-text-inheritance.test.ts', [
				'keeps the empty ftr placeholder and resolves the master footer onto it',
				'resolves date and slide-number transforms through the type-matched master placeholder',
				'writes a per-slide override once the footer text is actually edited',
			]),
		],
	},
);

assign(
	[
		'presentation:element:ph',
		'presentation:complexType:CT_Placeholder',
		'presentation:attribute:idx',
	],
	{
		parse: 'native',
		preserve: 'unassessed',
		edit: 'unassessed',
		serialize: 'unassessed',
		note: '`p:ph`/@idx-driven inheritance matching (idx primary, type secondary) is typed and tested. Placeholder identity is not independently edited or re-serialized in this codebase, so only parse is assessed.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimePlaceholderLookup.test.ts',
				[
					'should extract idx from p:ph',
					'should extract all fields from p:ph',
					'should match by idx when both have idx',
					'should not match when idx matches but type differs',
				],
				['parse'],
			),
		],
	},
);

assign(['presentation:simpleType:ST_PlaceholderType'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'All 16 spec placeholder types plus extended values are validated and normalised on parse. No dedicated round-trip test was found for this enum specifically.',
	evidence: [
		testEvidence(
			'src/core/utils/placeholder-validation.test.ts',
			[
				'returns true for core OOXML placeholder types',
				'returns true for extended placeholder types',
				'returns false for invalid placeholder types',
			],
			['parse'],
		),
	],
});

assign(['presentation:element:sldLayoutIdLst', 'presentation:element:sldLayoutId'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Layout ordering follows `p:sldLayoutIdLst`/`p:sldLayoutId` rather than raw relationship order, including the single-entry (non-array) XML shape. No dedicated save/round-trip test was found for this list.',
	evidence: [
		testEvidence(
			'src/core/utils/slide-layout-order.test.ts',
			[
				'follows p:sldLayoutIdLst rather than relationship order',
				'appends layouts no sldLayoutId points at',
				'handles a single sldLayoutId parsed as an object rather than an array',
			],
			['parse'],
		),
	],
});

export const OPENXML_SLIDE_STRUCTURE_PARTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
