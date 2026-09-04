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
		'drawing:complexType:CT_TextNoAutofit',
		'drawing:complexType:CT_TextNormalAutofit',
		'drawing:element:noAutofit',
		'drawing:element:normAutofit',
		'drawing:element:spAutoFit',
		'drawing:attribute:fontScale',
		'drawing:attribute:lnSpcReduction',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'The bodyPr autofit family (spAutoFit, noAutofit, normAutofit including fontScale and lnSpcReduction) is fully typed, editable, and serialized. A separate, already-documented gap covers the RENDER layer mapping spAutoFit to a shrink-text behavior instead of a resize-shape behavior; that is out of scope for parse/preserve/edit/serialize.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeShapeBodyParsing.test.ts',
				[
					'should parse a:spAutoFit as shrink mode',
					'should parse a:noAutofit as none mode',
					'should parse a:normAutofit as normal mode',
					'should parse font scale from a:normAutofit',
					'should parse line spacing reduction from a:normAutofit',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveTextWriter.test.ts',
				[
					'should set none mode (noAutofit)',
					'should use legacy autoFit with font scale to create normAutofit',
					'should remove autofit when autoFit is false',
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(['drawing:element:prstTxWarp', 'drawing:simpleType:ST_TextShapeType'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'WordArt text-warp presets (ST_TextShapeType) and their avLst adjustment guides (adj/adj2, including negative values) parse and re-serialize losslessly.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeShapeBodyParsing.test.ts',
			[
				'should parse preset name without adjustment values',
				'should parse single adj value',
				'should parse both adj and adj2 values',
				'should handle negative adjustment values',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeShapeBodyParsing.test.ts',
			[
				'should build node with preset only when no adj values',
				'should include adj in avLst',
				'should include both adj and adj2 in avLst as array',
			],
			['preserve', 'edit', 'serialize'],
		),
	],
});

assign(['drawing:element:pPr', 'drawing:complexType:CT_TextParagraphProperties'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Paragraph properties (alignment, rtl, level, margins/indent, line/before/after spacing, tab defaults, east-Asian/Latin line-break and hanging-punctuation flags) are fully typed and round-trip.',
	evidence: [
		testEvidence(
			'src/core/utils/paragraph-properties-parser.test.ts',
			[
				'maps "l" to "left"',
				'parses @_marL in EMU to px',
				'parses a:spcPts val=1200 (12pt) to px',
				'clamps negative levels to 0',
				'parses @_eaLnBrk="1" as eaLineBreak=true',
				'parses @_fontAlgn="base" as fontAlignment',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSaveParagraphHelpers.test.ts',
			[
				'should set alignment attribute',
				'should convert paragraph margins from px to EMU',
				'buildParagraphPropertiesXml emits a:lnSpc before a:spcBef before a:spcAft',
				'should set eaLineBreak, latinLineBreak, fontAlignment, and hangingPunctuation',
			],
			['preserve', 'edit', 'serialize'],
		),
	],
});

assign(
	[
		'drawing:element:tabLst',
		'drawing:element:tab',
		'drawing:complexType:CT_TextTabStop',
		'drawing:complexType:CT_TextTabStopList',
		'drawing:simpleType:ST_TextTabAlignType',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Tab stop position, per-stop alignment, and leader glyphs are typed and round-trip in core. A separate, already-documented gap is that the shared render layer cannot yet express per-stop alignment or leader dots visually in 4 of 5 bindings; that render gap does not affect core parse/serialize.',
		evidence: [
			testEvidence(
				'src/core/utils/paragraph-properties-parser.test.ts',
				[
					'parses a single tab stop',
					'parses multiple tab stops with different alignments',
					'parses tab with leader',
					'parses tab leader types: dot, hyphen, underscore',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveParagraphHelpers.test.ts',
				[
					'should serialize tab stops with position, align, and leader',
					"should omit left-aligned tab's algn attribute",
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(
	[
		'drawing:element:buChar',
		'drawing:element:buNone',
		'drawing:element:buAutoNum',
		'drawing:element:buFont',
		'drawing:element:buSzPct',
		'drawing:element:buSzPts',
		'drawing:element:buClr',
		'drawing:complexType:CT_TextCharBullet',
		'drawing:complexType:CT_TextNoBullet',
		'drawing:complexType:CT_TextAutonumberBullet',
		'drawing:simpleType:ST_TextAutonumberScheme',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Bullet character, none, auto-number (all 41 ST_TextAutonumberScheme values), font, size (percent and points), and themed/plain colour are fully typed and round-trip.',
		evidence: [
			testEvidence(
				'src/core/utils/paragraph-properties-parser.test.ts',
				[
					'returns { none: true } for a:buNone',
					'parses a:buChar with bullet character',
					'parses a:buChar with buFont',
					'parses a:buChar with buSzPct',
					'parses a:buChar with buSzPts',
					'parses a:buChar with buClr (srgbClr)',
					'parses a:buAutoNum with arabicPeriod',
				],
				['parse'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimePlaceholderStyles.test.ts',
				[
					'resolves a themed a:schemeClr bullet colour to the theme accent1',
					'resolves an a:sysClr bullet colour via its lastClr',
				],
				['parse'],
			),
			testEvidence(
				'src/core/utils/auto-number-format.test.ts',
				['covers every ST_TextAutonumberScheme value in the enumeration'],
				['parse', 'edit'],
			),
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeSaveParagraphHelpers.test.ts',
				[
					'should set buNone when bullet.none is true',
					'should set bullet font',
					'should set bullet size percentage',
					'should set bullet size in points',
					'should set bullet color and strip # prefix',
					'should set bullet char',
					'should set auto-numbered bullet with type and start',
					'should omit startAt when it equals 1',
				],
				['preserve', 'edit', 'serialize'],
			),
		],
	},
);

assign(['drawing:element:buBlip', 'drawing:complexType:CT_TextBlipBullet'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Picture bullets round-trip including tile, stretch, srcRect and blip extLst modifiers. A previously-tracked bug where save reconstructed a bare r:embed and discarded those modifiers has been fixed and is now regression-tested.',
	evidence: [
		testEvidence('src/core/core/runtime/PptxHandlerRuntimeSaveParagraphHelpers.test.ts', [
			'should set image bullet',
			're-emits the captured a:buBlip subtree verbatim, preserving tile/stretch/srcRect',
			'load -> save round-trip: a picture bullet with a:tile survives verbatim',
		]),
	],
});

assign(
	[
		'drawing:element:buFontTx',
		'drawing:element:buClrTx',
		'drawing:element:buSzTx',
		'drawing:complexType:CT_TextBulletTypefaceFollowText',
		'drawing:complexType:CT_TextBulletColorFollowText',
		'drawing:complexType:CT_TextBulletSizeFollowText',
	],
	{
		parse: 'unassessed',
		preserve: 'unassessed',
		edit: 'native',
		serialize: 'native',
		note: 'The bullet inherit-from-text markers (buFontTx/buClrTx/buSzTx) are typed and correctly emitted on save, taking precedence over explicit bullet declarations. No core-package test was found exercising the parse (read-back) side specifically, so parse and preserve are left unassessed rather than assumed.',
		evidence: [
			testEvidence(
				'src/core/core/runtime/PptxHandlerRuntimeBulletParsing.inheritTx.test.ts',
				[
					'emits <a:buFontTx/> when fontInherit is set',
					'emits <a:buClrTx/> when colorInherit is set',
					'emits <a:buSzTx/> when sizeInherit is set',
					'inherit variants take precedence over explicit declarations',
				],
				['edit', 'serialize'],
			),
		],
	},
);

assign(['drawing:simpleType:ST_TextAnchoringType'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: "a:bodyPr/@anchor's dist (distributed) and just (justified) values, previously collapsed into plain centering (ctr) on both parse and re-save, now round-trip as their own typed vAlign values (issue D2-G5) instead of being silently rewritten to ctr on any edit that touches the shape. The shared render layer still lays the two out as vertically centered, not PowerPoint's true inter-line distribution/justification, which is a render-only approximation this manifest does not score. No dedicated round-trip integration test was found, so preserve is left unassessed rather than assumed.",
	evidence: [
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeShapeImageFill.test.ts',
			[
				"should return 'distributed' for 'dist', not collapse it to 'middle' (D2-G5)",
				"should return 'justified' for 'just', not collapse it to 'middle' (D2-G5)",
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/PptxHandlerRuntimeSaveImageEffects.test.ts',
			[
				"should map 'distributed' to 'dist' (D2-G5, not collapsed to 'ctr')",
				"should map 'justified' to 'just' (D2-G5, not collapsed to 'ctr')",
			],
			['edit', 'serialize'],
		),
	],
});

export const OPENXML_TEXT_AUTOFIT_PARAGRAPH_BULLET_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
