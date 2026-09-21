/**
 * @vitest-environment jsdom
 *
 * jsdom supplies the browser storage globals used by the recovery flow.
 */
import { IDBDatabase, IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	acceptAutosaveRecovery,
	AUTOSAVE_RECOVERY_WINDOW_MS,
	autosaveRecoveryPrompt,
	discardAutosaveRecovery,
	formatSnapshotSize,
	probeAutosaveRecovery,
	shouldProbeAutosaveRecovery,
	shouldShowAutosaveRecoveryPrompt,
} from './autosave-recovery';
import {
	acknowledgeAutosaveRecovery,
	clearAutosaveRecoveryAcknowledgement,
} from './autosave-recovery-acknowledgement';
import {
	deleteAutosaveSnapshot,
	getAutosaveSnapshot,
	saveAutosaveSnapshot,
} from './autosave-store';

const NOW = 1_700_000_000_000;

describe('shouldProbeAutosaveRecovery', () => {
	const base = {
		alreadyChecked: false,
		filePath: 'deck.pptx',
		loading: false,
		error: null,
		slideCount: 3,
		autosaveAllowed: true,
	};

	it('probes exactly once, for an opened deck the host permits autosave on', () => {
		expect(shouldProbeAutosaveRecovery(base)).toBeTruthy();
		expect(shouldProbeAutosaveRecovery({ ...base, alreadyChecked: true })).toBeFalsy();
	});

	it('refuses to probe when there is nothing to compare against', () => {
		expect(shouldProbeAutosaveRecovery({ ...base, filePath: undefined })).toBeFalsy();
		expect(shouldProbeAutosaveRecovery({ ...base, loading: true })).toBeFalsy();
		expect(shouldProbeAutosaveRecovery({ ...base, error: 'boom' })).toBeFalsy();
		expect(shouldProbeAutosaveRecovery({ ...base, slideCount: 0 })).toBeFalsy();
	});

	it('never offers a snapshot to a host that switched autosave off', () => {
		expect(shouldProbeAutosaveRecovery({ ...base, autosaveAllowed: false })).toBeFalsy();
	});
});

describe('autosaveRecoveryPrompt', () => {
	const record = { key: 'deck.pptx', timestamp: NOW - 5 * 60_000, size: 2_500_000 };

	it('describes a fresh snapshot with keys, not sentences', () => {
		const prompt = autosaveRecoveryPrompt({ record, now: NOW });
		expect(prompt).not.toBeNull();
		expect(prompt?.titleKey).toBe('pptx.autosave.recovery.title');
		expect(prompt?.ageMinutes).toBe(5);
		expect(prompt?.ageKey).toBe('pptx.autosave.minutesAgo');
		expect(prompt?.ageParams.count).toBe(5);
		expect(prompt?.messageParams).toStrictEqual({ file: 'deck.pptx', size: '2.4 MB' });
	});

	it('uses the public file name instead of exposing the storage key', () => {
		const prompt = autosaveRecoveryPrompt({
			record: { ...record, key: '/private/autosave/8f2c9a' },
			now: NOW,
			displayName: 'Quarterly review.pptx',
		});

		expect(prompt?.filePath).toBe('/private/autosave/8f2c9a');
		expect(prompt?.messageParams.file).toBe('Quarterly review.pptx');
	});

	it('offers nothing when there is no usable record', () => {
		expect(autosaveRecoveryPrompt({ record: undefined, now: NOW })).toBeNull();
		expect(autosaveRecoveryPrompt({ record: { ...record, size: 0 }, now: NOW })).toBeNull();
		expect(autosaveRecoveryPrompt({ record: { ...record, key: '' }, now: NOW })).toBeNull();
	});

	it('does not offer the exact snapshot this tab already loaded', () => {
		expect(
			autosaveRecoveryPrompt({
				record,
				now: NOW,
				acknowledgedTimestamp: record.timestamp,
			}),
		).toBeNull();
		expect(
			autosaveRecoveryPrompt({
				record: { ...record, timestamp: record.timestamp + 1 },
				now: NOW,
				acknowledgedTimestamp: record.timestamp,
			}),
		).not.toBeNull();
	});

	it('abandons a snapshot older than the recovery window', () => {
		const stale = { ...record, timestamp: NOW - AUTOSAVE_RECOVERY_WINDOW_MS - 1 };
		expect(autosaveRecoveryPrompt({ record: stale, now: NOW })).toBeNull();
	});

	it('switches to hours once minutes stop being useful', () => {
		const old = { ...record, timestamp: NOW - 200 * 60_000 };
		const prompt = autosaveRecoveryPrompt({ record: old, now: NOW });
		expect(prompt?.ageKey).toBe('pptx.autosave.recovery.hoursAgo');
		expect(prompt?.ageParams.count).toBe(3);
	});
});

