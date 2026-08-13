/**
 * autosave-session.test.ts: the host prop is a CEILING, the title-bar switch is
 * a PREFERENCE inside it, and a crash-recovery snapshot is offered to the user
 * rather than only to a callback the embedder may never have wired.
 */
import type { PptxHandler } from 'pptx-viewer-core';
import type { AutosaveRecoveryOffer } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';

const saveAutosaveSnapshot = vi.fn<(path: string, data: Uint8Array) => Promise<boolean>>();
const probeAutosaveRecovery = vi.fn<(path: string) => Promise<AutosaveRecoveryOffer | null>>();
// The DELETE is the shared module's own job (and its own tests'); what belongs
// here is that Discard reaches it with the right record and loads nothing.
const discardAutosaveRecovery =
	vi.fn<(record: { key: string; timestamp: number }) => Promise<void>>();

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: (path: string, data: Uint8Array) => saveAutosaveSnapshot(path, data),
	probeAutosaveRecovery: (path: string) => probeAutosaveRecovery(path),
	discardAutosaveRecovery: (record: { key: string; timestamp: number }) =>
		discardAutosaveRecovery(record),
}));

const { createAutosaveSession } = await import('./autosave-session');

function makeHandler(): PptxHandler {
	return { save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) } as unknown as PptxHandler;
}

function makeOffer(): AutosaveRecoveryOffer {
	return {
		prompt: {
			filePath: 'deck.pptx',
			timestamp: 10,
			size: 2048,
			ageMinutes: 3,
			titleKey: 'pptx.autosave.recovery.title',
			messageKey: 'pptx.autosave.recovery.message',
			messageParams: { file: 'deck.pptx', size: '2 KB' },
			ageKey: 'pptx.autosave.minutesAgo',
			ageParams: { count: 3 },
			restoreKey: 'pptx.autosave.recovery.restore',
			discardKey: 'pptx.autosave.recovery.discard',
		},
		record: { key: 'deck.pptx', data: new Uint8Array([9, 9]), timestamp: 10, size: 2048 },
	};
}

interface Harness {
	store: Store<ViewerState>;
	loadFile: ReturnType<typeof vi.fn>;
	session: ReturnType<typeof createAutosaveSession>;
}

function makeSession(
	over: { hostAutosave?: boolean; hostIntervalMs?: number; editable?: boolean } = {},
): Harness {
	const store = createStore(createInitialViewerState());
	store.set({ editable: over.editable ?? true });
	const loadFile = vi.fn().mockResolvedValue(undefined);
	const session = createAutosaveSession({
		doc: document,
		store,
		getHandler: () => makeHandler(),
		getTranslator: () => createTranslator(),
		hostAutosave: over.hostAutosave,
		hostIntervalMs: over.hostIntervalMs,
		filePath: 'deck.pptx',
		getSaveIntent: () => ({ password: null, passwordProtected: false }),
		onStatus: () => {},
		loadFile: (bytes: Uint8Array) => loadFile(bytes),
	});
	return { store, loadFile, session };
}

describe('autosave activation: host ceiling vs user preference', () => {
	beforeEach(() => {
		saveAutosaveSnapshot.mockReset().mockResolvedValue(true);
		probeAutosaveRecovery.mockReset().mockResolvedValue(null);
		discardAutosaveRecovery.mockReset().mockResolvedValue(undefined);
	});

	it('runs by default when the host says nothing at all', () => {
		const { session } = makeSession();
		expect(session.isEnabled()).toBeTruthy();
		expect(session.isPreferred()).toBeTruthy();
		expect(session.getActivation().toggleAvailable).toBeTruthy();
		session.destroy();
	});

	it('lets the user switch it off', () => {
		const { session } = makeSession();
		expect(session.setEnabled(false)).toBeTruthy();
		expect(session.isEnabled()).toBeFalsy();
		expect(session.getActivation().reason).toBe('autosave_toggle_off');
		// ...and back on.
		expect(session.setEnabled(true)).toBeTruthy();
		expect(session.isEnabled()).toBeTruthy();
		session.destroy();
	});

	it('cannot be switched on by the user when the host passed autosave: false', () => {
		const { session } = makeSession({ hostAutosave: false });
		expect(session.isEnabled()).toBeFalsy();
		expect(session.getActivation()).toStrictEqual({
			active: false,
			toggleAvailable: false,
			reason: 'autosave_host_off',
		});
		// The toggle is inert: it reports that nothing was applied and the
		// verdict is unchanged.
		expect(session.setEnabled(true)).toBeFalsy();
		expect(session.isEnabled()).toBeFalsy();
		expect(session.isPreferred()).toBeFalsy();
		session.destroy();
	});

	it('stays off for a read-only viewer, whatever the preference says', () => {
		const { store, session } = makeSession({ editable: false });
		expect(session.isEnabled()).toBeFalsy();
		expect(session.getActivation().reason).toBe('read_only');
		// The PREFERENCE is still on; only the gate is closed, so the title-bar
		// switch must not read as if the user turned AutoSave off.
		expect(session.isPreferred()).toBeTruthy();

		store.set({ editable: true });
		expect(session.isEnabled()).toBeTruthy();
		session.destroy();
	});
});

