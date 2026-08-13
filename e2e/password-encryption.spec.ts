/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does "Encrypt with Password" actually encrypt the file?
 *
 * The parity audit found the worst kind of defect: File > Info > Protect
 * Presentation was a complete dialog (strength meter, confirm field) in all
 * five bindings, and exactly one of them fed the captured secret to a
 * serialiser. The other four stored it, showed a "protected" state, and saved a
 * PLAINTEXT `.pptx`. Nothing failed; the product simply lied.
 *
 * Nothing caught it because no spec touched password protection, and because a
 * test that asserts "`saveEncrypted` was called" is exactly as green when the
 * call is missing an argument, a format, or a whole binding. So this spec
 * asserts the DOWNLOADED BYTES.
 *
 * An ECMA-376 protected package is an OLE compound file (magic
 * `D0 CF 11 E0 A1 B1 1A E1`) whose streams are `EncryptionInfo` +
 * `EncryptedPackage`. A normal `.pptx` is a ZIP starting `PK\x03\x04`. The
 * whole point of the test is that those two are trivially distinguishable and
 * the bug shipped anyway.
 *
 * Framework-neutral throughout: the shared backstage nav ("Info"), the shared
 * backstage card ("Protect Presentation"), the dialog's `role="dialog"`, its
 * `input[type="password"]` fields, and the shared backstage "Save" entry.
 *
 * Run: bunx playwright test password-encryption
 */
import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

import { loadDeck, SAMPLE_DECK } from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1600, height: 950 } });
// The agile key derivation runs 100,000 SHA-512 rounds through WebCrypto.
test.describe.configure({ timeout: 180_000 });

const PASSWORD = 'e2e-Secret!9';

/** `50 4B 03 04`: a plain (unencrypted) OOXML package. */
function isZip(bytes: Uint8Array): boolean {
	return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** `D0 CF 11 E0 A1 B1 1A E1`: an OLE compound file, i.e. an encrypted package. */
function isOleCompoundFile(bytes: Uint8Array): boolean {
	return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
		(byte, index) => bytes[index] === byte,
	);
}

/**
 * Does the container hold a stream called `name`?
 *
 * The magic bytes alone only prove "some compound file"; an ECMA-376 protected
 * package must carry BOTH `EncryptionInfo` and `EncryptedPackage`. CFB
 * directory entries store their names as UTF-16LE, so a raw scan for the
 * encoded name is enough here and keeps the spec dependency-free. Verified
 * against `e2e/fixtures/Password_Protected_123_8_Slides_2_3_MB_*.pptx`, which
 * PowerPoint itself produced, and against the plain `sample-deck.pptx`.
 */
function hasCfbStream(bytes: Uint8Array, name: string): boolean {
	return Buffer.from(bytes).includes(Buffer.from(name, 'utf16le'));
}

/**
 * Ensure the File backstage is open (shared `role="dialog"` +
 * `aria-label="File"`).
 *
 * Idempotent on purpose: some bindings close the backstage when a File > Info
 * card opens its dialog and some leave it up, so the save step cannot assume
 * either. Clicking the File tab again when it is already open would toggle it
 * shut.
 */
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

/**
 * Set an open password through the real user flow: backstage > Info > the
 * shared "Protect Presentation" card > password + confirmation > submit.
 *
 * The submit button used to be labelled per binding ("Set Password" in
 * react/vue/angular, a generic "Save" in svelte/vanilla); all five now read
 * from `pptx.security.setPassword` / `.updatePassword`, so one name matches
 * everywhere and this locator doubles as a label-parity assertion.
 */
async function setPresentationPassword(page: Page, password: string): Promise<void> {
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
}

/** Click the backstage's sidebar "Save" and capture the download it starts. */
async function saveViaBackstage(page: Page): Promise<Download> {
	await openBackstage(page);
	const backstage = page.getByRole('dialog', { name: 'File' });
	const downloadPromise = page.waitForEvent('download', { timeout: 150_000 });
	// `exact: true` is load-bearing: "Save As" only switches the backstage page.
	await backstage.getByRole('button', { name: 'Save', exact: true }).click();
	return downloadPromise;
}

test.describe('password protection', () => {
	test('a protected deck downloads as an encrypted OLE container, not a ZIP', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openBackstage(page);
		await setPresentationPassword(page, PASSWORD);

		const bytes = await downloadBytes(await saveViaBackstage(page));

		expect(isZip(bytes), 'a deck the UI reports as protected must NOT save as a plain ZIP').toBe(
			false,
		);
		expect(isOleCompoundFile(bytes), 'a protected .pptx must be an OLE compound file').toBe(true);
		expect(
			hasCfbStream(bytes, 'EncryptionInfo'),
			'the container must carry an EncryptionInfo stream',
		).toBe(true);
		expect(
			hasCfbStream(bytes, 'EncryptedPackage'),
			'the container must carry an EncryptedPackage stream',
		).toBe(true);
		// An encrypted container still carries the whole package; a few hundred
		// bytes would mean an empty EncryptedPackage stream.
		expect(bytes.byteLength).toBeGreaterThan(10_000);
	});

	test('an unprotected deck still downloads as a plain ZIP', async ({ page }) => {
		await loadDeck(page, SAMPLE_DECK);
		await openBackstage(page);

		const bytes = await downloadBytes(await saveViaBackstage(page));

		expect(isZip(bytes), 'an unprotected save must remain a normal .pptx package').toBe(true);
		expect(isOleCompoundFile(bytes)).toBe(false);
		expect(hasCfbStream(bytes, 'EncryptedPackage')).toBe(false);
	});
});
