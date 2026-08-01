/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does the SLIDE SHOW look the same in all five bindings?
 *
 * `chrome-shell-parity.spec.ts` asks this of the editor chrome. Nothing asked
 * it of the show, and the five had drifted about as far apart as they can: on a
 * desktop, React and Vue floated an auto-hiding bar of sixteen slots at the
 * bottom centre, Angular pinned a six-icon annotation strip to the bottom LEFT
 * with no navigation and no way out, and Vanilla and Svelte rendered no show
 * chrome at all, which left a presenter with no visible exit. Every functional
 * present-mode test still passed, because each of them drives the keyboard.
 *
 * So this spec measures the bar instead of using it: the control inventory in
 * render order, the accessible name of each control, and the bar's geometry.
 * It reads the inventory from `pptx-viewer-shared`'s `PRESENT_TOOLBAR_ORDER`
 * rather than restating it, so the spec cannot drift from the module the
 * bindings render from. Differences from every binding aggregate into one
 * assertion, because a per-binding assertion stops at the first failure and a
 * defect shared by four bindings then reads as a defect in one.
 *
 * Run: bunx playwright test present-chrome-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Imported from source rather than restated here: the bindings render from this
// list, so a spec that kept its own copy would be free to agree with nothing.
// The bare `pptx-viewer-shared` specifier is not linked at the repo root.
import { PRESENT_TOOLBAR_ORDER } from '../packages/shared/src/render/present-chrome';
import { fixture, loadDeckAt } from './support/deck';
import { acrossFrameworks, splitReference } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

/** The committed, media-slimmed copy of the deck this bug was reported on. */
const DECK = fixture('solution-explorer.pptx');

/** What one binding's show toolbar looks like. */
interface ToolbarProbe {
	/** `data-pptx-present-control` values in DOM order. */
	ids: string[];
	/** Accessible name per control id. */
	names: Record<string, string>;
	/** Control widths and heights per id, for the metrics comparison. */
	boxes: Record<string, { width: number; height: number }>;
	/** The bar's own box, or `null` when the binding renders no bar at all. */
	bar: { width: number; height: number; centreX: number; bottomGap: number } | null;
	/** Whether the bar carries the toolbar role and a name. */
	role: string | null;
	roleName: string | null;
}

/** Load the deck, start the show, and wake any auto-hiding chrome. */
async function startShow(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, DECK);
	await page.waitForTimeout(800);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1500);
	// The bar auto-hides until the pointer moves, in every binding that has one.
	await page.mouse.move(720, 870);
	await page.mouse.move(721, 868);
	await page.waitForTimeout(400);
}

async function probeToolbar(page: Page): Promise<ToolbarProbe> {
	return page.evaluate(() => {
		const bar = document.querySelector('[data-pptx-present-toolbar]');
		const controls = [...document.querySelectorAll('[data-pptx-present-control]')];
		const names: Record<string, string> = {};
		const boxes: Record<string, { width: number; height: number }> = {};
		const ids: string[] = [];
		for (const node of controls) {
			const id = node.getAttribute('data-pptx-present-control') ?? '';
			ids.push(id);
			names[id] = (node.getAttribute('aria-label') ?? node.getAttribute('title') ?? '').trim();
			const rect = node.getBoundingClientRect();
			boxes[id] = { width: Math.round(rect.width), height: Math.round(rect.height) };
		}
		const barRect = bar?.getBoundingClientRect() ?? null;
		return {
			ids,
			names,
			boxes,
			bar: barRect
				? {
						width: Math.round(barRect.width),
						height: Math.round(barRect.height),
						centreX: Math.round(barRect.left + barRect.width / 2),
						bottomGap: Math.round(window.innerHeight - barRect.bottom),
					}
				: null,
			role: bar?.getAttribute('role') ?? null,
			roleName: bar?.getAttribute('aria-label') ?? null,
		};
	});
}

test.describe('cross-binding slide-show chrome', () => {
	test('every binding floats the same show toolbar with the same controls', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await startShow(page, origin);
			return probeToolbar(page);
		});

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (!value.bar) {
				problems.push(`${framework.name}: renders no [data-pptx-present-toolbar] during a show`);
				continue;
			}
			if (value.ids.join(',') !== [...PRESENT_TOOLBAR_ORDER].join(',')) {
				problems.push(
					`${framework.name}: control order is [${value.ids.join(', ')}], shared spec is [${PRESENT_TOOLBAR_ORDER.join(', ')}]`,
				);
			}
			if (value.role !== 'toolbar') {
				problems.push(`${framework.name}: the bar's role is ${String(value.role)}, not "toolbar"`);
			}
			if (!value.roleName) {
				problems.push(`${framework.name}: the bar has no accessible name`);
			}
		}
		expect(problems.join('\n')).toBe('');
	});

	test('every control is named exactly as React names it', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await startShow(page, origin);
			return probeToolbar(page);
		});

		const { reference, candidates } = splitReference(results);
		const problems: string[] = [];
		for (const { framework, value } of candidates) {
			for (const id of PRESENT_TOOLBAR_ORDER) {
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

	test('the bar is painted to the same measurements everywhere', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await startShow(page, origin);
			return probeToolbar(page);
		});

		const { reference, candidates } = splitReference(results);
		const problems: string[] = [];
		// Whole CSS pixels at a device pixel ratio of 1, so 1px absorbs rounding
		// without absorbing a real difference (the 18px-vs-28px caret this found).
		const tolerance = 1;
		for (const { framework, value } of candidates) {
			if (!value.bar || !reference.value.bar) {
				continue;
			}
			for (const [key, expected] of Object.entries(reference.value.bar)) {
				const actual = value.bar[key as keyof typeof value.bar];
				if (Math.abs(actual - expected) > tolerance) {
					problems.push(`${framework.name}: bar ${key} is ${actual}px, React paints ${expected}px`);
				}
			}
			for (const id of PRESENT_TOOLBAR_ORDER) {
				const expected = reference.value.boxes[id];
				const actual = value.boxes[id];
				if (!expected || !actual) {
					continue;
				}
				if (
					Math.abs(actual.width - expected.width) > tolerance ||
					Math.abs(actual.height - expected.height) > tolerance
				) {
					problems.push(
						`${framework.name}: "${id}" is ${actual.width}x${actual.height}, React paints ${expected.width}x${expected.height}`,
					);
				}
			}
		}
		expect(problems.join('\n')).toBe('');
	});
});
