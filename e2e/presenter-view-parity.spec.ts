/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does the PRESENTER VIEW look the same in all five bindings?
 *
 * `present-chrome-parity.spec.ts` asks this of the slide-show toolbar. Nobody
 * had ever asked it of the presenter console, and an earlier attempt could not
 * even drive it. The five had drifted at least as far as the show bar had:
 * React shipped a 16-slot strip whose accessible names were hard-coded English
 * `title` attributes; Vue rendered its strip ONLY in the empty-deck branch, so
 * with a real deck the console had no timer, zoom, annotation, blackout,
 * captions or End control at all; Angular re-labelled the same strip in a
 * component with no translate pipe and never applied the zoom its own buttons
 * set; Vanilla had no presenter view whatsoever, just a bar of English buttons
 * laid over the running show; and Svelte dropped the progress bar and rendered
 * notes as plain text, losing every run style.
 *
 * So this spec measures the console instead of using it: the strip inventory in
 * render order, the accessible name of every control, the panes that must be
 * present, and the next-slide preview's obligation to honour the show order.
 * It reads the inventory from `pptx-viewer-shared`'s `PRESENTER_CONSOLE_ORDER`
 * rather than restating it, so the spec cannot drift from the module the
 * bindings render from. Differences aggregate into one assertion, because a
 * per-binding assertion stops at the first failure and a defect shared by four
 * bindings then reads as a defect in one.
 *
 * Run: bunx playwright test presenter-view-parity
 */
import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Imported from source rather than restated: the bindings render from these
// lists, so a spec keeping its own copy would be free to agree with nothing.
import {
	PRESENTER_CONSOLE_ORDER,
	PRESENTER_RAIL_CONTROLS,
} from '../packages/shared/src/render/presenter-chrome';
import { fixture, loadDeckAt } from './support/deck';
import { acrossFrameworks, splitReference } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('solution-explorer.pptx');

/**
 * A ONE-slide deck, for the navigation rules.
 *
 * Its only slide is simultaneously the first and the last, so a console opened
 * on it is on the last slide with no navigation at all: no key handling, no
 * thumbnail rail (there is none below the mobile breakpoint) and no counting
 * clicks through animation builds. It also hits the exact predicate that was
 * wrong, `isLastSlide(0, 1)`, which is true.
 */
const ONE_SLIDE_DECK = fixture('linked-textbox.pptx');

/**
 * The form factors the console must behave identically on.
 *
 * Below the mobile breakpoint React, Vue and Angular swap the split-screen
 * console for a single-column phone layout, and all three of those phone
 * layouts disabled Next on the last slide while their own desktop consoles left
 * it live. Vanilla and Svelte have no phone layout and render the desktop
 * console at any width, so the same deck stranded a presenter on three bindings
 * out of five, on one form factor out of two.
 */
const FORM_FACTORS = [
	{ name: 'desktop', device: { viewport: { width: 1440, height: 900 } } },
	{ name: 'phone', device: devices['Pixel 7'] },
] as const;

/** Strip slots only; dividers and the spacer carry no control node. */
const STRIP_IDS = PRESENTER_CONSOLE_ORDER.filter(
	(id) => !id.startsWith('divider') && id !== 'spacer',
);

/** Rail slots, which share the strip's `data-pptx-presenter-control` attribute. */
const RAIL_IDS = PRESENTER_RAIL_CONTROLS.map((control) => control.id);

/** What one binding's presenter console looks like. */
interface ConsoleProbe {
	/** Every `data-pptx-presenter-control` value in DOM order. */
	ids: string[];
	/** Accessible name per control id. */
	names: Record<string, string>;
	/** Whether the console rendered at all. */
	mounted: boolean;
	/** Whether a timer progress bar with valid ARIA is present. */
	progressBar: { valuemin: string | null; valuemax: string | null; named: boolean } | null;
	/** Whether the current-slide pane exists. */
	hasStagePane: boolean;
	/** Text of the next-slide preview region, used for the show-order check. */
	nextPreviewText: string;
	/** Whether a speaker-notes region rendered. */
	hasNotes: boolean;
}

/**
 * Start the show and open presenter view through the show toolbar's own
 * `presenter-view` toggle, which every binding already exposes under the same
 * `data-pptx-present-control` contract. Going through the ribbon instead would
 * make this spec a test of five different ribbons.
 */
