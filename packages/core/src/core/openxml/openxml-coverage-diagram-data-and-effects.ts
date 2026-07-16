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
		evidence: [
			testEvidence('src/core/core/runtime/smartart-data-model-attributes.test.ts', [
				'parses core identifiers and relationships',
				'edits typed attributes while preserving unknown XML and extLst',
				'accepts a valid core point and connection graph',
			]),
		],
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
		evidence: [
			testEvidence('src/core/core/builders/effect-list-roundtrip.test.ts', [
				'extracts outer shadow and glow from an alternate DrawingML prefix',
				'surgically edits modeled effects without dropping transforms or extensions',
			]),
		],
	},
);

export const OPENXML_DIAGRAM_DATA_AND_EFFECTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
