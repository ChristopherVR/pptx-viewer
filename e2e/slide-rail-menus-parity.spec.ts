/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * #397: the slide rail's persistent actions, the section-header menu and the
 * slide-sorter menu are the same feature in all five bindings.
 *
 * The audit behind #386 found three different products behind each of these
 * surfaces: React had a section popup menu and a five-item sorter menu; Vue,
 * Angular, Svelte and Vanilla used hover buttons per section header (Svelte,
 * Vanilla and Angular renamed through window.prompt), three-item sorter menus
 * (Vanilla none), and rail action rows that differed per binding. The decision
 * (docs/guide/ui-migration.md) is one command list per surface, built in
 * pptx-viewer-shared, rendered as a role="menu" popup everywhere:
 *
 *  - rail: one persistent action, Add Slide, and nothing else on a thumbnail;
 *  - section header: Rename, Delete, Move Up, Move Down, Add Section After,
 *    with inline rename;
 *  - sorter tile: Copy, Paste (after a copy), Duplicate, Hide/Show, Delete.
 *
 * Run: bunx playwright test slide-rail-menus-parity
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { chooseCommand, openMenuOn, readMenu, report } from './support/context-menu';
import type { MenuSnapshot } from './support/context-menu';
import { loadDeckAt, SAMPLE_DECK, slideStage, thumbnail } from './support/deck';
import { byBinding, inspect } from './support/menu-report';
import { acrossFrameworks } from './support/parity';

const VIEWPORT = { width: 1440, height: 900 };

test.use({ viewport: VIEWPORT });

