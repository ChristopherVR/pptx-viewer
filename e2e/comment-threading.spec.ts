/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Comment threading across every viewer binding (desktop viewport).
 *
 * Covers the full life of a comment: creating one on a selected element via
 * the canvas context menu's "Add Comment", seeing it listed in the comments
 * UI, replying to the thread, resolving it, and the on-canvas marker dot.
 *
 * The five comment surfaces share no component, so everything here goes
 * through `support/comments`, which pins the semantic contract they do share
 * (a compose textarea mentioning "comment", an "Add Comment" submit, readable
 * comment text) and names the genuine capability gaps as per-project
 * exclusions: reply is missing from two bindings and the canvas marker
 * overlay from three, and skipping those with a reason beats disguising a
 * parity gap as a locator timeout. The exclusion lists live in the support
 * module because spec files must stay framework-neutral.
 *
 * Run: bunx playwright test comment-threading
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	addCommentViaContextMenu,
	commentMarker,
	commentMarkerGap,
	commentReplyGap,
	commentTextVisible,
	ensureCommentsListShowing,
	openCommentsThread,
	replyNestedUnderParent,
	resolveFirstComment,
	RESOLVE_BUTTON_SELECTOR,
	resolvedStateVisible,
	startReply,
	submitReply,
} from './support/comments';
import { loadDeck, SAMPLE_DECK, slideElements } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

/** A text box on slide 1 of the sample deck, used as the comment anchor. */
const SHAPE_TEXT = 'Product Overview';

/** Distinct texts per test so a leftover surface can never satisfy an assert. */
const ADDED_COMMENT = 'Ship the Q3 numbers here';
const PARENT_COMMENT = 'Please tighten this headline';
const REPLY_COMMENT = 'Agreed, shortened it';
const RESOLVED_COMMENT = 'Check the brand colour';
const MARKED_COMMENT = 'Marker anchor check';

/** Load the sample deck and return the anchor shape on the main canvas. */
async function openDeckWithShape(page: Page): Promise<Locator> {
	await loadDeck(page, SAMPLE_DECK);
	const shape = slideElements(page).filter({ hasText: SHAPE_TEXT }).first();
	await shape.waitFor();
	await page.waitForTimeout(400);
	return shape;
}

test.describe('comment threading', () => {
	test('adding a comment via the context menu lists it in the comments UI', async ({ page }) => {
		const shape = await openDeckWithShape(page);

		await addCommentViaContextMenu(page, shape, ADDED_COMMENT);
		// Vanilla's workspace pane closes itself after a successful add, so the
		// list may need reopening before the text is verifiable.
		await ensureCommentsListShowing(page, ADDED_COMMENT);

		await expect.poll(() => commentTextVisible(page, ADDED_COMMENT)).toBe(true);
	});

	test('replying to a comment renders the reply under the parent', async ({ page }, testInfo) => {
		const gap = commentReplyGap(testInfo.project.name);
		test.skip(gap !== null, gap ?? '');

		const shape = await openDeckWithShape(page);
		await addCommentViaContextMenu(page, shape, PARENT_COMMENT);
		await openCommentsThread(page, PARENT_COMMENT);
		await expect.poll(() => commentTextVisible(page, PARENT_COMMENT)).toBe(true);

		expect(await startReply(page), 'a Reply affordance should exist on the thread').toBe(true);
		await submitReply(page, REPLY_COMMENT);

		await expect.poll(() => commentTextVisible(page, REPLY_COMMENT)).toBe(true);
		await expect.poll(() => replyNestedUnderParent(page, PARENT_COMMENT, REPLY_COMMENT)).toBe(true);
	});

	test('resolving a thread shows a visible resolved state', async ({ page }) => {
		const shape = await openDeckWithShape(page);
		await addCommentViaContextMenu(page, shape, RESOLVED_COMMENT);
		// The thread UI, not the one-shot pane: see `openCommentsThread` on why
		// the resolve toggle must be exercised against a reactive surface.
		await openCommentsThread(page, RESOLVED_COMMENT);
		await expect.poll(() => commentTextVisible(page, RESOLVED_COMMENT)).toBe(true);

		await expect(page.locator(RESOLVE_BUTTON_SELECTOR).first()).toBeVisible();
		await resolveFirstComment(page);

		await expect.poll(() => resolvedStateVisible(page)).toBe(true);
	});

	test('a comment marker is rendered on the slide canvas', async ({ page }, testInfo) => {
		const gap = commentMarkerGap(testInfo.project.name);
		test.skip(gap !== null, gap ?? '');

		const shape = await openDeckWithShape(page);
		await addCommentViaContextMenu(page, shape, MARKED_COMMENT);
		await ensureCommentsListShowing(page, MARKED_COMMENT);

		// Both marker implementations title the dot "<author>: <text>".
		await expect(commentMarker(page, MARKED_COMMENT).first()).toBeVisible();
	});
});
