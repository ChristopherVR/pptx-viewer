/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The slides pane's thumbnail rail: Ctrl/Shift multi-select, Enter-inserts-a-
 * slide, and the thumbnail right-click menu (New Slide, Duplicate, Delete,
 * Layout, Hide, Add Section), across all five bindings.
 *
 * Only React's full-screen slide-sorter overlay had multi-select before this;
 * the always-visible rail (what a user actually looks at while editing) was
 * single-select everywhere, Enter did nothing on any rail, and the thumbnail
 * menu was at best a Duplicate/Delete/Hide trio. `pptx-viewer-shared`'s
 * `slide-pane-selection`/`slide-pane-context-menu` are the one click-resolver
 * and one command list behind all five.
 *
 * Run: bunx playwright test slides-pane-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { chooseCommand, commandNamed, NO_MENU, openMenuOn, report } from './support/context-menu';
import { loadDeckAt, SAMPLE_DECK, slideStage, thumbnail } from './support/deck';
import { byBinding, inspect } from './support/menu-report';
import { acrossFrameworks } from './support/parity';

const VIEWPORT = { width: 1440, height: 900 };

test.use({ viewport: VIEWPORT });

/** Load the sample deck and wait for the editable canvas. */
async function openDeck(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

test.describe('cross-binding slides pane', () => {
	test('right-clicking a thumbnail offers the shared six-command menu', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				return openMenuOn(page, thumbnail(page, 1));
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
				for (const command of ['duplicate', 'delete', 'layout', 'add section']) {
					if (!snapshot.labels.some((label) => label.includes(command))) {
						issues.push(`does not offer a command containing "${command}"`);
					}
				}
				return issues;
			}),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('Ctrl-click multi-selects, and Duplicate acts on every selected slide', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const before = await thumbnail(page, 1).evaluate(
					() => document.querySelectorAll('[aria-label^="Go to slide"]').length,
				);

				await thumbnail(page, 1).click();
				await thumbnail(page, 3).click({ modifiers: ['Control'] });
				const menu = await openMenuOn(page, thumbnail(page, 3));
				const duplicate = menu.commands.find((c) => c.label.toLowerCase().includes('duplicate'));
				if (!duplicate) {
					return { present: menu.present, offered: false, delta: 0 };
				}
				await chooseCommand(page, duplicate.label);
				await page.waitForTimeout(400);
				const after = await thumbnail(page, 1).evaluate(
					() => document.querySelectorAll('[aria-label^="Go to slide"]').length,
				);
				return { present: true, offered: true, delta: after - before };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, [NO_MENU]);
			}
			if (!value.offered) {
				return report(name, ['does not offer "duplicate"']);
			}
			return report(
				name,
				value.delta === 2
					? []
					: [`duplicating a 2-slide selection changed the slide count by ${value.delta}, not 2`],
			);
		});

		expect(problems.join('\n')).toBe('');
	});

	test('Enter on a focused thumbnail inserts a new slide after it', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const before = await thumbnail(page, 1).evaluate(
					() => document.querySelectorAll('[aria-label^="Go to slide"]').length,
				);
				await thumbnail(page, 2).click();
				await page.keyboard.press('Enter');
				await page.waitForTimeout(400);
				const after = await thumbnail(page, 1).evaluate(
					() => document.querySelectorAll('[aria-label^="Go to slide"]').length,
				);
				return after - before;
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			value === 1 ? [] : report(name, [`Enter changed the slide count by ${value}, not 1`]),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('Delete removes every selected slide', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const before = await thumbnail(page, 1).evaluate(
					() => document.querySelectorAll('[aria-label^="Go to slide"]').length,
				);
				await thumbnail(page, 4).click();
				await thumbnail(page, 5).click({ modifiers: ['Control'] });
				const menu = await openMenuOn(page, thumbnail(page, 5));
				const del =
					commandNamed(menu, 'delete') ??
					menu.commands.find((c) => c.label.toLowerCase().includes('delete'));
				if (!del) {
					return { present: menu.present, offered: false, delta: 0 };
				}
				await chooseCommand(page, del.label);
				await page.waitForTimeout(400);
				const after = await thumbnail(page, 1).evaluate(
					() => document.querySelectorAll('[aria-label^="Go to slide"]').length,
				);
				return { present: true, offered: true, delta: before - after };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, [NO_MENU]);
			}
			if (!value.offered) {
				return report(name, ['does not offer "delete"']);
			}
			return report(
				name,
				value.delta === 2
					? []
					: [`deleting a 2-slide selection changed the slide count by ${value.delta}, not 2`],
			);
		});

		expect(problems.join('\n')).toBe('');
	});
});
