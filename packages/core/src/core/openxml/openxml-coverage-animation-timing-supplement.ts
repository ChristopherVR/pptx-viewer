/**
 * Animation-timing coverage closed in the 2026-09 ECMA-376 parity wave
 * (issues P2-G1 through P2-G6), split out because
 * `openxml-coverage-animation-timing.ts` has little headroom left before the
 * 300-line file-size limit.
 */
import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['presentation:element:subSp'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: 'p:tgtEl/p:spTgt/p:subSp (targeting one shape inside a group for an animation) now round-trips through the typed animation target (issue P2-G1), including dropping the node again when the model no longer carries a sub-shape id. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/services/animation-target-build-helpers.test.ts',
			[
				'round-trips a p:subSp sub-shape target (grouped shape animation)',
				'removes p:subSp when the model no longer carries a subShapeId',
			],
			['parse', 'edit', 'serialize'],
		),
	],
});

assign(['presentation:element:graphicEl'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: "p:tgtEl/p:graphicEl (targeting a chart series or diagram category from an animation) now round-trips through the typed animation target (issue P2-G2). Render-side resolution of the reveal against the target's authored series/category index remains partial, not fully wired to the click-count-based reveal stage this manifest does not score (render has no tracked facet); see limitations.",
	evidence: [
		testEvidence(
			'src/core/services/animation-target-build-helpers.test.ts',
			[
				'round-trips a p:graphicEl chart series target',
				'round-trips a p:graphicEl diagram category target',
			],
			['parse', 'edit', 'serialize'],
		),
	],
});

assign(['presentation:element:oleChartEl'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: 'p:tgtEl/p:oleChartEl (targeting a legacy OLE chart sub-element from an animation) now round-trips through the typed animation target (issue P2-G3); the raw XML already round-tripped it losslessly as unmodelled passthrough before this wave, so this is a typed-model upgrade rather than a data-loss fix. No rendering of an OLE-chart sub-element reveal exists in this project, by design (OLE chart content is a static preview image).',
	evidence: [
		testEvidence(
			'src/core/services/animation-target-build-helpers.test.ts',
			['round-trips a p:oleChartEl legacy OLE chart sub-element target'],
			['parse', 'edit', 'serialize'],
		),
	],
});

assign(
	[
		'presentation:attribute:additive',
		'presentation:attribute:accumulate',
		'presentation:attribute:xfrmType',
		'presentation:attribute:override',
	],
	{
		parse: 'native',
		preserve: 'unassessed',
		edit: 'unassessed',
		serialize: 'unassessed',
		note: 'p:cBhvr\'s additive, accumulate, xfrmType, and override attributes (CT_TLCommonBehaviorData, issue P2-G4) are now extracted onto the typed PptxNativeAnimation. Nothing yet consumes them at playback (accumulate="always" iteration-scaling in particular is not implemented) and the authoring panel does not write them onto a newly-created effect, so edit/serialize are left unassessed rather than assumed; this parse-only fix stops them being silently discarded from the typed model, but does not yet change behaviour.',
		evidence: [
			testEvidence(
				'src/core/services/native-animation-cbhvr-attrs.test.ts',
				[
					'parses additive, accumulate, xfrmType, and override',
					'returns undefined for a cBhvr with none of the four attributes',
					'returns undefined for an unrecognised value',
					'returns undefined for a missing cBhvr node',
				],
				['parse'],
			),
		],
	},
);

assign(['presentation:attribute:calcmode'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'p:anim/@calcmode (ST_TLAnimateBehaviorCalcMode: discrete/lin/fmla, issue P2-G5) is now parsed and normalised, and genuinely consumed at playback: a "discrete" calc mode now steps its opacity or colour keyframes instead of interpolating smoothly between them (animation-timeline-absolute.ts). No editor writes this attribute onto a newly-authored effect, so edit/serialize are left unassessed.',
	evidence: [
		testEvidence(
			'src/core/services/native-animation-cbhvr-attrs.test.ts',
			[
				'normalizes discrete/lin/fmla and rejects anything else',
				"finds @_calcmode on the winning p:anim node ('discrete' style toggle)",
				'returns undefined when no p:anim carries @_calcmode',
			],
			['parse'],
		),
	],
});

assign(['presentation:attribute:evt', 'presentation:simpleType:ST_TLTriggerEvent'], {
	parse: 'partial',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'p:cond/@evt (the trigger-condition event domain) recognises onClick/onNext/onPrev/begin/end and, since issue P2-G6, onDblClick as well. Graded partial: not every ST_TLTriggerEvent value PowerPoint can author (e.g. onMouseOver/onMouseOut from the "Timing" advanced triggers) is recognised.',
	evidence: [
		testEvidence(
			'src/core/services/animation-condition-parsing.test.ts',
			['parses onDblClick event'],
			['parse'],
		),
	],
});

export const OPENXML_ANIMATION_TIMING_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