async function openDeck(page: Page, origin: string): Promise<void> {
	await loadDeckAt(page, origin, SAMPLE_DECK);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

/** A declared section's header, by the default or renamed title (the ungrouped group has none). */
function sectionHeaders(page: Page): Locator {
	return page
		.locator('[data-pptx-chrome="section-header"]')
		.filter({ hasText: /Untitled Section|Agenda|Appendix/u });
}

/**
 * Right-click a section header. The rail scrolls to the active slide, which can
 * leave a header above the visible list, so bring it into view first.
 */
async function openHeaderMenu(page: Page, header: Locator): Promise<MenuSnapshot> {
	await header.scrollIntoViewIfNeeded();
	return openMenuOn(page, header);
}

/** Add a section starting at `slideNumber` through the thumbnail menu every binding already has. */
async function addSectionAt(page: Page, slideNumber: number): Promise<void> {
	await openMenuOn(page, thumbnail(page, slideNumber));
	await chooseCommand(page, 'add section');
	await page.waitForTimeout(300);
}

const slideCount = (page: Page): Promise<number> =>
	page.locator('[aria-label^="Go to slide"]').count();

const SECTION_COMMANDS = ['rename', 'delete', 'move up', 'move down', 'add section after'];

test.describe('cross-binding slide rail menus', () => {
	test('the rail has one persistent action, Add Slide, in flat and sectioned decks', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				const footerButtons = async (): Promise<string[]> =>
					page
						.locator('[data-pptx-chrome="slide-footer"] button')
						.evaluateAll((nodes) => nodes.map((n) => (n.textContent ?? '').trim()));
				const thumbActions = (): Promise<number> =>
					page
						.locator('[data-pptx-chrome="slides"]')
						.getByRole('button', { name: /^(duplicate|delete|move up|move down)/iu })
						.count();
				const flat = { footer: await footerButtons(), perThumbnail: await thumbActions() };
				await addSectionAt(page, 2);
				const sectioned = { footer: await footerButtons(), perThumbnail: await thumbActions() };
				const before = await slideCount(page);
				await page
					.locator('[data-pptx-chrome="slide-footer"]')
					.getByRole('button', { name: 'Add Slide' })
					.click();
				await page.waitForTimeout(400);
				return { flat, sectioned, added: (await slideCount(page)) - before };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			const issues: string[] = [];
			for (const [kind, shape] of [
				['flat', value.flat],
				['sectioned', value.sectioned],
			] as const) {
				if (shape.footer.length !== 1 || !/add slide/iu.test(shape.footer[0])) {
					issues.push(
						`${kind} rail footer holds [${shape.footer.join(', ')}] instead of just "Add Slide"`,
					);
				}
				if (shape.perThumbnail > 0) {
					issues.push(`${kind} rail renders ${shape.perThumbnail} per-thumbnail action buttons`);
				}
			}
			if (value.added !== 1) {
				issues.push(`Add Slide changed the slide count by ${value.added}, not 1`);
			}
			return report(name, issues);
		});
		expect(problems.join('\n')).toBe('');
	});

	test('right-clicking a section header opens the shared five-command menu', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await addSectionAt(page, 2);
				const header = sectionHeaders(page).first();
				await header.waitFor();
				const nested = await header.locator('button').count();
				const menu = await openHeaderMenu(page, header);
				return { menu, nested };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			inspect(name, value.menu, (snapshot) => {
				const issues: string[] = [];
				if (snapshot.role !== 'menu') {
					issues.push(`the menu container declares role="${snapshot.role ?? '(none)'}"`);
				}
				if (snapshot.labels.join('|') !== SECTION_COMMANDS.join('|')) {
					issues.push(
						`offers [${snapshot.labels.join(', ')}] instead of [${SECTION_COMMANDS.join(', ')}]`,
					);
				}
				if (value.nested > 1) {
					issues.push(`the header still carries ${value.nested} inline buttons`);
				}
				return issues;
			}),
		);
		expect(problems.join('\n')).toBe('');
	});

	test('Rename edits the section name inline, without a browser prompt', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				let dialogs = 0;
				page.on('dialog', (dialog) => {
					dialogs += 1;
					void dialog.dismiss();
				});
				await openDeck(page, origin);
				await addSectionAt(page, 2);
				const header = sectionHeaders(page).first();
				await header.waitFor();
				await openHeaderMenu(page, header);
				await chooseCommand(page, 'rename');
				const input = page
					.locator('[data-pptx-chrome="section-header"] input[type="text"]')
					.first();
				const inline = await input.isVisible().catch(() => false);
				if (inline) {
					await input.fill('Agenda');
					await input.press('Enter');
					await page.waitForTimeout(400);
				}
				const renamed = await sectionHeaders(page).filter({ hasText: 'Agenda' }).count();
				return { dialogs, inline, renamed };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			report(name, [
				...(value.dialogs > 0 ? ['Rename opened a browser prompt'] : []),
				...(value.inline ? [] : ['Rename did not show an inline text field in the header']),
				...(value.renamed === 1 ? [] : ['the header does not show the new name "Agenda"']),
			]),
		);
		expect(problems.join('\n')).toBe('');
	});

	test('Move Up and Move Down are gated at the ends and Move Up reorders', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await addSectionAt(page, 2);
				await openHeaderMenu(page, sectionHeaders(page).first());
				await chooseCommand(page, 'rename');
				const first = page
					.locator('[data-pptx-chrome="section-header"] input[type="text"]')
					.first();
				await first.fill('Agenda');
				await first.press('Enter');
				await page.waitForTimeout(300);
				await addSectionAt(page, 4);
				const headers = sectionHeaders(page);
				const second = headers.nth(1);
				await second.waitFor();

				const disabled = async (target: Locator, label: string): Promise<boolean | null> => {
					const snapshot = await openHeaderMenu(page, target);
					const command = snapshot.commands.find((c) => c.label.toLowerCase() === label);
					await page.keyboard.press('Escape');
					await page.waitForTimeout(200);
					return command ? command.disabled : null;
				};
				const gates = {
					firstUp: await disabled(headers.first(), 'move up'),
					firstDown: await disabled(headers.first(), 'move down'),
					lastUp: await disabled(second, 'move up'),
					lastDown: await disabled(second, 'move down'),
				};

				await openHeaderMenu(page, second);
				await chooseCommand(page, 'move up');
				await page.waitForTimeout(400);
				const order = await sectionHeaders(page).evaluateAll((nodes) =>
					nodes.map((n) => /Agenda/u.test(n.textContent ?? '')),
				);
				return { gates, order, menuOpen: (await readMenu(page)).present };
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			report(name, [
				...(value.gates.firstUp === true ? [] : ['Move Up is not disabled on the first section']),
				...(value.gates.firstDown === false
					? []
					: ['Move Down is not enabled on the first section']),
				...(value.gates.lastUp === false ? [] : ['Move Up is not enabled on the last section']),
				...(value.gates.lastDown === true ? [] : ['Move Down is not disabled on the last section']),
				...(value.order.join() === 'false,true'
					? []
					: [`Move Up did not swap the sections (Agenda flags: ${value.order.join()})`]),
			]),
		);
		expect(problems.join('\n')).toBe('');
	});

	test('the sorter tile menu offers the shared command list and Paste follows Copy', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await openDeck(page, origin);
				await page
					.getByRole('button', { name: /slide sorter/iu })
					.first()
					.click();
				await page
					.getByRole('heading', { name: /slide sorter/iu })
					.first()
					.waitFor();
				await page.waitForTimeout(500);
				const tiles = page.locator('[data-pptx-chrome="sorter-tile"]');
				const count = (): Promise<number> => tiles.count();
				const start = await count();

				const first = await openMenuOn(page, tiles.nth(1));
				await chooseCommand(page, 'copy');
				const second = await openMenuOn(page, tiles.nth(1));
				await chooseCommand(page, 'paste');
				await page.waitForTimeout(400);
				const afterPaste = await count();

				await openMenuOn(page, tiles.nth(1));
				await chooseCommand(page, 'hide slides');
				await page.waitForTimeout(300);
				const fourth = await openMenuOn(page, tiles.nth(1));
				await page.keyboard.press('Escape');
				return { start, first, second, afterPaste, fourth };
			},
			{ viewport: VIEWPORT },
		);

		const labels = (snapshot: { labels: string[] }): string => snapshot.labels.join('|');
		const problems = byBinding(results).flatMap(({ name, value }) =>
			report(name, [
				...(value.first.role === 'menu' ? [] : ['the sorter menu does not declare role="menu"']),
				...(labels(value.first) === 'copy|duplicate|hide slides|delete'
					? []
					: [`first menu offers [${value.first.labels.join(', ')}]`]),
				...(labels(value.second) === 'copy|paste|duplicate|hide slides|delete'
					? []
					: [`menu after Copy offers [${value.second.labels.join(', ')}]`]),
				...(value.afterPaste === value.start + 1
					? []
					: [`Paste changed the slide count from ${value.start} to ${value.afterPaste}`]),
				...(value.fourth.labels.includes('show slides')
					? []
					: [
							`after Hide the menu offers [${value.fourth.labels.join(', ')}] instead of Show Slides`,
						]),
			]),
		);
		expect(problems.join('\n')).toBe('');
	});
});
