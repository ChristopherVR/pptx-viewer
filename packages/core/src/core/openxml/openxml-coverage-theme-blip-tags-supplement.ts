import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['drawing:element:extraClrScheme', 'drawing:element:extraClrSchemeLst'], {
	parse: 'unassessed',
	preserve: 'native',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'A theme carrying `a:extraClrSchemeLst` (alternate colour-scheme variants) survives both an untouched save and the one public theme-editing API (`updateThemeColorScheme`, which re-parses the theme file fresh and patches only `a:clrScheme`, leaving the sibling list untouched). The separate `masterThemeExtraClrSchemeLst` capture / `buildThemeXml` reconstruction path in `PptxHandlerRuntimeSaveTheme.ts` (`markThemeDirty`) is never invoked by any public caller, so it is not exercised or claimed here; only the black-box preserve behaviour is evidenced.',
	evidence: [
		testEvidence(
			'src/__tests__/integration/theme-extra-clr-scheme-and-override.test.ts',
			[
				'survives a no-edit load -> save round trip byte-for-byte',
				'survives an in-place theme colour-scheme edit as untouched sibling data',
			],
			['preserve'],
		),
	],
});

assign(['drawing:element:themeElements'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'The `a:themeElements` container (clrScheme + fontScheme + fmtScheme) is read, edited (via `updateThemeColorScheme`), and re-serialized in schema order through the one public theme-editing API, with the untouched siblings (fontScheme, fmtScheme) surviving the edit intact.',
	evidence: [
		testEvidence('src/__tests__/integration/theme-extra-clr-scheme-and-override.test.ts', [
			'survives an in-place theme colour-scheme edit as untouched sibling data',
		]),
	],
});

assign(['drawing:element:themeOverride'], {
	parse: 'native',
	preserve: 'native',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: "A layout's `a:themeOverride` (via its relationship) correctly substitutes the colour scheme for the duration of parsing slides on that layout, and the substitution is reliably reverted afterwards rather than leaking into later theme resolution. The override PART itself survives a no-edit save (nothing in the writer touches `ppt/theme/themeOverride*.xml`). There is no public API to author or edit a theme override's own content, so edit/serialize stay unassessed rather than assumed.",
	evidence: [
		testEvidence(
			'src/__tests__/integration/theme-extra-clr-scheme-and-override.test.ts',
			[
				"resolves a slide's schemeClr against the layout's themeOverride, not the main theme",
				'restores the global theme state after the overridden slide, rather than leaking it',
			],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/theme-extra-clr-scheme-and-override.test.ts',
			['survives a no-edit load -> save round trip: the override part is never rewritten'],
			['preserve'],
		),
	],
});

assign(
	[
		'presentation:element:blipFill',
		'drawing:element:blip',
		'drawing:complexType:CT_Blip',
		'drawing:complexType:CT_BlipFillProperties',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: '`p:blipFill`/`a:blip` (CT_BlipFillProperties/CT_Blip) as CONTAINERS: the `@r:embed` relationship resolves to the correct media part, and an edit to one child (crop / `a:srcRect`) coexists correctly with every other child and attribute the SAME blip carries (`@bright`/`@contrast`, `a:duotone`, `a:tint`), because the save writer mutates the original parsed node in place rather than rebuilding it - so an attribute nothing in this codebase models (`@cstate`) survives an edit to a sibling child, for free. Evidence is from the picture path (`p:blipFill` on `p:pic`); the sibling shape-fill element `a:blipFill` (`drawing:element:blipFill`, used to fill a shape/group with a picture via `spPr`) shares the same `CT_BlipFillProperties` type but has no dedicated container-level test and stays unassessed.',
		evidence: [
			testEvidence('src/__tests__/integration/blip-blipfill-container.test.ts', [
				"resolves the picture's @r:embed relationship into imageData through blipFill/blip",
				'edits crop (a:srcRect) and image effects (blip attributes/children) together, in the same blipFill',
				'preserves an unmodelled a:blip attribute (@cstate) across an edit to a sibling child',
			]),
		],
	},
);

assign(['presentation:attribute:showMasterPhAnim'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: '`p:sldLayout/@showMasterPhAnim` is parsed with the correct absent-means-true default, carried on the typed `PptxSlideLayout.showMasterPhAnim`, survives an untouched save, and round-trips an edit (including writing an explicit `="1"` rather than only omitting the attribute).',
	evidence: [
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['defaults to undefined (spec default: true) when the attribute is absent'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['survives an unrelated save untouched when nobody edited it (no slideMasters option)'],
			['preserve'],
		),
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			[
				'parses an explicit @showMasterPhAnim="0" as false',
				'round-trips an edit through the typed model: false -> XML -> parsed false again',
				'writes @showMasterPhAnim="1" for an explicit true (not just omitted)',
			],
			['parse', 'edit', 'serialize'],
		),
	],
});

assign(['presentation:attribute:embedTrueTypeFonts'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: "`p:presentation/@embedTrueTypeFonts` is modelled: parsed onto `PptxData.embedTrueTypeFonts` (absent stays `undefined` rather than being forced to the spec default), editable via the `embedTrueTypeFonts` save option, and written by `PptxPresentationSaveBuilder.applyEmbedTrueTypeFonts` (always the literal `1`/`0` for an explicit value, never just omitted for `false`). It stays purely declarative: this library only ever embeds fonts a caller explicitly supplies via `embeddedFontList`/`embeddedFonts` (there is no automatic embed-on-save), so the flag does not gate anything here - it only round-trips the author's stated preference. `@saveSubsetFonts` is a separate, deliberately unimplemented flag (no glyph subsetting) that does not interact with this one.",
	evidence: [
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['defaults to undefined (spec default: false) when the attribute is absent'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['parses an explicit @embedTrueTypeFonts="1" as true onto the typed model'],
			['parse'],
		),
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['survives an unrelated save as raw passthrough on the presentation root'],
			['preserve'],
		),
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['round-trips an edit through the typed model: true -> XML -> parsed true again'],
			['edit', 'serialize'],
		),
		testEvidence(
			'src/__tests__/integration/presentation-structure-flags.test.ts',
			['writes @embedTrueTypeFonts="0" for an explicit false (not just omitted)'],
			['edit', 'serialize'],
		),
	],
});

assign(['presentation:element:smartTags', 'presentation:complexType:CT_SmartTags'], {
	parse: 'unassessed',
	preserve: 'native',
	edit: 'unsupported',
	serialize: 'unassessed',
	note: "`p:smartTags` (CT_SmartTags, a bare `@r:id` child of `p:presentation`) points at a smart-tag RECOGNIZER part (`p:smartTagLst`/`p:smartTagType`) - a distinct, legacy Office feature unrelated to the user-defined `p:tags` construct (see `presentation:element:tags` for that one, now fully authored). This codebase has no data model for recognizer content at all, so there is no way to create or edit one through the public API; only preserve is promoted. An element already authored by a real generator survives a no-edit save because the owning part's XML is mutated in place and re-emitted wholesale, not because anything models the element.",
	evidence: [
		testEvidence(
			'src/__tests__/integration/smarttags-and-tags-reference.test.ts',
			['preserves an authored <p:smartTags r:id=".."/> through a no-edit round trip'],
			['preserve'],
		),
		testEvidence(
			'src/__tests__/integration/smarttags-and-tags-reference.test.ts',
			[
				'authors a <p:tags r:id=".."/> element matching the relationship for a brand-new presentation-owned tag collection (gap fixed)',
			],
			['edit'],
		),
	],
});

export const OPENXML_THEME_BLIP_TAGS_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
