import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'drawing:element:rPr',
		'drawing:element:defRPr',
		'drawing:element:endParaRPr',
		'drawing:complexType:CT_TextCharacterProperties',
		'drawing:element:latin',
		'drawing:element:ea',
		'drawing:element:cs',
		'drawing:element:sym',
		'drawing:complexType:CT_TextFont',
		'drawing:element:highlight',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Run/default/end-paragraph character properties (size, bold, italic, underline plus style, strikethrough plus type, caps, baseline, spacing, kerning, language, rtl) and the per-script typeface elements (latin/ea/cs/sym) are fully typed and round-trip in core. A separate, already-documented gap is that the shared render layer only applies the per-script split in the React binding; that render gap does not affect core parse/serialize.',
		evidence: [
			testEvidence(
				'src/core/utils/text-run-properties-parser.test.ts',
				[
					'parses @_sz=2400 (24pt) to fontSize in px',
					'parses @_b="1" as bold=true',
					'parses @_u="sng" as underline=true, underlineStyle="sng"',
					'parses @_strike="sngStrike" as strikethrough=true, strikeType="sngStrike"',
					'parses @_baseline=30000 for superscript',
					'parses @_lang="en-US"',
					'parses a:latin typeface',
					'parses a:ea typeface as eastAsiaFont',
					'parses a:cs typeface as complexScriptFont',
					'parses a:sym typeface',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveRunProperties.test.ts',
				[
					'should set bold and italic flags',
					'should set underline with default style',
					'should set strikethrough with default type',
					'should set baseline for superscript/subscript',
					'should set character spacing and kerning',
					'should set text caps',
					'should set rtl flag',
					'should set font family for latin, ea, and cs',
					'should use east Asian and complex script overrides',
					'should set symbol font',
					'should set highlight color',
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:element:hlinkClick',
		'drawing:element:hlinkMouseOver',
		'drawing:complexType:CT_Hyperlink',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Run-level hyperlink click and mouse-over actions (relationship id, tooltip, action, invalid-url, target frame, history, highlight-click, end-sound) are fully typed and round-trip, including correct CT_TextCharacterProperties child ordering on save.',
		evidence: [
			testEvidence(
				'src/core/utils/text-run-properties-parser.test.ts',
				[
					'parses @_r:id relationship ID',
					'parses tooltip attribute',
					'parses action attribute',
					'parses all hyperlink attributes',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveRunProperties.test.ts',
				['sequences a:rtl after a:hlinkMouseOver and before a:extLst'],
				['preserve', 'edit', 'serialize'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeTextRoundTripIssue98.test.ts',
				['re-emits the a:snd child on the a:hlinkMouseOver node (was r:id-only)'],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

export const OPENXML_TEXT_RUN_HYPERLINK_COVERAGE: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
