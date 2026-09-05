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
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: '`p:photoAlbum` fields (bw, showCaptions, layout, frame, and `@isPhoto`) are parsed into a typed model. Since wave 3 (W3-H), `@isPhoto` round-trips through a full load/save/reload cycle (including writing an explicit `isPhoto="0"` for an authored false, not just omitting the attribute), and CT_Presentation\'s schema-ordered re-emit (utils/xml-reorder.ts reorderObjectKeysByLocalName, used by PptxPresentationSaveBuilder.ts) inserts a freshly-introduced p:photoAlbum in its correct schema position instead of appending it after p:extLst, which real PowerPoint\'s schema validator rejects (CT_ExtensionListModify must stay last).',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimePresentationStructure.test.ts',
				['should parse bw flag', 'should parse layout string', 'should parse frame string'],
				['parse'],
			),
			testEvidence(
				'src/__tests__/integration/presentation-partial-constructs-roundtrip.test.ts',
				[
					'parses, preserves, and re-serializes isPhoto through a full load/save/reload cycle',
					'writes isPhoto="0" for an explicit false value',
					'inserts freshly-introduced photoAlbum and modifyVerifier in schema order',
					'keeps an existing p:extLst (CT_ExtensionListModify) last when photoAlbum is freshly introduced',
				],
				['parse', 'preserve', 'edit', 'serialize'],
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
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: "`p:modifyVerifier` write-protection fields (algorithm, hash, salt, spin count/value, crypto provider) are parsed into a typed model. Since wave 3 (W3-H), it round-trips through PptxPresentationSaveBuilder.ts (a full verifier survives save/reload, and setting it to null explicitly removes it), and CT_Presentation's schema-ordered re-emit (utils/xml-reorder.ts reorderObjectKeysByLocalName) inserts a freshly-introduced p:modifyVerifier in its correct schema position rather than appending it after p:extLst, which real PowerPoint's schema validator rejects.",
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
			testEvidence(
				'src/__tests__/integration/presentation-partial-constructs-roundtrip.test.ts',
				[
					'round-trips a full write-protection verifier through save/reload',
					'removes the verifier when explicitly set to null',
					'inserts freshly-introduced photoAlbum and modifyVerifier in schema order',
				],
				['parse', 'preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'presentation:element:tagLst',
		'presentation:element:tag',
		'presentation:element:tags',
		'presentation:complexType:CT_TagList',
		'presentation:complexType:CT_StringTag',
		'presentation:complexType:CT_TagsData',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'User-defined tags parts (`tags/tagN.xml`, root `p:tagLst`/`p:tag`) are authored, relationship-owned by either the presentation or a slide, and reloaded with unknown XML preserved. The owning `<p:tags r:id="..">` element (CT_TagsData, a sibling of `p:custData` inside `p:custDataLst`) is authored alongside the relationship when a collection is created, and removed - along with the relationship, the part, and its content-type override - when a collection is cleared to zero tags; previously only the relationship was written, an authoring gap real PowerPoint keys its smart-tags UI off of.',
		evidence: [
			testEvidence('src/__tests__/integration/tag-part-authoring.test.ts', [
				'authors a presentation-owned collection by default and reloads ownership',
				'authors the owning <p:tags r:id> element referencing the same relationship id (structural gap fix)',
				'removes the owning element, relationship, part, and content-type override when a collection is cleared',
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
