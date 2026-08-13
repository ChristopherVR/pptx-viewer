/**
 * deck-save-encryption.test.ts: the single decision every binding's save path
 * now routes through.
 *
 * The bug this pins: "Encrypt with Password" captured a secret in all five
 * bindings and four of them serialised a PLAINTEXT `.pptx` anyway. A test that
 * only asserted `saveEncrypted` was called would have passed the whole time
 * the bug shipped, so the round-trip case below asserts the BYTES: an
 * encrypted OOXML package is an OLE compound file (`d0 cf 11 e0 ...`) holding
 * `EncryptionInfo` + `EncryptedPackage`, never a `PK\x03\x04` ZIP.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { PptxHandler, detectFileFormat, parseOle2 } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { DeckSaveSerializer } from './deck-save-encryption';
import {
	isEncryptedDeckBytes,
	planDeckSave,
	recoverySnapshotIntent,
	saveDeckWithPassword,
} from './deck-save-encryption';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('planDeckSave', () => {
	it('picks the plain serialiser when there is no password', () => {
		expect(planDeckSave(null)).toStrictEqual({ serializer: 'save', encrypted: false });
		expect(planDeckSave(undefined)).toStrictEqual({ serializer: 'save', encrypted: false });
		expect(planDeckSave('')).toStrictEqual({ serializer: 'save', encrypted: false });
		expect(planDeckSave({})).toStrictEqual({ serializer: 'save', encrypted: false });
	});

	it('picks the encrypting serialiser when a password is set', () => {
		expect(planDeckSave('hunter2')).toStrictEqual({
			serializer: 'saveEncrypted',
			encrypted: true,
			password: 'hunter2',
		});
		expect(planDeckSave({ password: 'hunter2', passwordProtected: true })).toStrictEqual({
			serializer: 'saveEncrypted',
			encrypted: true,
			password: 'hunter2',
		});
	});

	it('saves in the clear when protection was explicitly removed', () => {
		// "Remove password" must never leave a stale secret encrypting the next save.
		expect(planDeckSave({ password: 'stale', passwordProtected: false })).toStrictEqual({
			serializer: 'save',
			encrypted: false,
		});
	});

	it('never encrypts a recovery snapshot, however protected the deck is', () => {
		// The autosave snapshot is reopened by `PptxHandler.load()` with no
		// password (readBackstageRecentFile / restoreSessionDeck / Version
		// History Restore all hand `record.data` straight in), so encrypting it
		// destroys the recovery data instead of protecting it.
		expect(
			planDeckSave({ password: 'hunter2', passwordProtected: true, purpose: 'recovery-snapshot' }),
		).toStrictEqual({ serializer: 'save', encrypted: false });
	});

	it('still encrypts when the purpose is the default user file', () => {
		expect(planDeckSave({ password: 'hunter2', purpose: 'user-file' })).toStrictEqual({
			serializer: 'saveEncrypted',
			encrypted: true,
			password: 'hunter2',
		});
	});
});

describe('recoverySnapshotIntent', () => {
	it('stamps the purpose while keeping the rest of the intent', () => {
		expect(recoverySnapshotIntent({ password: 'hunter2', passwordProtected: true })).toStrictEqual({
			password: 'hunter2',
			passwordProtected: true,
			purpose: 'recovery-snapshot',
		});
	});

	it('accepts a bare password, or nothing at all', () => {
		expect(recoverySnapshotIntent('hunter2')).toStrictEqual({
			password: 'hunter2',
			purpose: 'recovery-snapshot',
		});
		expect(recoverySnapshotIntent()).toStrictEqual({
			password: undefined,
			purpose: 'recovery-snapshot',
		});
	});

	it('overrides a purpose the caller already set', () => {
		expect(recoverySnapshotIntent({ password: 'x', purpose: 'user-file' }).purpose).toBe(
			'recovery-snapshot',
		);
	});
});

describe('saveDeckWithPassword', () => {
	const slides: PptxSlide[] = [];

	it('calls save (not saveEncrypted) with no password, forwarding the options', async () => {
		const serializer: DeckSaveSerializer = {
			save: vi.fn(async () => new Uint8Array([0x50, 0x4b])),
			saveEncrypted: vi.fn(async () => new Uint8Array()),
		} as unknown as DeckSaveSerializer;
		await saveDeckWithPassword(serializer, slides, { outputFormat: 'ppsx' }, null);
		expect(serializer.save).toHaveBeenCalledWith(slides, { outputFormat: 'ppsx' });
		expect(serializer.saveEncrypted).not.toHaveBeenCalled();
	});

	it('calls saveEncrypted with the password, forwarding the options', async () => {
		const serializer: DeckSaveSerializer = {
			save: vi.fn(async () => new Uint8Array()),
			saveEncrypted: vi.fn(async () => new Uint8Array([0xd0, 0xcf])),
		} as unknown as DeckSaveSerializer;
		await saveDeckWithPassword(serializer, slides, { outputFormat: 'pptx' }, 'secret');
		expect(serializer.saveEncrypted).toHaveBeenCalledWith(slides, 'secret', {
			outputFormat: 'pptx',
		});
		expect(serializer.save).not.toHaveBeenCalled();
	});
});

describe('the produced bytes', () => {
	it('are a plain ZIP without a password and an encrypted OLE container with one', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
		try {
			const plain = await saveDeckWithPassword(handler, data.slides, undefined, null);
			const secret = await saveDeckWithPassword(handler, data.slides, undefined, 'hunter2!A');

			// Plain save: ZIP local-file-header magic "PK\x03\x04".
			expect(Array.from(plain.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
			expect(detectFileFormat(toArrayBuffer(plain))).toStrictEqual({
				format: 'zip',
				encrypted: false,
			});
			expect(isEncryptedDeckBytes(plain)).toBeFalsy();

			// Protected save: OLE compound-file magic, NOT a ZIP.
			expect(Array.from(secret.slice(0, 8))).toStrictEqual([
				0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
			]);
			expect(detectFileFormat(toArrayBuffer(secret))).toStrictEqual({
				format: 'ole',
				encrypted: true,
			});
			expect(isEncryptedDeckBytes(secret)).toBeTruthy();

			// The magic bytes alone only prove "some compound file". An ECMA-376
			// protected package must carry BOTH crypto streams, which is what
			// PowerPoint's own output has (see the
			// `Password_Protected_123_8_Slides_2_3_MB_*.pptx` e2e fixture:
			// EncryptionInfo 1057 bytes, EncryptedPackage 2325624 bytes).
			const ole = parseOle2(toArrayBuffer(secret));
			expect(ole.getStream('EncryptionInfo')?.byteLength ?? 0).toBeGreaterThan(0);
			expect(ole.getStream('EncryptedPackage')?.byteLength ?? 0).toBeGreaterThan(0);

			// And it is opaque, not a rename: a reader with no password is refused.
			const probe = new PptxHandler();
			await expect(probe.load(toArrayBuffer(secret))).rejects.toThrow(/encrypted/iu);
			probe.dispose();
		} finally {
			handler.dispose();
		}
	}, 180_000);

	it('leaves a recovery snapshot of a PROTECTED deck restorable without a password', async () => {
		// The data-loss bug: React (and, once it shared one serialiser, Vue)
		// wrote the autosave snapshot through the password-carrying save path, so
		// enabling protection silently turned the crash-recovery copy into an
		// OLE2 container nothing could reopen.
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
		try {
			const intent = { password: 'hunter2!A', passwordProtected: true } as const;

			// What the user's Save produces: really encrypted, really unopenable.
			const userFile = await saveDeckWithPassword(handler, data.slides, undefined, intent);
			expect(isEncryptedDeckBytes(userFile)).toBeTruthy();
			const refused = new PptxHandler();
			await expect(refused.load(toArrayBuffer(userFile))).rejects.toThrow(/encrypted/iu);
			refused.dispose();

			// What autosave produces from the SAME protection state: a plain ZIP.
			const snapshot = await saveDeckWithPassword(
				handler,
				data.slides,
				undefined,
				recoverySnapshotIntent(intent),
			);
			expect(Array.from(snapshot.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
			expect(isEncryptedDeckBytes(snapshot)).toBeFalsy();

			// And it actually restores, which is the whole point: recovery calls
			// `load()` with no password option.
			const recovery = new PptxHandler();
			try {
				const restored = await recovery.load(toArrayBuffer(snapshot));
				expect(restored.slides).toHaveLength(2);
			} finally {
				recovery.dispose();
			}
		} finally {
			handler.dispose();
		}
	}, 180_000);

	it('round-trips: the protected bytes decrypt back to the same deck', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
		try {
			// Split from the case above, which covers the DEFAULT cipher settings.
			// Both an encrypt and a decrypt here would run the 100,000-round agile
			// key derivation twice over, so this half uses a weak spin count: it is
			// testing that the payload survives, not the derivation's strength.
			const secret = await handler.saveEncrypted(data.slides, 'hunter2!A', {
				encryption: { spinCount: 100 },
			});
			expect(isEncryptedDeckBytes(secret)).toBeTruthy();

			const opener = new PptxHandler();
			try {
				const reopened = await opener.load(toArrayBuffer(secret), { password: 'hunter2!A' });
				expect(reopened.slides).toHaveLength(2);
			} finally {
				opener.dispose();
			}
		} finally {
			handler.dispose();
		}
	}, 120_000);
});
