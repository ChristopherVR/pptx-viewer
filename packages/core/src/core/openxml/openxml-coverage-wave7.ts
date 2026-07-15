import type { OpenXmlCoverageFacets } from './openxml-coverage';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(
	[
		'diagram:complexType:CT_DataModel',
		'diagram:complexType:CT_Pt',
		'diagram:complexType:CT_PtList',
		'diagram:complexType:CT_Cxn',
		'diagram:complexType:CT_CxnList',
		'diagram:element:dataModel',
		'diagram:element:pt',
		'diagram:element:ptLst',
		'diagram:element:cxn',
		'diagram:element:cxnLst',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Core SmartArt point and connection identifiers are typed; unknown data-model XML is preserved.',
	},
);

assign(
	[
		'drawing:complexType:CT_EffectList',
		'drawing:complexType:CT_GlowEffect',
		'drawing:complexType:CT_OuterShadowEffect',
		'drawing:element:effectLst',
		'drawing:element:glow',
		'drawing:element:outerShdw',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Outer shadow and glow are typed with lossless effect-list and color-transform preservation.',
	},
);

export const OPENXML_WAVE7_COVERAGE_OVERRIDES: Readonly<Record<string, OpenXmlCoverageFacets>> =
	overrides;