async function openPresenterView(page: Page, origin: string, deck: string = DECK): Promise<void> {
	await loadDeckAt(page, origin, deck);
	await page.waitForTimeout(800);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click({ force: true });
	await page.waitForTimeout(1200);
	// The show bar auto-hides until the pointer moves. Measured off the live
	// viewport rather than hard-coded: a phone viewport is narrower than the
	// desktop x the two moves used to use, so the pointer landed outside the
	// page entirely and the bar never came back.
	const view = page.viewportSize() ?? { width: 1440, height: 900 };
	const revealX = Math.round(view.width / 2);
	const revealY = Math.round(view.height - 40);
	await page.mouse.move(revealX, revealY);
	await page.mouse.move(revealX + 1, revealY - 2);
	await page.waitForTimeout(400);
	// `force`: the bar sits over the stage, which owns pointer events in some
	// bindings, and this spec is not measuring hit-testing.
	await page.locator('[data-pptx-present-control="presenter-view"]').first().click({ force: true });
	await page.waitForTimeout(1500);
}

async function probeConsole(page: Page): Promise<ConsoleProbe> {
	return page.evaluate(() => {
		const controls = [...document.querySelectorAll('[data-pptx-presenter-control]')];
		const names: Record<string, string> = {};
		const ids: string[] = [];
		for (const node of controls) {
			const id = node.getAttribute('data-pptx-presenter-control') ?? '';
			ids.push(id);
			// Accessible-name order, as a screen reader computes it: `aria-label`
			// wins, then the element's own text, then `title`. The rail's Prev and
			// Next are labelled by their visible text in some bindings and by an
			// `aria-label` in others; both are correct, and a probe that only read
			// the attribute reported the text-labelled ones as nameless.
			const ariaLabel = node.getAttribute('aria-label');
			const text = (node.textContent ?? '').trim();
			names[id] = (ariaLabel ?? (text || node.getAttribute('title') || '')).trim();
		}
		const progress = document.querySelector('[role="progressbar"]');
		const nextPreview = document.querySelector('[data-pptx-presenter-next-preview]');
		return {
			ids,
			names,
			mounted: controls.length > 0,
			progressBar: progress
				? {
						valuemin: progress.getAttribute('aria-valuemin'),
						valuemax: progress.getAttribute('aria-valuemax'),
						named: Boolean(progress.getAttribute('aria-label')),
					}
				: null,
			hasStagePane: Boolean(document.querySelector('[data-pptx-presenter-slide]')),
			nextPreviewText: (nextPreview?.textContent ?? '').trim(),
			hasNotes: Boolean(document.querySelector('[data-pptx-presenter-notes]')),
		};
	});
}

