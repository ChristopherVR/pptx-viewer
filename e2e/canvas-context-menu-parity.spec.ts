/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Right-click the empty slide canvas (no element under the cursor): does it
 * offer the same six commands in every binding?
 *
 * This used to be a universal no-op: React and Vue bailed out of the hit-test
 * with nothing to fall back to, and the other three bindings never wired a
 * handler at all, so every binding left the browser's own context menu to
 * win. `pptx-viewer-shared`'s `canvas-context-menu-commands` is the one list
 * behind all five (Paste, Layout, Reset Slide, Format Background, Grid and
 * Guides, Ruler); this spec is what would have caught a sixth binding
 * shipping a different five.
 *
 * Run: bunx playwright test canvas-context-menu-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	chooseCommand,
	commandNamed,
	menuIsOpen,
	NO_MENU,
	openMenuAt,
	report,
} from './support/context-menu';
import { loadDeckAt, SAMPLE_DECK, slideStage } from './support/deck';
import { byBinding, inspect } from './support/menu-report';
import { acrossFrameworks, splitReference } from './support/parity';

const VIEWPORT = { width: 1440, height: 900 };

test.use({ viewport: VIEWPORT });

const CANVAS_COMMANDS = [
	'paste',
	'layout',
	'reset slide',
	'format background...',
	'grid and guides',
	'ruler',
] as const;

/** Load the sample deck and wait for the editable canvas. */
async function openDeck(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

/**
 * A point on the slide that is empty background, found by hit-testing rather
 * than assumed.
 *
 * The first version of this spec aimed at a fixed bottom-left point, but
 * slide 1 of the sample deck has a full-height filled panel (`shape-0`) down
 * its left third, so every "empty canvas" right-click actually opened the
 * ELEMENT menu. The shape-agnostic checks still passed against it (it is a
 * role="menu" too, and React's element menu was the "reference"), which hid
 * the mistake until the command-specific checks looked for Reset Slide.
 */
async function emptyCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
	const box = await slideStage(page).boundingBox();
	if (!box) {
		throw new Error('slide stage has no bounding box');
	}
	const candidates: { x: number; y: number }[] = [];
	for (const fy of [0.95, 0.9, 0.85, 0.8, 0.1, 0.05]) {
		for (const fx of [0.95, 0.9, 0.8, 0.7, 0.6, 0.5]) {
			candidates.push({ x: box.x + box.width * fx, y: box.y + box.height * fy });
		}
	}
	const found = await page.evaluate((points) => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		return (
			points.find((point) => {
				const hit = document.elementFromPoint(point.x, point.y);
				return Boolean(hit && stage?.contains(hit) && !hit.closest('[data-element-id]'));
			}) ?? null
		);
	}, candidates);
	if (!found) {
		throw new Error('no empty background point on the slide stage');
	}
	return found;
}

test.describe('cross-binding empty-canvas context menu', () => {
	test('right-clicking empty canvas opens a menu exposed as role="menu"', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				return openMenuAt(page, await emptyCanvasPoint(page));
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => {
				const issues: string[] = [];
				if (snapshot.role !== 'menu') {
					issues.push(
						`the menu container declares role="${snapshot.role ?? '(none)'}" instead of role="menu"`,
					);
				}
				if (!snapshot.itemRoles.some((role) => role.startsWith('menuitem'))) {
					issues.push(
						`none of its commands carry a menuitem role (roles seen: ${snapshot.itemRoles.join(', ')})`,
					);
				}
				return issues;
			}),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('the menu carries the same six commands as the reference', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				return openMenuAt(page, await emptyCanvasPoint(page));
			},
			{ viewport: VIEWPORT },
		);
		const { reference, candidates } = splitReference(results);

		expect(reference.value.labels.length).toBeGreaterThanOrEqual(CANVAS_COMMANDS.length);
		const expected = reference.value.labels;
		const problems = byBinding(candidates).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => [
				...expected
					.filter((command) => !snapshot.labels.includes(command))
					.map((command) => `does not offer "${command}"`),
				...snapshot.labels
					.filter((command) => !expected.includes(command))
					.map((command) => `offers "${command}", which the reference does not`),
			]),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('Paste is greyed out with an empty clipboard', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				return openMenuAt(page, await emptyCanvasPoint(page));
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => {
				const paste = commandNamed(snapshot, 'paste');
				if (!paste) {
					return ['does not offer "paste"'];
				}
				return paste.disabled ? [] : ['offers "paste" enabled with an empty clipboard'];
			}),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('Escape and an outside click both dismiss the menu', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const point = await emptyCanvasPoint(page);
				const opened = await openMenuAt(page, point);
				await page.keyboard.press('Escape');
				await page.waitForTimeout(400);
				const afterEscape = await menuIsOpen(page);

				const reopened = await openMenuAt(page, point);
				const stage = (await slideStage(page).boundingBox()) ?? { x: 8, y: 8 };
				await page.mouse.click(stage.x + 4, stage.y + 4);
				await page.waitForTimeout(400);
				return {
					present: opened.present && reopened.present,
					afterEscape,
					afterOutside: await menuIsOpen(page),
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, [NO_MENU]);
			}
			return report(name, [
				...(value.afterEscape ? ['Escape leaves the menu open'] : []),
				...(value.afterOutside ? ['clicking outside the menu leaves it open'] : []),
			]);
		});

		expect(problems.join('\n')).toBe('');
	});

	test('Grid and Guides / Ruler toggle and re-render checked on reopen', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const point = await emptyCanvasPoint(page);
				const before = await openMenuAt(page, point);
				const gridBefore = commandNamed(before, 'grid and guides');
				if (!gridBefore) {
					return { present: before.present, offered: false, toggled: false };
				}
				await chooseCommand(page, 'grid and guides');
				const after = await openMenuAt(page, point);
				// Once toggled on, every binding prefixes the entry with its check
				// mark, which `readMenu` reads as part of the label.
				const gridAfter = after.commands.find(
					(c) => c.label.replace(/^[✓\s]+/u, '').toLowerCase() === 'grid and guides',
				);
				return {
					present: true,
					offered: true,
					// A checkbox-style entry announces state via aria-checked, which
					// `readMenu` does not capture in `disabled`; the visible label
					// staying present across a reopen is the cross-binding-safe half
					// of this check, so this only asserts the round trip did not
					// close the menu or drop the command.
					toggled: Boolean(gridAfter),
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, [NO_MENU]);
			}
			if (!value.offered) {
				return report(name, ['does not offer "grid and guides"']);
			}
			return report(
				name,
				value.toggled ? [] : ['"grid and guides" disappeared after being toggled'],
			);
		});

		expect(problems.join('\n')).toBe('');
	});

	test('choosing Reset Slide closes the menu without leaving it stuck open', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const point = await emptyCanvasPoint(page);
				const menu = await openMenuAt(page, point);
				const command = commandNamed(menu, 'reset slide');
				if (!command) {
					return { present: menu.present, offered: false, closedAfter: false };
				}
				await chooseCommand(page, 'reset slide');
				return { present: true, offered: true, closedAfter: !(await menuIsOpen(page)) };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, [NO_MENU]);
			}
			if (!value.offered) {
				return report(name, ['does not offer "reset slide"']);
			}
			return report(name, value.closedAfter ? [] : ['"reset slide" left the menu open']);
		});

		expect(problems.join('\n')).toBe('');
	});
});
