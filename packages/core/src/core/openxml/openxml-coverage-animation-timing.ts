import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

// ---------------------------------------------------------------------------
// Animation/timing: base ECMA-376 transition-effect elements + direction attrs
// ---------------------------------------------------------------------------
assign(
	[
		'presentation:element:fade',
		'presentation:element:wipe',
		'presentation:element:split',
		'presentation:element:wheel',
		'presentation:element:cut',
		'presentation:element:blinds',
		'presentation:attribute:dir',
		'presentation:attribute:spokes',
		'presentation:attribute:orient',
		'presentation:attribute:thruBlk',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Base ECMA-376 slide-transition effect elements and their direction/spokes/orientation/through-black attributes are typed and round-trip through parse, build, and reload.',
		evidence: [
			testEvidence(
				'src/core/services/PptxSlideTransitionService.test.ts',
				[
					'parses a basic fade transition',
					'parses a wipe transition with direction',
					'parses a split transition with orientation',
					'parses a wheel transition with spokes',
					'parses thruBlk attribute',
				],
				['parse'],
			),
			testEvidence(
				'src/core/services/PptxSlideTransitionService.test.ts',
				[
					'builds a fade transition XML',
					'builds a wipe transition with direction',
					'builds a split transition with orientation',
					'builds a wheel transition with spokes',
					'builds a cut transition as default',
				],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/services/transition-round-trip.test.ts',
				[
					'should preserve direction attribute on wipe transition',
					'should preserve spokes count on wheel transition',
					'should preserve orient on split transition',
					'should preserve thruBlk on blinds transition',
					'round-trips cut@thruBlk',
				],
				['preserve'],
			),
		],
	},
);

assign(['presentation:element:push'], {
	parse: 'native',
	preserve: 'native',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Parses and survives the direct-child transition reconcile pipeline verbatim; no dedicated build/serialize test was found for its direction attribute, so edit/serialize are left unassessed rather than inferred.',
	evidence: [
		testEvidence(
			'src/core/services/PptxSlideTransitionService.test.ts',
			['parses a push transition'],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/slide-transition-reconcile.test.ts',
			['strips a stale enveloped copy when a brand-new transition is written directly'],
			['preserve'],
		),
	],
});

// ---------------------------------------------------------------------------
// Animation/timing: motion path (animMotion) parameters
// ---------------------------------------------------------------------------
assign(
	[
		'presentation:element:animMotion',
		'presentation:complexType:CT_TLAnimateMotionBehavior',
		'presentation:simpleType:ST_TLAnimateMotionPathEditMode',
		'presentation:attribute:pathEditMode',
		'presentation:attribute:ptsTypes',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Motion-path edit mode and point-type list are typed and round-trip, with a defined fallback when unset. The 66-preset motion-path catalogue itself is an application-level table, not additional schema constructs.',
		evidence: [
			testEvidence('src/core/services/animation-keyframes-round-trip.test.ts', [
				'reads @_pathEditMode and @_ptsTypes',
				'writer emits the configured pathEditMode and ptsTypes',
				'writer falls back to relative pathEditMode and empty ptsTypes when unset',
			]),
		],
	},
);

// ---------------------------------------------------------------------------
// Animation/timing: graphical-object build lists (bldLst/bldP/bldSub/bldGraphic)
// ---------------------------------------------------------------------------
assign(
	[
		'presentation:element:bldLst',
		'presentation:element:bldP',
		'presentation:element:bldGraphic',
		'presentation:element:bldAsOne',
		'presentation:element:bldSub',
		'drawing:element:bldDgm',
		'drawing:element:bldChart',
		'presentation:attribute:build',
		'presentation:attribute:grpId',
		'presentation:attribute:spid',
		'presentation:attribute:animBg',
		'presentation:attribute:bld',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Paragraph build lists (bldP: by paragraph/word/letter) and nested graphical-object builds (bldSub wrapping a diagram or chart build) are typed and round-trip through parse and write.',
		evidence: [
			testEvidence('src/core/services/animation-target-build-helpers.test.ts', [
				'round-trips bldAsOne and unknown XML',
				'round-trips nested diagram build properties',
				'applies schema defaults to nested chart build properties',
				'attaches typed bldSub properties to native animations',
			]),
			testEvidence(
				'src/core/services/animation-write-sequence-builders.test.ts',
				[
					'builds a single bldP entry for byParagraph',
					"builds bldP entry with 'word' type for byWord",
					"builds bldP entry with 'char' type for byLetter",
				],
				['edit', 'serialize'],
			),
			testEvidence(
				'src/core/services/native-animation-helpers.test.ts',
				['applies build level when bldLvl is specified', 'handles multiple bldP entries'],
				['parse'],
			),
		],
	},
);

assign(['presentation:element:bldDgm'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'The top-level p:bldDgm entry (whole-diagram build, distinct from the nested a:bldDgm inside bldSub) is parsed with typed defaults; no dedicated writer test was found, so preserve/edit/serialize are left unassessed rather than inferred.',
	evidence: [
		testEvidence(
			'src/core/services/native-animation-extended-helpers.test.ts',
			['parses single entry with spid and bld'],
			['parse'],
		),
	],
});

export const OPENXML_ANIMATION_TIMING_COVERAGE: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
