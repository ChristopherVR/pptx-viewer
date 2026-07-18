import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['presentation:complexType:CT_SlideTransition', 'presentation:element:transition'], {
	parse: 'partial',
	preserve: 'native',
	edit: 'partial',
	serialize: 'partial',
	note: 'Transition timing, speed, effects, and sound actions are typed; extension effects remain partial.',
	evidence: [
		testEvidence('src/__tests__/integration/slide-transition-conformance-roundtrip.test.ts', [
			'generates and reloads typed speed, timing, and start-sound options',
			'preserves unknown transition markup through a dirty edit and reload',
		]),
	],
});

assign(
	[
		'presentation:complexType:CT_TransitionSoundAction',
		'presentation:complexType:CT_TransitionStartSoundAction',
		'presentation:simpleType:ST_TransitionSpeed',
		'presentation:element:endSnd',
		'presentation:element:sndAc',
		'presentation:element:stSnd',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated transition speed and sound-action support.',
		evidence: [
			testEvidence('src/__tests__/integration/slide-transition-conformance-roundtrip.test.ts', [
				'generates and reloads typed speed, timing, and start-sound options',
			]),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_Backdrop',
		'drawing:complexType:CT_Camera',
		'drawing:complexType:CT_EmbeddedWAVAudioFile',
		'drawing:complexType:CT_LightRig',
		'drawing:complexType:CT_Point3D',
		'drawing:complexType:CT_Scene3D',
		'drawing:complexType:CT_SphereCoords',
		'drawing:complexType:CT_Vector3D',
		'drawing:element:backdrop',
		'drawing:element:camera',
		'drawing:element:lightRig',
		'drawing:element:scene3d',
		'drawing:element:snd',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed scene geometry or embedded transition sound with lossless unknown XML preservation.',
		evidence: [
			testEvidence('src/core/utils/text-body-scene3d.test.ts', [
				'parses all typed camera, light-rig, and backdrop fields with alternate prefixes',
				'applies edits while preserving prefixes, unknown attributes, and extLst',
				'creates a schema-ordered scene and complete backdrop from typed data',
			]),
			testEvidence('src/__tests__/integration/slide-transition-conformance-roundtrip.test.ts', [
				'generates and reloads typed speed, timing, and start-sound options',
			]),
		],
	},
);

assign(['chart:complexType:CT_DTable', 'chart:element:dTable'], {
	parse: 'partial',
	preserve: 'native',
	edit: 'partial',
	serialize: 'partial',
	note: 'Data-table visibility options are typed; shape and text formatting remain preserved XML.',
	evidence: [
		testEvidence('src/__tests__/integration/chart-data-table-roundtrip.test.ts', [
			'generates, parses, edits, and removes c:dTable through save cycles',
		]),
	],
});

assign(
	[
		'chart:element:showHorzBorder',
		'chart:element:showVertBorder',
		'chart:element:showOutline',
		'chart:element:showKeys',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed ChartML CT_Boolean data-table option support.',
		evidence: [
			testEvidence('src/__tests__/integration/chart-data-table-roundtrip.test.ts', [
				'generates, parses, edits, and removes c:dTable through save cycles',
			]),
		],
	},
);

assign(
	[
		'presentation:complexType:CT_PrintProperties',
		'presentation:simpleType:ST_PrintColorMode',
		'presentation:simpleType:ST_PrintWhat',
		'presentation:element:prnPr',
		'presentation:attribute:clrMode',
		'presentation:attribute:frameSlides',
		'presentation:attribute:hiddenSlides',
		'presentation:attribute:prnWhat',
		'presentation:attribute:scaleToFitPaper',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Presentation print properties are typed, validated, schema-ordered, and losslessly editable.',
		evidence: [
			testEvidence('src/core/core/runtime/pptx-print-properties.test.ts', [
				'parses every CT_PrintProperties attribute and XML boolean spelling',
				'edits and removes known attributes while preserving unknown data and extLst',
				'rejects invalid runtime enum values and handout counts',
			]),
			testEvidence('src/__tests__/integration/presentation-print-properties-roundtrip.test.ts', [
				'loads an alternate prefix, edits all attributes, and preserves extensions',
				'removes p:prnPr when printProperties is null',
			]),
		],
	},
);

export const OPENXML_TRANSITIONS_SCENES_AND_CHART_TABLES_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
