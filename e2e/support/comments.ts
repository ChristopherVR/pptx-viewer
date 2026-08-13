/**
 * Neutral hooks for the five bindings' comment UIs.
 *
 * There is no shared component behind the comment surfaces: React renders an
 * inspector comments section, Vue and Angular a dedicated side panel, Svelte a
 * Review/inspector panel, and Vanilla both a live workspace pane and an
 * inspector Comments tab. The one contract they all honour is semantic: "Add
 * Comment" surfaces a compose `<textarea>` whose placeholder or accessible
 * name mentions "comment", an "Add Comment" button commits it, and the text is
 * then readable somewhere visible (Vanilla renders it as a textarea VALUE, so
 * text-node checks alone under-count). Every binding now offers a reply
 * affordance and draws the numbered canvas marker dots (backed by the shared
 * `buildCommentMarkers`), so the per-project exclusion maps below are empty;
 * they stay as the registration point should a future regression need a named
 * skip. Spec files may not branch on the project name; this module is exempt.
 * @module e2e/support/comments
 */
import type { Locator, Page } from '@playwright/test';

import { chooseCommand, menuIsOpen, openMenuOn } from './context-menu';

/** The compose textarea every binding shows for a new comment. */
export const COMPOSE_BOX_SELECTOR =
	'textarea[placeholder*="comment" i]:visible, textarea[aria-label*="comment" i]:visible';

/** The reply composer textarea (only bindings with reply support mount one). */
export const REPLY_BOX_SELECTOR =
	'textarea[placeholder*="reply" i]:visible, textarea[aria-label*="reply" i]:visible';

/**
 * A visible "Reply" affordance: React uses an icon button carrying only a
 * `title`, Vue/Vanilla label the button with text.
 */
export const REPLY_BUTTON_SELECTOR =
	'button:visible[title="Reply"], button:visible:text-is("Reply")';

/** A visible "Resolve" affordance (React: title-only icon button). */
export const RESOLVE_BUTTON_SELECTOR =
	'button:visible[title="Resolve"], button:visible:text-is("Resolve")';

/**
 * Bindings whose comment UI offers no reply affordance anywhere. Empty: every
 * binding supports threaded replies (Angular's `CommentsPanelComponent` and
 * Svelte's `ReviewCommentsPanel` gained reply composers alongside the
 * React/Vue/Vanilla thread UIs).
 */
const REPLY_GAPS: Readonly<Record<string, string>> = {};

/**
 * Bindings that render no comment marker overlay on the canvas. Empty: all
 * five draw the numbered dots via the shared `buildCommentMarkers` (shown
 * whenever an editable slide has comments; React's remain tied to its open
 * comments sidebar).
 */
const MARKER_GAPS: Readonly<Record<string, string>> = {};

/** The reply exclusion for `project`, or null when replies are expected. */
export function commentReplyGap(project: string): string | null {
	return REPLY_GAPS[project] ?? null;
}

/** The canvas-marker exclusion for `project`, or null when markers are expected. */
export function commentMarkerGap(project: string): string | null {
	return MARKER_GAPS[project] ?? null;
}

/**
 * True while `text` is readable in any visible element OR as the value of a
 * visible textarea/input (Vanilla's pane shows comment text as a field value).
 *
 * Matches the DEEPEST visible element containing `text`, rather than requiring
 * a childless leaf. The leaf rule broke the moment comment bodies gained
 * `@`-mention rendering: every binding now splits a body into one span per
 * `CommentTextSegment`, so a needle that straddles a mention has no single leaf
 * containing it, and this returned false while the comment was plainly on
 * screen. `openCommentsThread` then treated an already-open panel as closed and
 * fired the toolbar toggle, which CLOSED it (observed on Svelte: the mention
 * rendered after the inspector tab click, then vanished). Taking the deepest
 * match keeps the check just as tight - `document.body` never qualifies,
 * because a child element also contains the needle - while spanning segments.
 */
