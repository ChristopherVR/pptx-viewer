/**
 * Reading the canvas right-click menu through the one contract every binding
 * can be held to.
 *
 * There is no shared component behind the five context menus: React renders a
 * plain positioned `<div>`, Vue teleports a data-driven list, Angular ships a
 * `<ul>`, Svelte hand-rolls one and Vanilla has none at all. So the neutral
 * hook has to be the union of what a context menu IS to a user and to a screen
 * reader: a visible floating container that either declares `role="menu"` or
 * carries the `data-pptx-context-menu` marker, holding activatable commands.
 * Anything narrower would silently exclude a binding and turn a parity gap into
 * a locator timeout, which is exactly the failure mode this module exists to
 * avoid: {@link openMenuAt} always resolves, with `present: false` when nothing
 * appeared, so the spec can name the gap instead of hanging on it.
 *
 * @module e2e/support/context-menu
 */
import type { Locator, Page } from '@playwright/test';

/** A context-menu container, whichever of the two neutral markers it uses. */
export const MENU_SELECTOR = '[data-pptx-context-menu="true"], [role="menu"]';

/**
 * The same contract narrowed to what is on screen.
 *
 * Several bindings keep closed menus mounted-but-hidden (the slides pane's
 * per-slide actions menu carries a "Duplicate" of its own), so a locator that
 * ignores visibility can resolve to a menu the user cannot see and then hang
 * waiting for it to become clickable.
 */
export const VISIBLE_MENU_SELECTOR =
	'[data-pptx-context-menu="true"]:visible, [role="menu"]:visible';

/** How long a right-click may take to paint a menu before we call it missing. */
export const MENU_TIMEOUT_MS = 4_000;

/** Viewport-relative click target. */
export interface Point {
	x: number;
	y: number;
}

/** One activatable entry in the menu. */
export interface MenuCommand {
	/** Visible label, whitespace-collapsed. */
	label: string;
	/** True when the binding renders the entry greyed out. */
	disabled: boolean;
}

/** Everything a parity check needs to know about an opened menu. */
export interface MenuSnapshot {
	/** False when the right-click produced no menu at all. */
	present: boolean;
	/** The container's `role`, or null when it declares none. */
	role: string | null;
	/** Distinct roles of the command nodes ("(none)" for an unroled button). */
	itemRoles: string[];
	commands: MenuCommand[];
	/** Lower-cased labels, the currency of every comparison here. */
	labels: string[];
}

/** The canonical (lower-cased) labels each coverage area expects. */
export const CLIPBOARD_COMMANDS = ['cut', 'copy', 'paste', 'duplicate', 'delete'] as const;
export const Z_ORDER_COMMANDS = [
	'bring forward',
	'send backward',
	'bring to front',
	'send to back',
] as const;
export const TABLE_ROW_COLUMN_COMMANDS = [
	'insert row above',
	'insert row below',
	'delete row',
	'insert column left',
	'insert column right',
	'delete column',
] as const;
/** A cell with no neighbouring span offers the two pairwise merges plus split. */
export const TABLE_MERGE_COMMANDS = ['merge right', 'merge down'] as const;
export const GROUP_COMMAND = 'group';
export const UNGROUP_COMMAND = 'ungroup';
export const HYPERLINK_COMMAND = 'edit hyperlink';
export const COMMENT_COMMAND = 'add comment';
export const DUPLICATE_COMMAND = 'duplicate';

/** Wording used whenever a binding never opened a menu, so reports read alike. */
export const NO_MENU = `no context menu appeared within ${MENU_TIMEOUT_MS}ms of the right-click`;

/**
 * Read the frontmost visible context menu.
 *
 * Ribbon popups also use `role="menu"`, so anything inside a toolbar is
 * excluded; of what remains the last in DOM order wins, since a menu is mounted
 * when it opens and therefore sorts after any older chrome.
 */
export async function readMenu(page: Page): Promise<MenuSnapshot> {
	return page.evaluate((selector) => {
		const empty = { present: false, role: null, itemRoles: [], commands: [], labels: [] };
		const menus = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
			(node) => node.checkVisibility() && !node.closest('[role="toolbar"]'),
		);
		const menu = menus.at(-1);
		if (!menu) {
			return empty;
		}
		const nodes = Array.from(
			menu.querySelectorAll<HTMLElement>('button, [role="menuitem"], [role="menuitemcheckbox"]'),
		);
		const commands = nodes
			.map((node) => ({
				label: (node.textContent ?? '').replace(/\s+/gu, ' ').trim(),
				disabled: node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true',
			}))
			.filter((command) => command.label.length > 0);
		return {
			present: true,
			role: menu.getAttribute('role'),
			itemRoles: Array.from(new Set(nodes.map((node) => node.getAttribute('role') ?? '(none)'))),
			commands,
			labels: commands.map((command) => command.label.toLowerCase()),
		};
	}, MENU_SELECTOR);
}

