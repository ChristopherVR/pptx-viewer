import type { OpenXmlCoverageEvidence, OpenXmlCoverageFacet } from './openxml-coverage';

const ALL_FACETS: readonly OpenXmlCoverageFacet[] = ['parse', 'preserve', 'edit', 'serialize'];

export function testEvidence(
	test: string,
	anchors: readonly string[],
	facets: readonly OpenXmlCoverageFacet[] = ALL_FACETS,
): OpenXmlCoverageEvidence {
	return { test, anchors, facets };
}