export function commentTextVisible(page: Page, text: string): Promise<boolean> {
	return page.evaluate((needle) => {
		for (const el of document.querySelectorAll<HTMLElement>('*')) {
			if (!el.textContent?.includes(needle) || !el.checkVisibility()) {
				continue;
			}
			const deeper = [...el.children].some((child) => child.textContent?.includes(needle));
			if (!deeper) {
				return true;
			}
		}
		for (const field of document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
			'textarea, input',
		)) {
			if (field.value.includes(needle) && field.checkVisibility()) {
				return true;
			}
		}
		return false;
	}, text);
}

/**
 * Create a comment on `target` through the canvas context menu. Right-click
 * selects the element in every binding, so the comment is anchored to it where
 * anchoring is supported. Throws when the menu lacks the command, because that
 * would already be a context-menu parity regression.
 */
export async function addCommentViaContextMenu(
	page: Page,
	target: Locator,
	text: string,
): Promise<void> {
	const menu = await openMenuOn(page, target);
	if (!menu.labels.includes('add comment')) {
		throw new Error(
			`context menu offered no "add comment" (labels: ${menu.labels.join(', ') || 'none'})`,
		);
	}
	await chooseCommand(page, 'Add Comment');
	// Belt-and-braces: every binding's menu closes itself on command (React's
	// dispatch wraps all entries in `andClose` since the backdrop-leak fix), so
	// this Escape is normally a no-op; it just keeps the helper robust if a
	// menu ever lingers.
	if (await menuIsOpen(page)) {
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);
	}
	const compose = page.locator(COMPOSE_BOX_SELECTOR).first();
	await compose.waitFor();
	await compose.fill(text);
	await page.locator('button:visible:text-is("Add Comment")').last().click();
	await page.waitForTimeout(500);
}

/**
 * Make sure the comments UI showing `text` is on screen. Usually a no-op (the
 * surface that took the add stays open and re-renders); if the list is not
 * visible for any reason, the toolbar "Comments" toggle (present in every
 * binding) brings it up, and is only clicked when the text is not already
 * visible.
 */
export async function ensureCommentsListShowing(page: Page, text: string): Promise<void> {
	if (await commentTextVisible(page, text)) {
		return;
	}
	await page
		.getByRole('button', { name: /^comments$/iu })
		.first()
		.click();
	await page.waitForTimeout(500);
}

/**
 * Open the inspector's Comments tab when the binding has one (Vanilla and
 * Svelte mount their thread UI behind a `role="tab"` strip; no ribbon tab is
 * named "Comments", so the name is unambiguous).
 * @returns true when a visible Comments tab was found and clicked.
 */
export async function openCommentsTabIfPresent(page: Page): Promise<boolean> {
	for (const tab of await page.getByRole('tab', { name: /^comments$/iu }).all()) {
		if (await tab.isVisible()) {
			await tab.click();
			await page.waitForTimeout(400);
			return true;
		}
	}
	return false;
}

/**
 * Bring the interactive comment THREAD UI on screen after an add. Whatever
 * panel the add left open already shows the full thread in every binding
 * (Vanilla's workspace pane renders the same threaded view as its inspector
 * tab, and stays open); the inspector tab is only opened when the comment is
 * not visible anywhere, and the toolbar toggle is the last resort.
 */
export async function openCommentsThread(page: Page, text: string): Promise<void> {
	if (await commentTextVisible(page, text)) {
		return;
	}
	await openCommentsTabIfPresent(page);
	if (!(await commentTextVisible(page, text))) {
		await ensureCommentsListShowing(page, text);
	}
}

/**
 * Open a reply composer. Every binding's primary comments panel now carries the
 * affordance; the inspector Comments tab is kept only as a fallback for a
 * binding that surfaces threads exclusively there.
 * @returns false when no reply affordance exists anywhere.
 */
