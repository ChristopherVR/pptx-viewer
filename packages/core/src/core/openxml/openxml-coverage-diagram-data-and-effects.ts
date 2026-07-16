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

assign(
	[
		'diagram:complexType:CT_Constraint',
		'diagram:complexType:CT_Constraints',
		'diagram:complexType:CT_NumericRule',
		'diagram:complexType:CT_Rules',
		'diagram:element:constr',
		'diagram:element:constrLst',
		'diagram:element:rule',
		'diagram:element:ruleLst',
		'diagram:simpleType:ST_BoolOperator',
		'diagram:simpleType:ST_ConstraintRelationship',
		'diagram:simpleType:ST_ConstraintType',
		'diagram:simpleType:ST_ElementType',
		'diagram:attributeGroup:AG_ConstraintAttributes',
		'diagram:attributeGroup:AG_ConstraintRefAttributes',
		'diagram:attribute:for',
		'diagram:attribute:forName',
		'diagram:attribute:op',
		'diagram:attribute:ptType',
		'diagram:attribute:refFor',
		'diagram:attribute:refForName',
		'diagram:attribute:refPtType',
		'diagram:attribute:refType',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Diagram layout constraints and numeric rules are typed with enum validation and XML Schema double semantics.',
		evidence: [
			testEvidence('src/core/utils/smartart-constraint-rules.test.ts', [
				'parses arbitrary prefixes and XML Schema double lexical values',
				'applies typed edits while preserving foreign attributes and extensions',
				'validates required schema enums without rejecting valid non-finite doubles',
				'round-trips constraints through the editable layout-definition model',
			]),
		],
	},
);

export const OPENXML_DIAGRAM_DATA_AND_EFFECTS_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
