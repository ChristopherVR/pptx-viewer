/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does the viewer OFFER the crash-recovery snapshot it just wrote?
 *
 * Every binding has written recovery snapshots into the shared IndexedDB store
 * (`pptx-viewer-autosave` / `recoveryVersions`) for a long time. Only React ever
 * looked for one again, and even it just flung the Version History panel open,
 * which never says the word "recover". In the other four the data was there and
 * nothing surfaced it: a user whose tab crashed reopened the deck and silently
 * got the pre-crash version back, with no hint that newer work existed.
 *
 * The flow asserted here is the whole feature end to end:
 *   edit -> a snapshot lands in IndexedDB -> reopen the deck in a fresh session
 *   -> a "Recover unsaved changes?" dialog appears -> Restore reloads the deck.
 *
 * Framework-neutral: the shared `data-pptx-autosave-recovery` marker, the
 * dialog's Restore/Discard buttons by accessible name, the shared slide
 * contract, and the shared IndexedDB store name. No ports, no per-binding
 * branching.
 *
 * Run: bunx playwright test autosave-recovery-prompt
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	loadDeck,
	openRibbonTab,
	SAMPLE_DECK,
	selectElement,
	slideElements,
	thumbnail,
	viewport,
	zoomFitButton,
} from './support/deck';

/**
 * Reopen the same deck as a FRESH TAB would, keeping the recovery snapshot.
 *
 * Not `loadDeck`: that also drops the shared autosave store, because a spec that
 * reloads a deck would otherwise meet a modal left by its own earlier run (see
 * `resetTabSession`). Here the snapshot is the whole point, so only the
 * `sessionStorage` half is cleared: that is what makes the load land on the
 * landing dropzone AND drops the per-tab "already consumed this snapshot"
 * marker, which is precisely the state a crashed-and-reopened tab is in.
 */
async function reopenDeckKeepingSnapshot(page: Page): Promise<void> {
	await page.evaluate(() => {
		try {
			sessionStorage.clear();
		} catch {
			/* nothing to forget */
		}
	});
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(SAMPLE_DECK);
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 60_000 });
}

test.use({ viewport: { width: 1600, height: 950 } });
// The demo apps pass an explicit `autosaveIntervalMs` of 2s (a host policy that
// outranks the two-minute File > Options AutoRecover cadence), so waiting for a
// real snapshot is quick. The budget still allows for a cold dev server.
test.describe.configure({ timeout: 180_000 });

/** Comfortably past the demos' 2s cadence, with room for a cold first parse. */
const SNAPSHOT_TIMEOUT_MS = 60_000;

/** How many snapshots the shared store currently holds, with a non-empty blob. */
async function countSnapshots(page: Page): Promise<number> {
	return page.evaluate(async () => {
		const records = await new Promise<Array<Record<string, unknown>>>((resolve) => {
			const request = indexedDB.open('pptx-viewer-autosave');
			request.onerror = () => resolve([]);
			request.onsuccess = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('recoveryVersions')) {
					db.close();
					resolve([]);
					return;
				}
				const all = db
					.transaction('recoveryVersions', 'readonly')
					.objectStore('recoveryVersions')
					.getAll();
				all.onerror = () => {
					db.close();
					resolve([]);
				};
				all.onsuccess = () => {
					db.close();
					resolve(all.result as Array<Record<string, unknown>>);
				};
			};
		});
		return records.filter((record) => {
			const raw = record.data;
			const size =
				raw instanceof Uint8Array
					? raw.byteLength
					: raw instanceof ArrayBuffer
						? raw.byteLength
						: 0;
			return size > 0;
		}).length;
	});
}

/** Poll until autosave has written at least one snapshot. */
async function waitForSnapshot(page: Page): Promise<boolean> {
	const deadline = Date.now() + SNAPSHOT_TIMEOUT_MS;
	for (;;) {
		if ((await countSnapshots(page)) > 0) {
			return true;
		}
		if (Date.now() > deadline) {
			return false;
		}
		await page.waitForTimeout(1_000);
	}
}

/**
 * Make the deck dirty so autosave has something to write.
 *
 * Home > New Slide rather than a keyboard nudge: the ribbon command commits an
 * edit in all five bindings without depending on canvas focus (measured in
 * `autosave-recovery-encryption.spec.ts`, where the nudge did not).
 */
async function makeAnEdit(page: Page): Promise<void> {
	await openRibbonTab(page, 'Home');
	await page
		.getByRole('button', { name: /new slide/iu })
		.first()
		.click();
}

/**
 * The prompt, by its role and accessible name.
 *
 * Not by the `data-pptx-autosave-recovery` marker alone: three bindings stamp it
 * on the overlay that owns the dialog, and two on a component host element that
 * has no box of its own, so a visibility check against it would pass in some
 * bindings and fail in others for reasons that have nothing to do with whether
 * the user can see the prompt. The marker is asserted separately, as presence.
 */
const recoveryDialog = (page: Page) =>
	page.getByRole('dialog', { name: /recover unsaved changes/iu });

