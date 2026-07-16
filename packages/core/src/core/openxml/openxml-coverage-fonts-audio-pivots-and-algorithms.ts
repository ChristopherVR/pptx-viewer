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
		'presentation:complexType:CT_EmbeddedFontList',
		'presentation:complexType:CT_EmbeddedFontListEntry',
		'presentation:complexType:CT_EmbeddedFontDataId',
		'presentation:element:embeddedFontLst',
		'presentation:element:embeddedFont',
		'presentation:element:font',
		'presentation:element:regular',
		'presentation:element:bold',
		'presentation:element:italic',
		'presentation:element:boldItalic',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed embedded-font descriptors and relationship variants with package cleanup.',
		evidence: [
			testEvidence('src/core/utils/embedded-font-list.test.ts', [
				'parses alternate prefixes and every embedded font variant',
				'edits and removes variants while retaining unknown XML in schema order',
				'validates required entries, typefaces, and relationship identifiers',
				'inserts the list at the CT_Presentation schema position and removes it',
			]),
			testEvidence('src/__tests__/integration/embedded-font-list-roundtrip.test.ts', [
				'loads unresolved variants, edits metadata, and preserves unknown XML',
				'removes the list, font relationships, and font parts together',
			]),
		],
	},
);

assign(
	[
		'chart:complexType:CT_PivotSource',
		'chart:complexType:CT_UnsignedInt',
		'chart:element:pivotSource',
		'chart:element:fmtId',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed and validated pivot-source metadata with ordered chart-space serialization.',
		evidence: [
			testEvidence('src/core/utils/chart-pivot-source.test.ts', [
				'parses required prefix-independent name and unsigned format ID',
				'round trips edits while preserving extensions and foreign markup',
				'validates required values on serialization',
				'inserts before protection and chart and supports explicit removal',
				'serializes pivot metadata for a newly generated chart part',
			]),
		],
	},
);

assign(
	[
		'drawing:complexType:CT_AudioCD',
		'drawing:complexType:CT_AudioCDTime',
		'drawing:complexType:CT_AudioFile',
		'drawing:element:audioCd',
		'drawing:element:audioFile',
		'drawing:element:st',
		'drawing:element:end',
		'drawing:attribute:track',
		'drawing:attribute:time',
		'drawing:attribute:contentType',
	],
	{
		parse: 'native',
		preserve: 'native',
		edit: 'native',
		serialize: 'native',
		note: 'Typed DrawingML audio-file and Audio CD timing metadata.',
		evidence: [
			testEvidence('src/core/utils/drawing-media-reference.test.ts', [
				'parses arbitrary element and relationship prefixes',
				'serializes dirty Audio CD positions while preserving extensions',
				'validates Audio CD track and time bounds',
				'edits audioFile content type without flattening prefixes or extensions',
			]),
			testEvidence('src/__tests__/integration/drawing-audio-metadata-roundtrip.test.ts', [
				'authors and reloads an Audio CD reference without a media relationship',
			]),
		],
	},
);

assign(
	[
		'diagram:complexType:CT_Algorithm',
		'diagram:complexType:CT_Parameter',
		'diagram:element:alg',
		'diagram:element:param',
		'diagram:attribute:rev',
		'diagram:simpleType:ST_AlgorithmType',
		'diagram:simpleType:ST_ParameterId',
		'diagram:simpleType:ST_ParameterVal',
	],
	{
		parse: 'partial',
		preserve: 'native',
		edit: 'partial',
		serialize: 'partial',
		note: 'Algorithm and parameter structure is typed; schema enum unions remain string-valued.',
		evidence: [
			testEvidence('src/core/utils/smartart-layout-definition.test.ts', [
				'parses CT_DiagramDefinition and recursive CT_LayoutNode with arbitrary prefixes',
				'surgically edits typed fields and preserves algorithms, unknown data, and extLst',
				'creates and removes CT_Algorithm in CT_LayoutNode schema order',
				'rejects invalid required values and unsigned integer facets',
			]),
		],
	},
);

export const OPENXML_FONTS_AUDIO_PIVOTS_AND_ALGORITHMS_COVERAGE = overrides;
