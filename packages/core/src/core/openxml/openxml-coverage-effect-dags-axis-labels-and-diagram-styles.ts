import type { OpenXmlCoverageFacets } from './openxml-coverage';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'drawing:complexType:CT_BlurEffect',
		'drawing:complexType:CT_EffectContainer',
		'drawing:complexType:CT_PresetShadowEffect',
		'drawing:element:blur',
		'drawing:element:cont',
		'drawing:element:effectDag',
		'drawing:element:prstShdw',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Effect DAG structure, blur, and preset shadow are typed with lossless primitive XML preservation.',
	},
);

assign(
	[
		'chart:complexType:CT_LblAlgn',
		'chart:complexType:CT_LblOffset',
		'chart:complexType:CT_TickMark',
		'chart:simpleType:ST_LblAlgn',
		'chart:simpleType:ST_LblOffset',
		'chart:simpleType:ST_LblOffsetPercent',
		'chart:simpleType:ST_LblOffsetUShort',
		'chart:simpleType:ST_TickMark',
		'chart:element:auto',
		'chart:element:lblAlgn',
		'chart:element:lblOffset',
		'chart:element:majorTickMark',
		'chart:element:minorTickMark',
		'chart:element:noMultiLvlLbl',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated classic ChartML axis label controls.',
	},
);

assign(
	[
		'diagram:complexType:CT_CTStyleLabel',
		'diagram:complexType:CT_ColorTransform',
		'diagram:complexType:CT_Colors',
		'diagram:complexType:CT_StyleDefinition',
		'diagram:complexType:CT_StyleLabel',
		'diagram:element:colorsDef',
		'diagram:element:styleDef',
		'diagram:element:styleLbl',
		'diagram:element:fillClrLst',
		'diagram:element:linClrLst',
		'diagram:element:effectClrLst',
		'diagram:element:txLinClrLst',
		'diagram:element:txFillClrLst',
		'diagram:element:txEffectClrLst',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Style and color-definition metadata are typed; complex style and color-choice payloads are preserved.',
	},
);

assign(['diagram:attribute:meth', 'diagram:attribute:hueDir'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: 'Typed DiagramML color-list method and hue-direction metadata.',
});

export const OPENXML_EFFECT_DAGS_AXIS_LABELS_AND_DIAGRAM_STYLES_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