describe('the crash-recovery prompt', () => {
	beforeEach(() => {
		saveAutosaveSnapshot.mockReset().mockResolvedValue(true);
		probeAutosaveRecovery.mockReset().mockResolvedValue(null);
		discardAutosaveRecovery.mockReset().mockResolvedValue(undefined);
	});
	afterEach(() => {
		document.querySelectorAll('.pptxv-parity-backdrop').forEach((node) => node.remove());
	});

	async function raisePrompt(): Promise<Harness & { dialog: HTMLElement }> {
		probeAutosaveRecovery.mockResolvedValue(makeOffer());
		const harness = makeSession();
		harness.store.set({
			slides: [{ id: 'a', elements: [] }] as unknown as ViewerState['slides'],
			loading: false,
		});
		await vi.waitFor(() => {
			expect(document.querySelector('[data-pptx-autosave-recovery]')).not.toBeNull();
		});
		const dialog = document.querySelector<HTMLElement>('[data-pptx-autosave-recovery]');
		expect(dialog).not.toBeNull();
		return { ...harness, dialog: dialog as HTMLElement };
	}

	it('renders an accessible dialog from the shared descriptor', async () => {
		const t = createTranslator();
		const { dialog, session } = await raisePrompt();
		expect(dialog.getAttribute('role')).toBe('dialog');
		expect(dialog.getAttribute('aria-label')).toBe(t('pptx.autosave.recovery.title'));
		const labels = [...dialog.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
		expect(labels).toStrictEqual([
			t('pptx.autosave.recovery.discard'),
			t('pptx.autosave.recovery.restore'),
		]);
		// The message interpolates the shared params rather than leaking the key.
		expect(dialog.textContent).toContain('deck.pptx');
		expect(dialog.textContent).toContain('2 KB');
		session.destroy();
	});

	it('restore loads the snapshot bytes through the viewer load path', async () => {
		const t = createTranslator();
		const { dialog, loadFile, session } = await raisePrompt();
		dialog
			.querySelector<HTMLButtonElement>(
				`button[aria-label="${t('pptx.autosave.recovery.restore')}"]`,
			)
			?.click();

		await vi.waitFor(() => expect(loadFile).toHaveBeenCalledOnce());
		expect(loadFile.mock.calls[0]?.[0]).toStrictEqual(new Uint8Array([9, 9]));
		expect(discardAutosaveRecovery).not.toHaveBeenCalled();
		expect(document.querySelector('[data-pptx-autosave-recovery]')).toBeNull();
		session.destroy();
	});

	it('discard deletes the snapshot and never loads it', async () => {
		const t = createTranslator();
		const { dialog, loadFile, session } = await raisePrompt();
		dialog
			.querySelector<HTMLButtonElement>(
				`button[aria-label="${t('pptx.autosave.recovery.discard')}"]`,
			)
			?.click();

		await vi.waitFor(() =>
			expect(discardAutosaveRecovery).toHaveBeenCalledWith(
				expect.objectContaining({ key: 'deck.pptx', timestamp: 10 }),
			),
		);
		expect(loadFile).not.toHaveBeenCalled();
		expect(document.querySelector('[data-pptx-autosave-recovery]')).toBeNull();
		session.destroy();
	});

	/**
	 * The regression this pins: the prompt is modal, so mounting it during a
	 * running slide show puts a full-area backdrop over the stage. Measured in
	 * the demos as `<div data-pptx-autosave-recovery> intercepts pointer events`,
	 * which broke action-button clicks mid-show. It must be HELD, not dropped.
	 */
	it('holds an offer that arrives during a show, and opens it when the show ends', async () => {
		probeAutosaveRecovery.mockResolvedValue(makeOffer());
		const harness = makeSession();
		harness.store.set({ presenting: true });
		harness.store.set({
			slides: [{ id: 'a', elements: [] }] as unknown as ViewerState['slides'],
			loading: false,
		});

		// The ARGUMENTS are not the point here; that the probe ran at all is.
		// oxlint-disable-next-line vitest/prefer-called-with
		await vi.waitFor(() => expect(probeAutosaveRecovery).toHaveBeenCalled());
		// Give the deferred open every chance to happen anyway.
		await Promise.resolve();
		expect(document.querySelector('[data-pptx-autosave-recovery]')).toBeNull();

		harness.store.set({ presenting: false });
		await vi.waitFor(() => {
			expect(document.querySelector('[data-pptx-autosave-recovery]')).not.toBeNull();
		});
		harness.session.destroy();
	});

	it('still fires the host onAutosaveRecovery hook alongside the dialog', async () => {
		const offer = makeOffer();
		probeAutosaveRecovery.mockResolvedValue(offer);
		const onRecovery = vi.fn();
		const store = createStore(createInitialViewerState());
		store.set({ editable: true });
		const session = createAutosaveSession({
			doc: document,
			store,
			getHandler: () => makeHandler(),
			getTranslator: () => createTranslator(),
			hostAutosave: undefined,
			hostIntervalMs: undefined,
			filePath: 'deck.pptx',
			getSaveIntent: () => ({ password: null, passwordProtected: false }),
			onStatus: () => {},
			onRecovery,
			loadFile: async () => {},
		});
		store.set({
			slides: [{ id: 'a', elements: [] }] as unknown as ViewerState['slides'],
			loading: false,
		});

		await vi.waitFor(() => expect(onRecovery).toHaveBeenCalledWith(offer.record));
		session.destroy();
	});
});
