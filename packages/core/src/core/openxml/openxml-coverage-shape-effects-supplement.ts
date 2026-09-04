/**
 * Shape-effect coverage closed in the 2026-09 ECMA-376 parity wave that had
 * no headroom in `openxml-coverage-effect-style-3d-theme.ts` (near the
 * 300-line file-size limit).
 */
import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['drawing:element:fillOverlay'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'native',
	serialize: 'native',
	note: "a:effectLst/a:fillOverlay as a direct sibling of shadow/glow/blur (CT_EffectList) is now extracted (extractFillOverlayStyle: @blend plus the overlay's own solid or first-gradient-stop colour and opacity) and written back (buildFillOverlayXml), so a shape whose only listed effect is a fill overlay renders its colour tint/blend instead of being silently dropped (issue D1-G3). This is a distinct code path from the a:effectDag form of fillOverlay and the a:blip/a:fillOverlay picture form, both already native under their own construct handling; the extractor keeps its own shapeFillOverlay* property names specifically so the two do not collide. No dedicated round-trip test evidencing preserve was found, so preserve is left unassessed rather than assumed.",
	evidence: [
		testEvidence(
			'src/core/core/builders/shape-effect-codec-spec.test.ts',
			[
				'parses @blend and the a:solidFill colour+opacity of a direct effectLst fillOverlay',
				'reads the first gradient stop colour when the overlay uses a:gradFill',
				'returns an empty style when effectLst has no fillOverlay child',
				'does not collide with the effectDag fillOverlay fields (distinct property names)',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/builders/shape-effect-codec-spec.test.ts',
			[
				'builds a solid-colour a:fillOverlay with @blend and a:solidFill/a:srgbClr',
				'returns undefined when no fill overlay colour is set',
				'defaults @blend to "over" when unset',
			],
			['edit', 'serialize'],
		),
	],
});

export const OPENXML_SHAPE_EFFECTS_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;
