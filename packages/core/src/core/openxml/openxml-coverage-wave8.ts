import type { OpenXmlCoverageFacets } from './openxml-coverage';

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
	},
);

assign(['chart:complexType:CT_DTable', 'chart:element:dTable'], {
	parse: 'partial',
	preserve: 'native',
	edit: 'partial',
	serialize: 'partial',
	note: 'Data-table visibility options are typed; shape and text formatting remain preserved XML.',
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
	},
);

export const OPENXML_WAVE8_COVERAGE_OVERRIDES: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
