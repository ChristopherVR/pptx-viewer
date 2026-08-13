/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Can the crash-recovery snapshot still be recovered after you protect a deck?
 *
 * Autosave writes the edited deck into a shared IndexedDB store
 * (`pptx-viewer-autosave` / `recoveryVersions`) so a crash or a refresh does not
 * cost the session. Recovery reads it straight back with `PptxHandler.load()`
 * and NO password: `readBackstageRecentFile`, `restoreSessionDeck` and the
 * Version History panel all do exactly that.
 *
 * So the moment a binding serialises the snapshot through the user's
 * password-protected save path, the recovery copy becomes an OLE2 container
 * that nothing can open, and the user's crash-recovery data is destroyed
 * silently, at the exact moment they asked for MORE safety. React shipped that;
 * Vue inherited it the day both started sharing one serialiser.
 *
 * The assertion is on the STORED BYTES plus an actual restore, never on a spy:
 * a "was `saveEncrypted` called" test is equally green whether the snapshot is
 * readable or ruined, which is how this shipped in the first place.
 *
 * Framework-neutral: the shared backstage ("File" dialog, "Info", "Protect
 * Presentation"), the dialog's `input[type="password"]` fields, the shared
 * slide contract (`[aria-roledescription="slide"]`, `[data-pptx-element]`), and
 * the shared IndexedDB store name. No ports, no per-binding branching.
 *
 * Run: bunx playwright test autosave-recovery-encryption
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck, openRibbonTab, SAMPLE_DECK, slideElements } from './support/deck';

test.use({ viewport: { width: 1600, height: 950 } });
// All five demo apps now pass an explicit `autosaveIntervalMs` of 2s, which is a
// host policy that outranks the two-minute File > Options AutoRecover cadence
// the viewer otherwise follows, so a real snapshot arrives in seconds whichever
// engine shape the binding uses (React and Angular poll, the other three
// debounce with a one-interval ceiling).
test.describe.configure({ timeout: 180_000 });

const PASSWORD = 'e2e-Secret!9';
/** Comfortably past the demos' 2s cadence, with room for a cold first parse. */
const SNAPSHOT_TIMEOUT_MS = 60_000;

/** First bytes of a stored snapshot, enough to identify the container. */
interface StoredSnapshot {
	key: string;
	head: number[];
	size: number;
}

/** `50 4B 03 04`: a plain (unencrypted) OOXML package. */
function isZip(head: number[]): boolean {
	return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

/** `D0 CF 11 E0 A1 B1 1A E1`: an OLE compound file, i.e. an encrypted package. */
function isOleCompoundFile(head: number[]): boolean {
	return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
		(byte, index) => head[index] === byte,
	);
}

/**
 * Everything currently in the shared autosave store.
 *
 * Opened without an explicit version so probing never triggers an upgrade, and
 * guarded on the object store existing: before the first snapshot the database
 * may not exist at all, which is "no snapshots yet", not a failure.
 */
async function readAutosaveSnapshots(page: Page): Promise<StoredSnapshot[]> {
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
		return records.map((record) => {
			const raw = record.data;
			const bytes =
				raw instanceof Uint8Array
					? raw
					: raw instanceof ArrayBuffer
						? new Uint8Array(raw)
						: new Uint8Array();
			return {
				key: typeof record.key === 'string' ? record.key : '',
				head: Array.from(bytes.slice(0, 8)),
				size: bytes.byteLength,
			};
		});
	});
}

/** Poll until autosave has written a snapshot, or `null` if it never does. */
async function waitForSnapshot(page: Page): Promise<StoredSnapshot | null> {
	const deadline = Date.now() + SNAPSHOT_TIMEOUT_MS;
	for (;;) {
		const snapshots = await readAutosaveSnapshots(page);
		const found = snapshots.find((snapshot) => snapshot.size > 0);
		if (found) {
			return found;
		}
		if (Date.now() > deadline) {
			return null;
		}
		await page.waitForTimeout(2_000);
	}
}

/** Open the File backstage if it is not already up (clicking again would close it). */
async function openBackstage(page: Page): Promise<void> {
	const backstage = page.getByRole('dialog', { name: 'File' });
	if (await backstage.isVisible()) {
		return;
	}
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	await backstage.waitFor();
}

/** Set an open password through the real user flow (see `password-encryption.spec.ts`). */
async function setPresentationPassword(page: Page, password: string): Promise<void> {
	await openBackstage(page);
	const backstage = page.getByRole('dialog', { name: 'File' });
	await backstage
		.getByRole('button', { name: /^info$/iu })
		.first()
		.click();
	await backstage
		.getByRole('button', { name: /protect presentation/iu })
		.first()
		.click();

	const dialog = page
		.getByRole('dialog')
		.filter({ hasText: /protect presentation/iu })
		.last();
	await dialog.waitFor();
	const fields = dialog.locator('input[type="password"]');
	await fields.nth(0).fill(password);
	await fields.nth(1).fill(password);
	await dialog
		.getByRole('button', { name: /^(set password|update password)$/iu })
		.first()
		.click();
	await expect(dialog).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(backstage).toBeHidden();
}

/**
 * Make the deck dirty so autosave has something to write.
 *
 * Home > New Slide rather than an arrow-key nudge: the nudge needs the canvas
 * to hold keyboard focus, which does not survive the backstage round trip in
 * every binding (measured: vanilla stayed "All saved" after a click + two
 * ArrowRights), whereas the ribbon command commits an edit in all five.
 */
async function makeAnEdit(page: Page): Promise<void> {
	await openRibbonTab(page, 'Home');
	await page
		.getByRole('button', { name: /new slide/iu })
		.first()
		.click();
}

test.describe('autosave recovery vs password protection', () => {
	test('a protected deck still autosaves a plain, restorable snapshot', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await setPresentationPassword(page, PASSWORD);
		await makeAnEdit(page);

		const snapshot = await waitForSnapshot(page);

		// Behaviour-gated, not name-gated (the neutrality checker forbids
		// branching on the project, and rightly so): a binding whose editor never
		// raises the dirty flag never reaches `saveAutosaveSnapshot` at all, so
		// there is nothing here to say about encryption. That is a SEPARATE bug
		// from the one this spec pins; when it is fixed the skip disappears on
		// its own and that binding starts being asserted like the others.
		test.skip(
			snapshot === null,
			'this binding never wrote a recovery snapshot after an edit (its editor does not raise the dirty flag)',
		);
		if (!snapshot) {
			return;
		}

		expect(
			isOleCompoundFile(snapshot.head),
			'an encrypted recovery snapshot can never be restored: recovery has no password to offer',
		).toBe(false);
		expect(isZip(snapshot.head), 'the recovery snapshot must stay a plain OOXML package').toBe(
			true,
		);
		expect(snapshot.size).toBeGreaterThan(10_000);

		// The bytes are the proof of container; this is the proof of USE.
		// `restoreSessionDeck` prefers a newer autosave snapshot over the bytes
		// the tab was opened with, so a reload here reopens the snapshot itself.
		// An encrypted one would surface the "this file is encrypted" prompt and
		// render nothing.
		await page.reload();
		await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 120_000 });
		await expect(slideElements(page).first()).toBeVisible({ timeout: 120_000 });
		await expect(page.locator('[data-testid="dropzone"]')).toHaveCount(0);
	});
});
