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
		edit: 'unassessed',
		serialize: 'unassessed',
		note: 'The master fallback cascade (an unstyled placeholder run inherits its level style from the master\'s `p:titleStyle`/`p:bodyStyle`/`p:otherStyle` according to the placeholder\'s family - title/ctrTitle -> titleStyle, body/obj/subtitle -> bodyStyle, everything else -> otherStyle) is genuinely implemented (`parseMasterTxStyles`, `lookupPlaceholderDefaults`) and survives a no-edit round trip. FINDING: there is no edit API - `PptxHandlerRuntimeSaveSlideMaster.ts` documents in its own header that `txStyles` is one of the fields "not part of the typed model" and "left untouched, preserving them verbatim across the round-trip". No test demonstrates the lack of an edit path directly, so `edit`/`serialize` are left unassessed rather than a fabricated grade.',
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
		],
	},
);

assign(['presentation:element:defaultTextStyle'], {
	parse: 'native',
	preserve: 'native',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: "`p:defaultTextStyle` on the presentation is the last-resort fallback applied to EVERY shape (placeholder or not) whose local/inherited cascade leaves a field undefined - a non-placeholder text box with no styling correctly inherits from it, and a placeholder's own cascade (layout/master, including the title/body/other txStyles) still outranks it, both `applyPlaceholderBodyDefaults` calls in `PptxHandlerRuntimeShapeParsing.ts` only fill still-undefined slots. It survives a no-edit round trip. There is no public API to edit it (the presentation-save builder never touches it), so edit/serialize are not claimed.",
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
	],
});

export const OPENXML_MASTER_TEXT_STYLE_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
