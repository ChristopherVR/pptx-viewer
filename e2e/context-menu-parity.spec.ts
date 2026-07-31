/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings offer the same commands when you right-click the canvas?
 *
 * The context menu is where a viewer's editing surface is most quietly allowed
 * to diverge. Nothing crashes when a binding omits Bring to Front, or ships a
 * menu with no table commands, or has no menu at all: each binding's own suite
 * still passes, the demo still loads, and the missing command is only ever
 * discovered by the user who right-clicked expecting it. That is the bug class
 * pinned here, and it is a real one - the menus were written five times from
 * scratch rather than ported from one shared item list, so their command sets
 * were never once compared.
 *
 * The comparison is by command NAME, lower-cased and whitespace-collapsed, so a
 * label that only differs in casing ("Merge Right" vs "Merge right") is not
 * dressed up as a missing feature. Enabled/disabled state is deliberately NOT
 * part of the set diff: greying Paste out with an empty clipboard is a better
 * menu, not a parity break. It is asserted only where a command has to actually
 * be usable (Group on a multi-selection, Duplicate when it is executed). A
 * binding with no menu at all is reported as exactly that, on one line, by
 * `support/context-menu`'s bounded open: a locator timeout would bury the
 * finding in a stack trace instead of naming it.
 *
 * Run: bunx playwright test context-menu-parity
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import type { MenuSnapshot } from './support/context-menu';
import {
	chooseCommand,
	CLIPBOARD_COMMANDS,
	commandNamed,
	COMMENT_COMMAND,
	DUPLICATE_COMMAND,
	goToSlide,
	GROUP_COMMAND,
	HYPERLINK_COMMAND,
	marqueeAcross,
	menuIsOpen,
	NO_MENU,
	openMenuOn,
	report,
	selectTableCell,
	stageElements,
	TABLE_MERGE_COMMANDS,
	TABLE_ROW_COLUMN_COMMANDS,
	Z_ORDER_COMMANDS,
} from './support/context-menu';
import { loadDeckAt, SAMPLE_DECK, slideStage, viewport } from './support/deck';
import { byBinding, inspect, missingLines } from './support/menu-report';
import { acrossFrameworks, splitReference } from './support/parity';

const VIEWPORT = { width: 1440, height: 900 };

test.use({ viewport: VIEWPORT });

/** Two separate text boxes on slide 1, and the table on slide 5. */
const SHAPE_TEXT = 'Product Overview';
const OTHER_SHAPE_TEXT = 'Q2 2026';
const TABLE_SLIDE = 5;
const TABLE_CELL_TEXT = 'Starter';

/** Load the sample deck and wait for the editable canvas. */
async function openDeck(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

/** A shape on the main canvas, never a thumbnail-rail copy of it. */
function canvasShape(page: Page, needle: string): Locator {
	return stageElements(page).filter({ hasText: needle }).first();
}

/** Right-click the sample deck's "Product Overview" text box. */
async function shapeMenu(page: Page, origin: string): Promise<MenuSnapshot> {
	await openDeck(page, origin);
	return openMenuOn(page, canvasShape(page, SHAPE_TEXT));
}

test.describe('cross-binding canvas context menu', () => {
	test('right-clicking a shape opens a menu exposed as role="menu"', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, shapeMenu, { viewport: VIEWPORT });

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => {
				const issues: string[] = [];
				if (snapshot.role !== 'menu') {
					issues.push(
						`the menu container declares role="${snapshot.role ?? '(none)'}" instead of role="menu", ` +
							'so assistive tech never announces it as a menu',
					);
				}
				if (!snapshot.itemRoles.some((role) => role.startsWith('menuitem'))) {
					issues.push(
						`none of its ${snapshot.commands.length} commands carry a menuitem role ` +
							`(roles seen: ${snapshot.itemRoles.join(', ')})`,
					);
				}
				return issues;
			}),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('the shape menu offers every clipboard and z-order command', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, shapeMenu, { viewport: VIEWPORT });

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => [
				...missingLines(snapshot, CLIPBOARD_COMMANDS),
				...missingLines(snapshot, Z_ORDER_COMMANDS),
			]),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('the shape menu offers Edit Hyperlink and Add Comment', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, shapeMenu, { viewport: VIEWPORT });

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) =>
				missingLines(snapshot, [HYPERLINK_COMMAND, COMMENT_COMMAND]),
			),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('the shape menu carries the same command set as the reference', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, shapeMenu, { viewport: VIEWPORT });
		const { reference, candidates } = splitReference(results);

		// Guard the comparison: an empty reference set would make every binding
		// agree with it and turn this into a test that can never fail.
		expect(reference.value.labels.length).toBeGreaterThan(4);

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

	test('a multi-selection offers a usable Group command', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const second = canvasShape(page, OTHER_SHAPE_TEXT);
				await marqueeAcross(page, slideStage(page), [canvasShape(page, SHAPE_TEXT), second]);
				return openMenuOn(page, second);
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => {
				const group = commandNamed(snapshot, GROUP_COMMAND);
				if (!group) {
					return ['does not offer "group" after a rubber-band drag across two shapes'];
				}
				return group.disabled
					? ['leaves "group" disabled after a rubber-band drag across two shapes']
					: [];
			}),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('right-clicking a table cell offers the row, column and merge commands', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await goToSlide(page, TABLE_SLIDE);
				const cell = viewport(page).locator('td').filter({ hasText: TABLE_CELL_TEXT }).first();
				await cell.waitFor();
				await selectTableCell(page, cell);
				return openMenuOn(page, cell);
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value, (snapshot) => [
				...missingLines(snapshot, TABLE_ROW_COLUMN_COMMANDS),
				...missingLines(snapshot, TABLE_MERGE_COMMANDS),
			]),
		);

		expect(problems.join('\n')).toBe('');
	});

	test('Escape and an outside click both dismiss the menu', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const shape = canvasShape(page, SHAPE_TEXT);
				const opened = await openMenuOn(page, shape);
				await page.keyboard.press('Escape');
				await page.waitForTimeout(400);
				const afterEscape = await menuIsOpen(page);

				const reopened = await openMenuOn(page, shape);
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

	test('choosing Duplicate adds exactly one element to the slide', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const menu = await openMenuOn(page, canvasShape(page, SHAPE_TEXT));
				const command = commandNamed(menu, DUPLICATE_COMMAND);
				if (!command) {
					return { present: menu.present, offered: false, delta: 0 };
				}
				const before = await stageElements(page).count();
				await chooseCommand(page, DUPLICATE_COMMAND);
				return {
					present: true,
					offered: true,
					delta: (await stageElements(page).count()) - before,
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			if (!value.present) {
				return report(name, [NO_MENU]);
			}
			if (!value.offered) {
				return report(name, [`does not offer "${DUPLICATE_COMMAND}"`]);
			}
			return report(
				name,
				value.delta === 1 ? [] : [`Duplicate changed the element count by ${value.delta}, not 1`],
			);
		});

		expect(problems.join('\n')).toBe('');
	});
});
