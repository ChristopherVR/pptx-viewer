/**
 * autosave-recovery-encryption.test.tsx: the crash-recovery snapshot must stay
 * restorable when the deck is password protected.
 *
 * The bug: `useContentLifecycle` handed `useAutosave` the SAME serialiser the
 * user's Save uses, so "Encrypt with Password" also encrypted the IndexedDB
 * recovery snapshot. Nothing that reads a snapshot back has the password
 * (`readBackstageRecentFile`, `restoreSessionDeck` and Version History Restore
 * all call `PptxHandler.load()` with no `password` option), so the recovery
 * data was destroyed at the moment protection was switched on.
 *
 * This asserts the BYTES the composition actually wires into autosave, and then
 * REOPENS them with no password. A spy on `saveEncrypted` would have passed for
 * the entire life of the bug, which is exactly how it shipped.
 */
// @vitest-environment node
// Node rather than the package-wide DOM shim: nothing here mounts (an SSR
// render is enough for a `useCallback`), and the ZIP + key-derivation work runs
// an order of magnitude faster outside it - which also keeps this file from
// starving the neighbouring `save-encryption.test.tsx`, whose full-strength
// 100,000-round derivation runs inside a 30s budget.
import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { PptxHandler as Handler } from 'pptx-viewer-core';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseAutosaveInput } from './useAutosave';
import type { ViewerState } from './useViewerState';

/**
 * Capture what the real `useContentLifecycle` passes to `useAutosave`. The
 * captured value is then CALLED, and its real output bytes are asserted: this
 * is a wiring probe, not a "was it called" assertion.
 */
const { autosaveInputs } = vi.hoisted(() => ({ autosaveInputs: [] as UseAutosaveInput[] }));

vi.mock(import('./useAutosave'), () => ({
	useAutosave: (input: UseAutosaveInput) => {
		autosaveInputs.push(input);
		return { autosaveStatus: { state: 'idle' as const }, triggerAutosave: async () => {} };
	},
}));

// Loading and font injection are irrelevant here; the handler is supplied.
const { loadedHandler } = vi.hoisted(() => ({
	loadedHandler: { current: null as PptxHandler | null },
}));
vi.mock(import('./useLoadContent'), () => ({
	useLoadContent: () => ({ handlerRef: loadedHandler }),
}));
vi.mock(import('./useFontInjection'), () => ({ useFontInjection: () => undefined }));

const { useContentLifecycle } = await import('./useContentLifecycle');

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Keep the REAL encryptor (the bytes must be a genuine OLE2 container) but drop
 * the agile key derivation from 100,000 rounds to 100. Nothing in the path
 * under test is replaced; full strength just costs minutes per call.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

/**
 * The slice of `ViewerState` this composition reads. `useLoadContent` and
 * `useFontInjection` are mocked out, so the rest never runs.
 */
function viewerState(): ViewerState {
	return {
		templateElementsBySlideId: {},
		activeSlideIndex: 0,
		canvasSize: { width: 960, height: 540 },
		guides: [],
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		embeddedFonts: [],
		isDirty: true,
		inlineEditingElementIdRef: { current: null },
		inlineEditingTextRef: { current: '' },
	} as unknown as ViewerState;
}

interface Serializers {
	user: () => Promise<Uint8Array | null>;
	autosave: () => Promise<Uint8Array | null>;
}

/** Run the real composition once and hand back both serialisers. */
function composeSerializers(
	handler: PptxHandler,
	slides: PptxSlide[],
	password: string | undefined,
): Serializers {
	loadedHandler.current = handler;
	autosaveInputs.length = 0;
	let user: (() => Promise<Uint8Array | null>) | null = null;
	function Harness(): null {
		({ serializeSlides: user } = useContentLifecycle({
			content: null,
			filePath: 'deck.pptx',
			slides,
			state: viewerState(),
			history: {} as never,
			ops: {} as never,
			actionSoundHandlerRef: { current: null },
			setIsEncryptedDialogOpen: () => {},
			password,
		}));
		return null;
	}
	renderToStaticMarkup(<Harness />);
	const autosave = autosaveInputs.at(-1)?.serializeSlides;
	if (!user || !autosave) {
		throw new Error('useContentLifecycle did not wire both serialisers');
	}
	return { user, autosave };
}

describe('autosave snapshot vs password protection', () => {
	beforeEach(() => {
		autosaveInputs.length = 0;
	});

	it('keeps the autosave snapshot a restorable plain ZIP on a protected deck', async () => {
		const { handler, data } = await Handler.create({ initialSlideCount: 2 });
		weakenKeyDerivation(handler);
		try {
			const { user, autosave } = composeSerializers(handler, data.slides, 'hunter2!A');

			// The user's Save is still genuinely encrypted: this fix must not have
			// quietly turned password protection off.
			const userFile = await user();
			expect(userFile).not.toBeNull();
			expect(Array.from((userFile as Uint8Array).slice(0, 8))).toStrictEqual([
				0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
			]);

			// The snapshot autosave would write is a plain ZIP...
			const snapshot = await autosave();
			expect(snapshot).not.toBeNull();
			expect(Array.from((snapshot as Uint8Array).slice(0, 4))).toStrictEqual([
				0x50, 0x4b, 0x03, 0x04,
			]);

			// ...and recovery, which has no password to offer, can reopen it.
			const recovery = new Handler();
			try {
				const restored = await recovery.load(toArrayBuffer(snapshot as Uint8Array));
				expect(restored.slides).toHaveLength(2);
			} finally {
				recovery.dispose();
			}
		} finally {
			handler.dispose();
		}
	}, 120_000);

	it('writes a plain, restorable snapshot when no password is set either', async () => {
		const { handler, data } = await Handler.create({ initialSlideCount: 1 });
		try {
			const { autosave } = composeSerializers(handler, data.slides, undefined);
			const snapshot = await autosave();
			expect(Array.from((snapshot as Uint8Array).slice(0, 4))).toStrictEqual([
				0x50, 0x4b, 0x03, 0x04,
			]);
			expect(data.slides).toHaveLength(1);
		} finally {
			handler.dispose();
		}
	}, 60_000);
});