export async function startReply(page: Page): Promise<boolean> {
	let button = page.locator(REPLY_BUTTON_SELECTOR).first();
	if ((await button.count()) === 0) {
		if (!(await openCommentsTabIfPresent(page))) {
			return false;
		}
		button = page.locator(REPLY_BUTTON_SELECTOR).first();
		if ((await button.count()) === 0) {
			return false;
		}
	}
	await button.click();
	await page.waitForTimeout(300);
	return true;
}

/**
 * Fill the open reply composer and submit it. The submit button carries the
 * label "Reply" in every binding that has the feature; it renders after the
 * per-comment action buttons, so the LAST enabled match is the submit.
 */
export async function submitReply(page: Page, text: string): Promise<void> {
	const box = page.locator(REPLY_BOX_SELECTOR).first();
	await box.waitFor();
	await box.fill(text);
	await page
		.locator(
			'button:visible:not([disabled]):text-is("Reply"), button:visible:not([disabled])[title="Reply"]',
		)
		.last()
		.click();
	await page.waitForTimeout(500);
}

/**
 * True when `replyText` renders NESTED under the comment that says
 * `parentText`: some ancestor of the reply's text node also contains the
 * parent's text without containing the add-comment compose box, i.e. it is a
 * thread card, not the whole panel.
 */
export function replyNestedUnderParent(
	page: Page,
	parentText: string,
	replyText: string,
): Promise<boolean> {
	return page.evaluate(
		({ parent, reply }) => {
			const leaves = [...document.querySelectorAll<HTMLElement>('*')].filter(
				(el) => el.children.length === 0 && el.textContent?.includes(reply) && el.checkVisibility(),
			);
			for (const leaf of leaves) {
				let node: HTMLElement | null = leaf.parentElement;
				while (node !== null) {
					const container: HTMLElement = node;
					node = container.parentElement;
					if (!container.textContent?.includes(parent)) {
						continue;
					}
					// First ancestor containing the parent text: a thread card keeps
					// the compose textarea outside itself, the panel root does not.
					const hasCompose = [...container.querySelectorAll('textarea')].some((field) =>
						/comment/iu.test(
							(field.getAttribute('placeholder') ?? '') + (field.getAttribute('aria-label') ?? ''),
						),
					);
					return !hasCompose;
				}
			}
			return false;
		},
		{ parent: parentText, reply: replyText },
	);
}

/** Toggle the first visible Resolve affordance. */
export async function resolveFirstComment(page: Page): Promise<void> {
	await page.locator(RESOLVE_BUTTON_SELECTOR).first().click();
	await page.waitForTimeout(400);
}

/**
 * True while a resolved state is visibly communicated: a "resolved" class on
 * the card (Angular/Vue/Svelte/Vanilla), a visible "Resolved" badge (React and
 * Svelte), or the affordance flipping to Unresolve/Reopen (all of them).
 */
export function resolvedStateVisible(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>('*')) {
			if (!el.checkVisibility()) {
				continue;
			}
			if (/(^|[\s_-])(is-)?resolved([\s_-]|$)/iu.test(el.getAttribute('class') ?? '')) {
				return true;
			}
			if (el.children.length === 0 && (el.textContent ?? '').trim() === 'Resolved') {
				return true;
			}
			if (
				el.tagName === 'BUTTON' &&
				/^(unresolve|reopen)$/iu.test(((el.textContent || el.title) ?? '').trim())
			) {
				return true;
			}
		}
		return false;
	});
}

/**
 * The canvas comment-marker dot for the comment whose text is `text`. Every
 * binding titles the dot `"<author>: <text>"` (the shared `buildCommentMarkers`
 * contract), the only neutral hook they share (React's markers carry no class
 * or data marks).
 */
export function commentMarker(page: Page, text: string): Locator {
	return page.locator('[aria-roledescription="slide"]').first().locator(`[title*="${text}"]`);
}