/**
 * The regression this pins: the prompt is modal, so leaving it mounted during a
 * slide show puts a full-area backdrop over the stage. Measured in the demos as
 * `<div data-pptx-autosave-recovery> intercepts pointer events`, which broke
 * action-button clicks in a running show.
 */
describe('shouldShowAutosaveRecoveryPrompt', () => {
	const prompt = autosaveRecoveryPrompt({
		record: { key: 'deck.pptx', timestamp: NOW - 60_000, size: 4096 },
		now: NOW,
	});

	it('shows an offer in the editor', () => {
		expect(shouldShowAutosaveRecoveryPrompt({ prompt, presenting: false })).toBeTruthy();
	});

	it('never mounts editor chrome over a running show', () => {
		expect(shouldShowAutosaveRecoveryPrompt({ prompt, presenting: true })).toBeFalsy();
	});

	it('has nothing to show without a prompt', () => {
		expect(shouldShowAutosaveRecoveryPrompt({ prompt: null, presenting: false })).toBeFalsy();
	});
});

describe('formatSnapshotSize', () => {
	it('reads as a size, not a byte count', () => {
		expect(formatSnapshotSize(0)).toBe('0 KB');
		expect(formatSnapshotSize(200)).toBe('1 KB');
		expect(formatSnapshotSize(831_488)).toBe('812 KB');
		expect(formatSnapshotSize(5 * 1024 * 1024)).toBe('5.0 MB');
	});
});

/**
 * The whole point of the feature, against a real store: a snapshot written by
 * the autosave engine is found again, offered, and either loaded or dropped.
 * Everything above this line is decision logic; this is the round trip.
 */
