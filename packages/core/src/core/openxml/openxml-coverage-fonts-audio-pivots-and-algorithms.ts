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
		note: 'Typed DrawingML audio-file and Audio CD timing metadata. Since issue G17, a linked (`r:link`, TargetMode="External") a:audioFile resolves to the verbatim external URL instead of being joined through the package-relative path resolver into a corrupted, unloadable path; resolution is gated behind the same allowExternalMedia flag pictures already use for external images.',
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
			testEvidence(
				'src/core/core/builders/media-data-parser.test.ts',
				[
					'marks r:link media as linked only when the relationship is external',
					'resolves a linked external r:link target to the verbatim URL, not a corrupted archive path',
					'blocks a linked external r:link target when allowExternalMedia is not granted',
					'returns the verbatim URL for an external relationship when allowExternalMedia grants it',
					'never joins an external target through resolvePath, granted or not',
				],
				['parse'],
			),
		],
	},
);

assign(['drawing:complexType:CT_VideoFile', 'drawing:element:videoFile'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'Typed DrawingML video-file reference (r:link/r:embed). Since issue G17, a linked (r:link, TargetMode="External") a:videoFile resolves to the verbatim external URL: before the fix, `resolveRelationshipTarget` joined every relationship (embedded or external) through the package-relative path resolver, turning `https://example.com/clip.mp4` into a nonsense path like `ppt/slides/https:/example.com/clip.mp4`. isLinked was already computed but never consulted for path resolution. No dedicated save-path test was found demonstrating independent re-serialization of the reference, so preserve/edit/serialize are left unassessed rather than assumed.',
	evidence: [
		testEvidence(
			'src/core/core/builders/media-data-parser.test.ts',
			[
				'detects video element from a:videoFile',
				'resolves video media path from r:link relationship',
				'prefers r:link over r:embed for video',
				'resolves a linked external r:link target to the verbatim URL, not a corrupted archive path',
				'blocks a linked external r:link target when allowExternalMedia is not granted',
			],
			['parse'],
		),
	],
});

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
