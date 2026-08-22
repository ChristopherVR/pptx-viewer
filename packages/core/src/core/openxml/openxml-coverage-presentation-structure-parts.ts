import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['presentation:attribute:show'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Hidden-slide flag: honours both `p:sld/@show` and the `p:sldIdLst/p:sldId/@show` fallback, and writes it back only when a slide is actually hidden.',
	evidence: [
		testEvidence('src/__tests__/integration/hidden-slide-roundtrip.test.ts', [
			'writes p:sld/@show="0" for a hidden slide and nothing for a visible one',
			'reloads the hidden flag on exactly the slide it was set on',
			'clears the flag when a slide is un-hidden',
		]),
	],
});

assign(['presentation:attribute:showMasterSp'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Typed boolean gate for inherited master shapes, parsed on both slides and layouts. No save writer exists for it (read-only in this editor), so only parse is assessed.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSlideParsing.test.ts',
			[
				"should return true when showMasterSp is '1'",
				"should return false when showMasterSp is '0'",
			],
			['parse'],
		),
	],
});

assign(['presentation:attribute:matchingName', 'presentation:attribute:userDrawn'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Slide-layout `@matchingName` and `@userDrawn` are parsed, editable through the master model, and persisted on save.',
	evidence: [
		testEvidence('src/core/core/runtime/PptxHandlerRuntimeSaveMastersAndLayouts.test.ts', [
			'persists `@matchingName`, `@preserve`, and `clrMapOverride` mutations',
		]),
	],
});

assign(['presentation:attribute:preserve'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Assessed for the layout-level owner (CT_SlideLayout/@preserve), which is genuinely typed and round-tripped. The master-level owner (CT_SlideMaster/@preserve) is a separate, documented gap; this shared attribute name is graded on the layout support that exists.',
	evidence: [
		testEvidence('src/core/core/runtime/PptxHandlerRuntimeSaveMastersAndLayouts.test.ts', [
			'persists `@matchingName`, `@preserve`, and `clrMapOverride` mutations',
		]),
	],
});

assign(
	[
		'presentation:attribute:isPhoto',
		'presentation:complexType:CT_PhotoAlbum',
		'presentation:element:photoAlbum',
		'presentation:simpleType:ST_PhotoAlbumFrameShape',
		'presentation:simpleType:ST_PhotoAlbumLayout',
	],
	{
		parse: 'partial',
		preserve: 'unassessed',
		edit: 'unassessed',
		serialize: 'unassessed',
		note: '`p:photoAlbum` fields (bw, showCaptions, layout, frame) are parsed into a typed model. Only the parse path has direct test coverage; no round-trip or edit test was found, so the other facets stay unassessed.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimePresentationStructure.test.ts',
				['should parse bw flag', 'should parse layout string', 'should parse frame string'],
				['parse'],
			),
		],
	},
);

assign(
	[
		'presentation:complexType:CT_ModifyVerifier',
		'presentation:element:modifyVerifier',
		'presentation:complexType:CT_ExtensionListModify',
	],
	{
		parse: 'partial',
		preserve: 'unassessed',
		edit: 'unassessed',
		serialize: 'unassessed',
		note: '`p:modifyVerifier` write-protection fields (algorithm, hash, salt, spin count/value, crypto provider) are parsed into a typed model. Only parse has direct test coverage; no round-trip test exercising PptxPresentationSaveBuilder writer was found.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimePresentationStructure.test.ts',
				[
					'should parse algorithm name',
					'should parse hash and salt data',
					'should parse cryptographic provider details',
				],
				['parse'],
			),
		],
	},
);

assign(
	[
		'presentation:element:tagLst',
		'presentation:element:tag',
		'presentation:complexType:CT_TagList',
		'presentation:complexType:CT_StringTag',
		'presentation:complexType:CT_TagsData',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'User-defined tags parts (`tags/tagN.xml`, root `p:tagLst`/`p:tag`) are authored, relationship-owned by either the presentation or a slide, and reloaded with unknown XML preserved.',
		evidence: [
			testEvidence('src/__tests__/integration/tag-part-authoring.test.ts', [
				'authors a presentation-owned collection by default and reloads ownership',
				'authors slide-owned tags and preserves unknown XML on dirty reload',
			]),
		],
	},
);

assign(
	[
		'presentation:element:custData',
		'presentation:element:custDataLst',
		'presentation:complexType:CT_CustomerData',
		'presentation:complexType:CT_CustomerDataList',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Presentation- and slide-level `custDataLst`/`custData` entries are authored with collision-free relationship parts, schema-ordered, and dirty-saved while preserving unknown entry XML.',
		evidence: [
			testEvidence('src/__tests__/integration/customer-data-authoring.test.ts', [
				'authors presentation customer data with collision-free parts and schema ordering',
				'dirty-saves slide customer data while preserving tags and raw entry XML',
			]),
		],
	},
);

assign(
	[
		'presentation:element:bg',
		'presentation:element:bgPr',
		'presentation:element:bgRef',
		'presentation:complexType:CT_Background',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Slide/layout/master backgrounds (theme `bgRef`, explicit `bgPr` fills incl. image fills, or no background at all) round-trip through the typed master/layout model.',
		evidence: [
			testEvidence('src/__tests__/integration/master-layout-background-roundtrip.test.ts', [
				'keeps a themed `p:bgRef` when nobody edited the background',
				'replaces `p:bgRef` with an explicit `p:bgPr` when a colour is chosen',
				'persists a layout background chosen through `slideMasters[].layouts[]`',
				'leaves an unedited layout with no `p:bg` at all, as PowerPoint does',
			]),
			testEvidence('src/__tests__/integration/background-round-trip.test.ts', [
				'preserves <a:blipFill> inside <p:bg> after save for slide2 and slide3',
			]),
		],
	},
);

assign(['presentation:element:cNvSpPr'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'The PresentationML `p:cNvSpPr` wrapper is parsed for both its `@txBox` flag and nested lock state, and both are re-emitted together on save.',
	evidence: [
		testEvidence('src/__tests__/integration/shape-locks-txbox-roundtrip.test.ts', [
			'serializes a:spLocks from element.locks on a model-built shape',
			'parses @txBox="1" back into the model and re-emits it on a rebuild',
			'parses @txBox and a:spLocks together from an existing shape',
		]),
	],
});

assign(
	[
		'presentation:element:oleObj',
		'presentation:complexType:CT_OleObject',
		'presentation:complexType:CT_OleObjectEmbed',
		'presentation:complexType:CT_OleObjectLink',
		'presentation:attribute:showAsIcon',
		'presentation:attribute:imgW',
		'presentation:attribute:imgH',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Embedded vs. linked OLE objects, icon display, and preview image dimensions are typed; a new embedding is authored with its relationship and content type, and an existing one round-trips with progId/name preserved.',
		evidence: [
			testEvidence(
				'src/core/core/builders/PptxGraphicFrameParser.test.ts',
				[
					'captures showAsIcon, imgW, and imgH typed fields from p:oleObj attributes',
					'treats a p:oleObj with a <p:embed> child as embedded (isLinked=false)',
					'treats a p:oleObj with a <p:link> child + External rel as linked (isLinked=true)',
				],
				['parse'],
			),
			testEvidence(
				'src/__tests__/integration/ole-save-roundtrip.test.ts',
				[
					'authors the embedded payload, relationship, and content type',
					'oLE element loaded from rawXml round-trips with progId / name preserved',
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

export const OPENXML_PRESENTATION_STRUCTURE_PARTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
