import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

const TEST_FILE = 'src/__tests__/integration/master-txstyles-default-text-style.test.ts';

assign(
	[
		'presentation:element:txStyles',
		'presentation:element:titleStyle',
		'presentation:element:bodyStyle',
		'presentation:element:otherStyle',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: "The master fallback cascade (an unstyled placeholder run inherits its level style from the master's `p:titleStyle`/`p:bodyStyle`/`p:otherStyle` according to the placeholder's family - title/ctrTitle -> titleStyle, body/obj/subtitle -> bodyStyle, everything else -> otherStyle) is genuinely implemented (`parseMasterTxStyles`, `lookupPlaceholderDefaults`) and survives a no-edit round trip. An edit path now exists: `PptxHandlerRuntimeSaveSlideMaster.ts` calls `applyMasterTextStyles` (`master-text-style-writer.ts`) when `PptxSlideMaster.txStyles` is set, merging each edited level via `serializePlaceholderLevelStyle` (`placeholder-level-style-serializer.ts`) into the existing `a:lvlXpPr`/`a:defPPr` node rather than rebuilding it, so untouched categories/levels and unmodelled attributes/children (bullet fonts, theme font refs, @kern, ...) survive in their original schema position.",
		evidence: [
			testEvidence(
				TEST_FILE,
				[
					'resolves an unstyled title placeholder run from p:titleStyle (44pt)',
					'resolves an unstyled body placeholder run from p:bodyStyle (32pt) including its bullet',
					"resolves a non-title/body placeholder ('ftr') from p:otherStyle, not p:bodyStyle",
				],
				['parse'],
			),
			testEvidence(
				TEST_FILE,
				['re-emits titleStyle/bodyStyle/otherStyle and defaultTextStyle verbatim'],
				['preserve'],
			),
			testEvidence(
				TEST_FILE,
				[
					'edits titleStyle level 0 font size while preserving bodyStyle/otherStyle and unmodelled XML',
				],
				['edit', 'serialize'],
			),
		],
	},
);

assign(['presentation:element:defaultTextStyle'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: "`p:defaultTextStyle` on the presentation is the last-resort fallback applied to EVERY shape (placeholder or not) whose local/inherited cascade leaves a field undefined - a non-placeholder text box with no styling correctly inherits from it, and a placeholder's own cascade (layout/master, including the title/body/other txStyles) still outranks it, both `applyPlaceholderBodyDefaults` calls in `PptxHandlerRuntimeShapeParsing.ts` only fill still-undefined slots. It survives a no-edit round trip, is exposed as `PptxData.defaultTextStyle`, and is editable via the `defaultTextStyle` save option: `PptxPresentationSaveBuilder` calls `applyPresentationDefaultTextStyle` (`master-text-style-writer.ts`), the same merge-in-place writer as the master's txStyles, keeping `p:defaultTextStyle` in its CT_Presentation schema position (before `p:modifyVerifier`/`p:extLst`).",
	evidence: [
		testEvidence(
			TEST_FILE,
			[
				'falls back to the presentation p:defaultTextStyle for a non-placeholder text box (18pt)',
				'lets a placeholder cascade win over the presentation default (title != 18pt default)',
			],
			['parse'],
		),
		testEvidence(
			TEST_FILE,
			['re-emits titleStyle/bodyStyle/otherStyle and defaultTextStyle verbatim'],
			['preserve'],
		),
		testEvidence(
			TEST_FILE,
			['edits the presentation defaultTextStyle level 0 font size via the save option'],
			['edit', 'serialize'],
		),
	],
});

export const OPENXML_MASTER_TEXT_STYLE_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