test.describe('crash-recovery prompt', () => {
	test('a snapshot written after an edit is offered back on the next open', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		// Nothing to recover on a first open, and a dialog here would mean the
		// viewer was offering the user bytes they already have.
		await expect(recoveryDialog(page)).toHaveCount(0);

		await makeAnEdit(page);
		const wrote = await waitForSnapshot(page);

		// Behaviour-gated, not name-gated (the neutrality checker forbids branching
		// on the project, and rightly so): a binding whose editor never raises the
		// dirty flag never reaches `saveAutosaveSnapshot`, so there is no snapshot
		// for this spec to say anything about. That is a SEPARATE defect from the
		// one asserted here, and when it is fixed the skip disappears on its own.
		test.skip(!wrote, 'this binding never wrote a recovery snapshot after an edit');

		// What a crashed tab looks like from the viewer's side: the same deck
		// opened with no session behind it, and the snapshot still on disk.
		await reopenDeckKeepingSnapshot(page);

		const dialog = recoveryDialog(page);
		await expect(dialog).toBeVisible({ timeout: 30_000 });
		// The shared marker every binding stamps, so a future spec can find the
		// prompt without depending on English copy.
		expect(await page.locator('[data-pptx-autosave-recovery]').count()).toBeGreaterThan(0);
		await expect(dialog.getByRole('button', { name: /^restore$/iu })).toBeVisible();
		await expect(dialog.getByRole('button', { name: /^discard$/iu })).toBeVisible();

		await dialog.getByRole('button', { name: /^restore$/iu }).click();
		await expect(dialog).toHaveCount(0);

		// The restored bytes are a real deck, not an empty stage: an unopenable
		// snapshot would leave the dropzone up (see the encryption spec).
		await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 60_000 });
		await expect(slideElements(page).first()).toBeVisible({ timeout: 60_000 });
		await expect(page.locator('[data-testid="dropzone"]')).toHaveCount(0);
	});

	test('Discard drops the snapshot instead of loading it', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await makeAnEdit(page);
		const wrote = await waitForSnapshot(page);
		test.skip(!wrote, 'this binding never wrote a recovery snapshot after an edit');

		await reopenDeckKeepingSnapshot(page);
		const dialog = recoveryDialog(page);
		await expect(dialog).toBeVisible({ timeout: 30_000 });
		await dialog.getByRole('button', { name: /^discard$/iu }).click();
		await expect(dialog).toHaveCount(0);

		// Discard is destructive on purpose: leaving the file behind would ask
		// again in the next tab. The deck the user opened stays on screen.
		await expect(slideElements(page).first()).toBeVisible({ timeout: 60_000 });
		expect(await countSnapshots(page)).toBe(0);
	});
});

/**
 * The other side of the same promise: a session that only READ the deck must
 * leave nothing behind to recover.
 *
 * A snapshot is not free. It is the sole input to the modal above, so a viewer
 * that writes one for a deck nobody edited will interrupt the user's NEXT visit
 * to offer changes that never existed - and, having been offered them, they
 * cannot tell whether declining loses real work.
 *
 * Three of five bindings did exactly that, for two different reasons that
 * looked identical from here:
 *
 *  - React inferred "the deck changed" by comparing its whole history snapshot,
 *    which carries `activeSlideIndex` so undo can return to the right slide.
 *    Clicking a thumbnail therefore read as a document mutation (and pushed an
 *    undo entry too).
 *  - Vue and Svelte both arm on a reassignment of the slide array, and the LOAD
 *    reassigns it. Each had a defence that did not quite hold: Vue cleared the
 *    dirty flag once loading settled but left the armed timer running, and
 *    Svelte's reseed check keyed off a load counter that moves one flush before
 *    the slides it describes.
 *
 * Angular and Vanilla raise dirty from explicit commit choke points and were
 * clean throughout, which is what made this a parity bug rather than a matter
 * of taste.
 *
 * The interactions below are the read-only vocabulary of just looking at a
 * deck. The edit at the end is not decoration: the cheap way to pass this test
 * is to stop writing snapshots, and that would cost every user their crash
 * recovery, so both directions are asserted in one test.
 */
test.describe('a read-only session', () => {
	test('writes no recovery snapshot until something is actually edited', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		// A load on its own. Two bindings failed here, before any interaction.
		await page.waitForTimeout(SETTLE_MS);
		expect(await countSnapshots(page), 'opening a deck is not editing it').toBe(0);

		// Navigation. The reported symptom: one thumbnail click was enough.
		await thumbnail(page, 3).click();
		await thumbnail(page, 1).click();
		await page.waitForTimeout(SETTLE_MS);
		expect(await countSnapshots(page), 'selecting a slide is navigation, not an edit').toBe(0);

		// The neighbours: scrolling, zooming, switching ribbon tabs, selecting an
		// element, and running the show. Every one of them changes viewer state,
		// and none of them changes the document.
		await viewport(page).hover();
		await page.mouse.wheel(0, 300);
		await openRibbonTab(page, 'Insert');
		await openRibbonTab(page, 'Home');
		await selectElement(page, slideElements(page).first());
		// Deselect: with an element selected, an arrow key is a NUDGE, which is a
		// real edit and would make the assertions below meaningless.
		await page.keyboard.press('Escape');
		await zoomFitButton(page).click();
		await page.waitForTimeout(SETTLE_MS);
		expect(await countSnapshots(page), 'reading the deck is not editing it').toBe(0);

		await page
			.getByRole('button', { name: /^present$|slide show/iu })
			.first()
			.click();
		await page.locator('[data-pptx-presenting]').first().waitFor({ timeout: 30_000 });
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(SETTLE_MS);
		expect(await countSnapshots(page), 'presenting a deck is not editing it').toBe(0);

		// And the control: the moment there IS an edit, a snapshot must appear, or
		// this spec would be satisfied by a viewer with no crash recovery at all.
		await makeAnEdit(page);
		expect(await waitForSnapshot(page), 'a real edit must still be recoverable').toBeTruthy();
	});
});

/**
 * Long enough for a snapshot to land if one was going to. The demos pass a 2s
 * `autosaveIntervalMs`, and the polling engines need a whole tick.
 */
const SETTLE_MS = 5_000;
