/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `@`-mentions in a MODERN (`p188`) threaded comment, across every binding.
 *
 * Before this, mentions had no model at all: `PptxComment` carried no mentions
 * field and no binding had any mention UI, so an `@Bob Grant` in a real deck
 * rendered as inert plain text indistinguishable from the rest of the body.
 * The offsets were also never re-based when the body was edited, so a surviving
 * `p188:mentionLst` could end up pointing at the wrong characters.
 *
 * The fixture is a PowerPoint-authored modern comment (COM), with only the
 * second `p188:author` and the `p188:mentionLst` span injected afterwards,
 * because a mention needs a real M365/AAD identity and cannot be authored
 * through COM. PowerPoint reopens it cleanly.
 *
 * The neutral contract every binding stamps is `data-pptx-comment-mention`
 * (`COMMENT_MENTION_ATTRIBUTE` in `pptx-viewer-shared`), carrying the
 * mentioned person's `p188:author` id.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { commentTextVisible, openCommentsThread } from './support/comments';
import { resetTabSession } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/comment-mentions.pptx', import.meta.url)),
);

/** The whole comment body, and the span the `p188:mention` covers. */
const COMMENT_TEXT = 'Please check this with @Bob Grant before Friday';
const MENTION_TEXT = '@Bob Grant';
const MENTION_PERSON_ID = '{7C9E4A21-5F30-4C88-9B1E-2D6A0F4B7E15}';

async function openDeck(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-element-id]').first().waitFor();
}

test.describe('modern comment mentions', () => {
	test('renders the mention span distinctly, carrying the author id', async ({ page }) => {
		await openDeck(page);
		await openCommentsThread(page, COMMENT_TEXT);

		const mention = page.locator('[data-pptx-comment-mention]').first();
		await expect(mention).toBeVisible();
		await expect(mention).toHaveText(MENTION_TEXT);
		await expect(mention).toHaveAttribute('data-pptx-comment-mention', MENTION_PERSON_ID);

		// The rest of the body must stay outside the mention span: a segmenter
		// that swallowed the whole string would still satisfy a text assertion
		// on the mention alone.
		const inside = await mention.evaluate((el) => el.textContent ?? '');
		expect(inside).not.toContain('Please check');
		expect(inside).not.toContain('before Friday');
	});

	test('shows the full comment body around the mention', async ({ page }) => {
		await openDeck(page);
		await openCommentsThread(page, COMMENT_TEXT);

		// Read through the segment spans rather than asserting on a particular
		// DOM shape: the five bindings nest the mention differently (a <p>, a
		// <span>, a component host), so a parent-relative locator tests the
		// binding's markup instead of the behaviour. What must hold everywhere
		// is that segmenting the body did not LOSE any of it.
		await expect.poll(() => commentTextVisible(page, COMMENT_TEXT)).toBe(true);
	});
});