test.describe('cross-binding presenter view', () => {
	test('every binding mounts the same presenter console strip, in order', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openPresenterView(page, origin);
			return probeConsole(page);
		});

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (!value.mounted) {
				problems.push(
					`${framework.name}: renders no [data-pptx-presenter-control] after opening presenter view`,
				);
				continue;
			}
			// Rail ids share the attribute, so compare only the strip's own slots.
			const stripIds = value.ids.filter((id) => STRIP_IDS.includes(id));
			if (stripIds.join(',') !== STRIP_IDS.join(',')) {
				problems.push(
					`${framework.name}: strip order is [${stripIds.join(', ')}], shared spec is [${STRIP_IDS.join(', ')}]`,
				);
			}
			for (const id of RAIL_IDS) {
				if (!value.ids.includes(id)) {
					problems.push(`${framework.name}: rail is missing the "${id}" control`);
				}
			}
		}
		expect(problems.join('\n')).toBe('');
	});

	test('every presenter control is named exactly as React names it', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openPresenterView(page, origin);
			return probeConsole(page);
		});

		const { reference, candidates } = splitReference(results);
		const problems: string[] = [];
		for (const { framework, value } of candidates) {
			for (const id of [...STRIP_IDS, ...RAIL_IDS]) {
				const expected = reference.value.names[id];
				const actual = value.names[id];
				if (expected === undefined) {
					continue;
				}
				if (actual !== expected) {
					problems.push(
						`${framework.name}: "${id}" is named "${String(actual)}", React names it "${expected}"`,
					);
				}
			}
		}
		expect(problems.join('\n')).toBe('');
	});

	test('every console carries a stage pane, notes and an accessible timer bar', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openPresenterView(page, origin);
			return probeConsole(page);
		});

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (!value.hasStagePane) {
				problems.push(`${framework.name}: no [data-pptx-presenter-slide] current-slide pane`);
			}
			if (!value.hasNotes) {
				problems.push(`${framework.name}: no speaker-notes region`);
			}
			if (!value.progressBar) {
				problems.push(`${framework.name}: no role="progressbar" timer bar`);
				continue;
			}
			if (value.progressBar.valuemin !== '0' || value.progressBar.valuemax !== '100') {
				problems.push(
					`${framework.name}: timer bar range is ${String(value.progressBar.valuemin)}..${String(value.progressBar.valuemax)}, not 0..100`,
				);
			}
			if (!value.progressBar.named) {
				problems.push(`${framework.name}: timer bar has no accessible name`);
			}
		}
		expect(problems.join('\n')).toBe('');
	});

	for (const factor of FORM_FACTORS) {
		test(`on the last slide, Next stays live and Previous is disabled (${factor.name})`, async ({
			browser,
		}, testInfo) => {
			// PowerPoint's console advances from the last slide to the end-of-show
			// screen and then out of the show, so `presenterNextDisabled` is always
			// false. Bindings kept re-deciding it locally: three desktop consoles
			// added `disabled={current >= slides.length - 1}` (fixed once the rule
			// moved into shared), and all three PHONE consoles then made the same
			// call again through a near-duplicate `isLastSlide` helper, which
			// stranded a presenter on a phone while a laptop let them finish.
			//
			// The deck has exactly one slide, so the console opens on the last slide
			// without navigating: the phone layout has no thumbnail rail to jump
			// with, and counting clicks to the end is at the mercy of every
			// animation build on the way.
			const results = await acrossFrameworks(
				browser,
				testInfo,
				async (page, origin) => {
					await openPresenterView(page, origin, ONE_SLIDE_DECK);
					return page.evaluate(() => {
						const read = (id: string) => {
							const node = document.querySelector(`[data-pptx-presenter-control="${id}"]`);
							if (node === null) {
								return null;
							}
							return {
								disabled:
									node instanceof HTMLButtonElement
										? node.disabled
										: node.getAttribute('aria-disabled') === 'true',
								visible: node.getClientRects().length > 0,
							};
						};
						return { next: read('next'), prev: read('prev') };
					});
				},
				{ device: factor.device },
			);

			const problems: string[] = [];
			for (const { framework, value } of results) {
				if (value.next === null) {
					problems.push(`${framework.name}: no presenter "next" control`);
				} else {
					if (value.next.disabled) {
						problems.push(`${framework.name}: presenter "next" is disabled on the last slide`);
					}
					if (!value.next.visible) {
						problems.push(`${framework.name}: presenter "next" renders no box`);
					}
				}
				if (value.prev === null) {
					problems.push(`${framework.name}: no presenter "prev" control`);
				} else if (!value.prev.disabled) {
					problems.push(`${framework.name}: presenter "prev" is live on the first slide`);
				}
			}
			expect(problems.join('\n')).toBe('');
		});
	}

	test('no presenter pane paints a native media transport', async ({ browser }, testInfo) => {
		// A console pane is a STILL of a slide: the speaker cannot play it, and
		// PowerPoint paints no control bar on one. Four bindings rendered their
		// panes through a non-presenting stage whose rule was `controls =
		// !presenting`, so Chrome's black scrubber sat across the bottom of the
		// current-slide pane and the next-slide preview.
		//
		// The check is one-sided on purpose. React's preview renderer is handed no
		// media map, so its video falls back to a poster IMAGE and there is no
		// `<video>` to carry a transport; requiring a media node in every console
		// would fail on the one binding that never had the defect.
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openPresenterView(page, origin);
			return page.evaluate(() => {
				const panes = [
					...document.querySelectorAll(
						'[data-pptx-presenter-slide], [data-pptx-presenter-next-preview]',
					),
				];
				const media = panes.flatMap((pane) => [...pane.querySelectorAll('video, audio')]);
				return {
					total: media.length,
					withTransport: media.filter((node) => (node as HTMLMediaElement).controls).length,
				};
			});
		});

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (value.withTransport > 0) {
				problems.push(
					`${framework.name}: ${value.withTransport} of ${value.total} media node(s) in the presenter panes still paint a native transport`,
				);
			}
		}
		expect(problems.join('\n')).toBe('');
	});
});
