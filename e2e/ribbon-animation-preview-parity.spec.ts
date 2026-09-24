/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The ribbon Animations tab's Preview button, across all five bindings.
 *
 * React and Vue's button only flashed itself for 1200ms and did nothing
 * else; Angular's started the FULL slide show, leaving the editor entirely.
 * Only Svelte and Vanilla ever played a real in-place preview. All five now
 * call the one shared `playAnimationRibbonPreview`
 * (`pptx-viewer-shared/render/animation-ribbon-preview`), which plays the
 * selected element's own authored effect directly on its canvas node by
 * setting a real `animation` CSS property, an observable DOM change every
 * binding produces identically.
 *
 * Fixture: `effect-sound-gallery.pptx` (see its generator), whose one shape
 * already carries a real `p:timing` fadeIn entrance (duration 500ms) - the
 * same fixture `effect-sound-gallery.spec.ts` uses for the same reason: a
 * precondition an animation-authoring test needs without any live authoring.
 *
 * Run: bunx playwright test ribbon-animation-preview-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { EFFECT_SOUND_SHAPE_TEXT } from './fixtures/generate-effect-sound-gallery-fixture';
import { report } from './support/context-menu';
import {
	elementWithText,
	fixture,
	loadDeckAt,
	openRibbonTab,
	SAMPLE_DECK,
	selectElement,
	slideElements,
} from './support/deck';
import { byBinding } from './support/menu-report';
import { acrossFrameworks } from './support/parity';

const VIEWPORT = { width: 1440, height: 900 };
const DECK = fixture('effect-sound-gallery.pptx');

test.use({ viewport: VIEWPORT });

async function openAnimatedShapeInRibbon(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, DECK);
	await selectElement(page, elementWithText(page, EFFECT_SOUND_SHAPE_TEXT));
	await openRibbonTab(page, 'Animations');
}

test.describe('cross-binding ribbon animation preview', () => {
	test('Preview plays the selected element own effect in place, not a full slide show', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openAnimatedShapeInRibbon(page, origin);
				const preview = page.getByRole('button', { name: 'Preview', exact: true });
				await preview.click();

				const target = elementWithText(page, EFFECT_SOUND_SHAPE_TEXT);
				// The shared player sets a real inline `animation` shorthand; poll
				// rather than a fixed wait since the injected keyframes and the
				// style write happen on the same tick as the click but are still
				// async relative to Playwright's own event loop.
				const playedInPlace = await target
					.evaluate((el) => (el as HTMLElement).style.animation.length > 0)
					.catch(() => false);

				// Never navigates away to a full-screen slide show: the ribbon,
				// canvas and inspector must all still be on screen right after.
				const stillEditing = await page
					.getByRole('toolbar', { name: 'Presentation toolbar' })
					.isVisible()
					.catch(() => false);

				return { playedInPlace, stillEditing };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			const issues: string[] = [];
			if (!value.playedInPlace) {
				issues.push('Preview did not set a real CSS animation on the selected element');
			}
			if (!value.stillEditing) {
				issues.push(
					'Preview left the editor (a full slide show took over) instead of staying in place',
				);
			}
			return report(name, issues);
		});

		expect(problems.join('\n')).toBe('');
	});

	test('Preview is enabled for a selection even before it carries an animation entry', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				// The sample deck's own elements carry no authored animations; the
				// button must still be enabled (clicking it is a safe no-op), matching
				// every binding but Svelte's pre-fix behaviour.
				await loadDeckAt(page, origin, SAMPLE_DECK);
				await selectElement(page, slideElements(page).first());
				await openRibbonTab(page, 'Animations');
				const preview = page.getByRole('button', { name: 'Preview', exact: true });
				return { disabled: await preview.isDisabled() };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			value.disabled
				? [`${name}: Preview is disabled for an editable selection with no animation yet`]
				: [],
		);

		expect(problems.join('\n')).toBe('');
	});
});
