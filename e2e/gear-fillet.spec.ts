/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `gear6` / `gear9` preset fillet (`adj2`), run identically against every
 * framework demo.
 *
 * The fixture (`gear-fillet.pptx`, `e2e/fixtures/generate-gear-fillet-
 * fixture.ts`) authors two pairs of shapes, each pair sharing `adj1` but
 * differing only in `adj2` (0 vs its COM-verified maximum). Every binding
 * resolves a preset shape's outline through the same shared
 * `getResolvedShapeClipPathFor` (`packages/shared/src/render/shape-geometry.ts`),
 * which recomputes the CSS `clip-path` from `shapeAdjustments` on every call
 * (see that module's doc), so:
 *
 *  1. Within ONE binding, the `adj2 = 0` and `adj2 = max` shapes must paint a
 *     DIFFERENT clip-path: if they match, that binding is ignoring `adj2`
 *     entirely for this preset.
 *  2. ACROSS the five bindings, the SAME `adj2` configuration must paint the
 *     SAME clip-path fingerprint: the shapes are authored at identical pixel
 *     sizes, and `support/fingerprint`'s clip-path is captured in
 *     element-local px (not stage-relative percentages), so a uniform zoom
 *     difference between demos cannot explain a mismatch here.
 *
 * Run: bunx playwright test gear-fillet
 */
import { test, expect } from '@playwright/test';

import { GEAR_LABELS } from './fixtures/generate-gear-fillet-fixture';
import { fixture, loadDeckAt } from './support/deck';
import type { ElementFingerprint, SlideFingerprint } from './support/fingerprint';
import { fingerprintSlide } from './support/fingerprint';
import { acrossFrameworks, collectParityProblems } from './support/parity';

const GEAR_FIXTURE = fixture('gear-fillet.pptx');

function elementByLabel(slide: SlideFingerprint, label: string): ElementFingerprint {
	const found = slide.elements.find((element) => element.text === label);
	if (!found) {
		throw new Error(`no element labelled "${label}" in the captured fingerprint`);
	}
	return found;
}

test.describe('gear preset fillet (adj2)', () => {
	test('adj2 reshapes the clip-path per binding, and matches across all five', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await loadDeckAt(page, origin, GEAR_FIXTURE);
				return fingerprintSlide(page);
			},
			{ concurrency: 'sequential' },
		);

		const perBindingProblems: string[] = [];
		for (const { framework, value } of results) {
			const gear6Zero = elementByLabel(value, GEAR_LABELS.gear6Zero);
			const gear6Large = elementByLabel(value, GEAR_LABELS.gear6Large);
			const gear9Zero = elementByLabel(value, GEAR_LABELS.gear9Zero);
			const gear9Large = elementByLabel(value, GEAR_LABELS.gear9Large);

			if (gear6Zero.clipPath === gear6Large.clipPath) {
				perBindingProblems.push(
					`${framework.name}: gear6 clip-path is identical at adj2=0 and adj2=max ` +
						`(${gear6Zero.clipPath}), so adj2 is not reaching the render`,
				);
			}
			if (gear9Zero.clipPath === gear9Large.clipPath) {
				perBindingProblems.push(
					`${framework.name}: gear9 clip-path is identical at adj2=0 and adj2=max ` +
						`(${gear9Zero.clipPath}), so adj2 is not reaching the render`,
				);
			}
		}
		expect(perBindingProblems.join('\n')).toBe('');

		const crossBindingProblems = collectParityProblems(results);
		expect(crossBindingProblems.join('\n')).toBe('');
	});
});