/**
 * Right-click at `point` and report what opened.
 *
 * The wait is bounded and swallowed on purpose: a binding with no context menu
 * must produce a named parity failure, not a locator timeout that buries the
 * finding in a stack trace.
 */
export async function openMenuAt(page: Page, point: Point): Promise<MenuSnapshot> {
	await page.mouse.click(point.x, point.y, { button: 'right' });
	await page
		.waitForFunction(
			(selector) =>
				Array.from(document.querySelectorAll<HTMLElement>(selector)).some(
					(node) => node.checkVisibility() && !node.closest('[role="toolbar"]'),
				),
			MENU_SELECTOR,
			{ timeout: MENU_TIMEOUT_MS },
		)
		.catch(() => undefined);
	return readMenu(page);
}

/** True while any context menu is on screen. */
export async function menuIsOpen(page: Page): Promise<boolean> {
	return (await readMenu(page)).present;
}

/** Centre of a rendered locator, in viewport coordinates. */
export async function centreOf(target: Locator): Promise<Point> {
	const box = await target.boundingBox();
	if (!box) {
		throw new Error('cannot aim at an element with no bounding box');
	}
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Right-click `target` and report what opened.
 *
 * Deliberately NOT preceded by a left click, even though the menu's commands
 * act on the selection: all four bindings that have a menu select the
 * right-clicked element themselves, and priming the selection with a left click
 * changes what is under the cursor. On Vue a single click on a text box mounts
 * an inline editor which then swallows the `contextmenu` event, so the primed
 * flow reports "no context menu" for a binding that has one. Right-click alone
 * is also what a user actually does.
 */
export async function openMenuOn(page: Page, target: Locator): Promise<MenuSnapshot> {
	return openMenuAt(page, await centreOf(target));
}

/**
 * Put the caret in a table cell, which is what gates the row/column commands.
 *
 * Two clicks: the first picks the table element, the second the cell inside it.
 * The centre is re-measured between them because selecting opens the properties
 * inspector, which narrows the canvas and moves the cell out from under a point
 * measured beforehand.
 */
export async function selectTableCell(page: Page, cell: Locator): Promise<void> {
	for (let press = 0; press < 2; press += 1) {
		const point = await centreOf(cell);
		await page.mouse.click(point.x, point.y);
		await page.waitForTimeout(350);
	}
}

/**
 * Rubber-band a selection across `targets` by dragging over them.
 *
 * The gesture, not shift-clicking, is how a multi-selection is made here:
 * React's element mousedown re-selects the clicked element before its click
 * handler can extend the selection, so shift-clicking leaves exactly one
 * element picked even in the reference binding. The drag starts in the empty
 * band between the targets' right edge and the stage's, because pressing on a
 * shape starts a move instead of a band.
 */
export async function marqueeAcross(page: Page, stage: Locator, targets: Locator[]): Promise<void> {
	const boxes = await Promise.all(targets.map((target) => target.boundingBox()));
	const stageBox = await stage.boundingBox();
	const rects = boxes.flatMap((box) => (box ? [box] : []));
	if (!stageBox || rects.length !== targets.length) {
		throw new Error('cannot rubber-band across elements that are not laid out');
	}
	const left = Math.min(...rects.map((rect) => rect.x));
	const top = Math.min(...rects.map((rect) => rect.y));
	const right = Math.max(...rects.map((rect) => rect.x + rect.width));
	const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
	const from = { x: right + (stageBox.x + stageBox.width - right) * 0.15, y: top - 10 };
	const to = { x: left + 5, y: bottom + 10 };

	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}

/**
 * Activate the menu entry whose label matches `label`, case-insensitively.
 *
 * The pattern tolerates surrounding whitespace because a regex `hasText` filter
 * matches raw text content: Angular's template indents its labels, so an
 * anchored `^Duplicate$` finds nothing there while matching everywhere else.
 */
export async function chooseCommand(page: Page, label: string): Promise<void> {
	await page
		.locator(VISIBLE_MENU_SELECTOR)
		.last()
		.locator('button:visible, [role="menuitem"]:visible')
		.filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'iu') })
		.first()
		.click();
	await page.waitForTimeout(600);
}

/** Commands `required` names that the snapshot does not offer at all. */
export function missingFrom(
	snapshot: MenuSnapshot,
	required: readonly string[],
): readonly string[] {
	return required.filter((command) => !snapshot.labels.includes(command));
}

/** The command, or null when the menu has no such entry. */
export function commandNamed(snapshot: MenuSnapshot, label: string): MenuCommand | null {
	return snapshot.commands.find((command) => command.label.toLowerCase() === label) ?? null;
}

/** Prefix each problem with the binding that has it, for a one-shot report. */
export function report(binding: string, problems: readonly string[]): string[] {
	return problems.map((problem) => `${binding}: ${problem}`);
}

/** Elements rendered on the main canvas (thumbnails live in their own stages). */
export function stageElements(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"]').first().locator('[data-pptx-element]');
}

/** Jump the editor to a slide via the neutral thumbnail-rail contract. */
export async function goToSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(700);
}