describe('probeAutosaveRecovery against a real store', () => {
	type GlobalWithIdb = typeof globalThis & {
		indexedDB?: IDBFactory;
		IDBKeyRange?: typeof IDBKeyRange;
	};
	const g = globalThis as GlobalWithIdb;

	beforeEach(() => {
		g.indexedDB = new IDBFactory();
		g.IDBKeyRange = IDBKeyRange;
		sessionStorage.clear();
	});

	it('offers back the bytes the autosave engine wrote', async () => {
		const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]);
		await saveAutosaveSnapshot('deck.pptx', bytes);

		const offer = await probeAutosaveRecovery('deck.pptx');
		expect(offer?.prompt.filePath).toBe('deck.pptx');
		expect(Array.from(acceptAutosaveRecovery(offer!.record))).toStrictEqual(Array.from(bytes));
	});

	it('threads a public file name into the prompt without changing the lookup key', async () => {
		const storageKey = '/private/autosave/8f2c9a';
		await saveAutosaveSnapshot(storageKey, new Uint8Array([1, 2, 3, 4]));

		const offer = await probeAutosaveRecovery(storageKey, Date.now(), 'Quarterly review.pptx');

		expect(offer?.record.key).toBe(storageKey);
		expect(offer?.prompt.messageParams.file).toBe('Quarterly review.pptx');
	});

	it('keeps accepted bytes stored but does not re-offer the exact snapshot in this tab', async () => {
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const offer = await probeAutosaveRecovery('deck.pptx');
		acceptAutosaveRecovery(offer!.record);
		acknowledgeAutosaveRecovery(offer!.record);

		await expect(probeAutosaveRecovery('deck.pptx')).resolves.toBeNull();
		await expect(getAutosaveSnapshot('deck.pptx')).resolves.toBeDefined();
	});

	it('offers the same stored snapshot again in a fresh tab', async () => {
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const offer = await probeAutosaveRecovery('deck.pptx');
		acknowledgeAutosaveRecovery(offer!.record);
		sessionStorage.clear();

		await expect(probeAutosaveRecovery('deck.pptx')).resolves.toMatchObject({
			record: { key: 'deck.pptx' },
		});
	});

	it('re-offers a snapshot when its load acknowledgement is rolled back', async () => {
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const offer = await probeAutosaveRecovery('deck.pptx');
		acknowledgeAutosaveRecovery(offer!.record);
		clearAutosaveRecoveryAcknowledgement(offer!.record);

		await expect(probeAutosaveRecovery('deck.pptx')).resolves.toMatchObject({
			record: { key: 'deck.pptx' },
		});
	});

	it('offers a newer snapshot for an acknowledged document', async () => {
		const firstTimestamp = Date.now();
		const now = vi.spyOn(Date, 'now').mockReturnValue(firstTimestamp);
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const first = await probeAutosaveRecovery('deck.pptx', firstTimestamp);
		acknowledgeAutosaveRecovery(first!.record);

		now.mockReturnValue(firstTimestamp + 1);
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([5, 6, 7, 8]));
		now.mockRestore();

		await expect(probeAutosaveRecovery('deck.pptx', firstTimestamp + 2)).resolves.toMatchObject({
			record: { key: 'deck.pptx', timestamp: firstTimestamp + 1 },
		});
	});

	it('does not let accepting a newer deck suppress an older deck', async () => {
		await saveAutosaveSnapshot('older.pptx', new Uint8Array([1, 2, 3, 4]));
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 2);
		});
		await saveAutosaveSnapshot('newer.pptx', new Uint8Array([5, 6, 7, 8]));

		const newer = await probeAutosaveRecovery('newer.pptx');
		acceptAutosaveRecovery(newer!.record);
		acknowledgeAutosaveRecovery(newer!.record);

		await expect(probeAutosaveRecovery('older.pptx')).resolves.toMatchObject({
			record: { key: 'older.pptx' },
		});
	});

	it('deletes the snapshot when the user discards it', async () => {
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const offer = await probeAutosaveRecovery('deck.pptx');
		await discardAutosaveRecovery(offer!.record);
		await expect(getAutosaveSnapshot('deck.pptx')).resolves.toBeUndefined();
		await expect(probeAutosaveRecovery('deck.pptx')).resolves.toBeNull();
	});

	it('propagates a discard delete failure and leaves the snapshot available', async () => {
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const offer = await probeAutosaveRecovery('deck.pptx');
		const originalTransaction = IDBDatabase.prototype.transaction;
		const transaction = vi
			.spyOn(IDBDatabase.prototype, 'transaction')
			.mockImplementationOnce(function (storeNames, mode) {
				const tx = originalTransaction.call(this, storeNames, mode);
				queueMicrotask(() => tx.abort());
				return tx;
			});

		try {
			await expect(discardAutosaveRecovery(offer!.record)).rejects.toThrow(
				'Failed to delete autosave snapshot: deck.pptx',
			);
		} finally {
			transaction.mockRestore();
		}
		await expect(getAutosaveSnapshot('deck.pptx')).resolves.toBeDefined();
	});

	it('rejects when IndexedDB cannot create the delete transaction', async () => {
		await saveAutosaveSnapshot('deck.pptx', new Uint8Array([1, 2, 3, 4]));
		const transaction = vi
			.spyOn(IDBDatabase.prototype, 'transaction')
			.mockImplementationOnce(() => {
				throw new Error('transaction failed');
			});

		try {
			await expect(deleteAutosaveSnapshot('deck.pptx')).rejects.toThrow('transaction failed');
		} finally {
			transaction.mockRestore();
		}
		await expect(getAutosaveSnapshot('deck.pptx')).resolves.toBeDefined();
	});

	it('says nothing about a deck that was never autosaved', async () => {
		await expect(probeAutosaveRecovery('never-opened.pptx')).resolves.toBeNull();
	});
});
