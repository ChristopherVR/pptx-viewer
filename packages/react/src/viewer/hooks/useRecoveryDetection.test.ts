// @vitest-environment happy-dom
/**
 * useRecoveryDetection: does the viewer actually OFFER a crash-recovery
 * snapshot, and does accepting it load the bytes?
 *
 * The previous version of this file reimplemented the hook's decision flow in a
 * local `simulateRecoveryFlow` helper (against an "electron API" that does not
 * exist in this codebase) and asserted the simulation. It stayed green whatever
 * the hook did. This renders the real hook and asserts what it hands back.
 *
 * The IndexedDB round trip itself is proved in
 * `pptx-viewer-shared/render/autosave-recovery.test.ts`, which has a real
 * (fake-indexeddb) store; here the shared probe is stubbed so the assertion is
 * about the wiring: probe -> prompt -> restore/discard.
 */
import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { probeMock, discardMock } = vi.hoisted(() => ({
	probeMock: vi.fn(),
	discardMock: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	probeAutosaveRecovery: probeMock,
	discardAutosaveRecovery: discardMock,
}));

const { useRecoveryDetection } = await import('./useRecoveryDetection');
type Result = ReturnType<typeof useRecoveryDetection>;
type Input = Parameters<typeof useRecoveryDetection>[0];

const PROMPT: AutosaveRecoveryPrompt = {
	filePath: 'deck.pptx',
	timestamp: 1_700_000_000_000,
	size: 4096,
	ageMinutes: 3,
	titleKey: 'pptx.autosave.recovery.title',
	messageKey: 'pptx.autosave.recovery.message',
	messageParams: { file: 'deck.pptx', size: '4 KB' },
	ageKey: 'pptx.autosave.minutesAgo',
	ageParams: { count: 3 },
	restoreKey: 'pptx.autosave.recovery.restore',
	discardKey: 'pptx.autosave.recovery.discard',
};

const BYTES = new Uint8Array([1, 2, 3, 4]);

function offer() {
	return {
		prompt: PROMPT,
		record: { key: 'deck.pptx', data: BYTES, timestamp: PROMPT.timestamp, size: 4096 },
	};
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	probeMock.mockReset();
	discardMock.mockReset();
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

/** Mount the hook and expose its latest return value. */
async function mount(input: Input): Promise<() => Result> {
	let latest: Result | null = null;
	function Probe(): null {
		latest = useRecoveryDetection(input);
		return null;
	}
	await act(async () => {
		root.render(React.createElement(Probe));
	});
	// Let the probe promise settle and the resulting state update flush.
	await act(async () => {
		await Promise.resolve();
	});
	// oxlint-disable-next-line react/function-component-definition -- a value
	// accessor, not a component: the linter only sees the capitalised `Result`.
	function current(): Result {
		if (!latest) {
			throw new Error('hook did not render');
		}
		return latest;
	}
	return current;
}

const base = {
	filePath: 'deck.pptx',
	loading: false,
	error: null,
	slideCount: 3,
};

describe('useRecoveryDetection', () => {
	it('surfaces the shared prompt once the deck has loaded', async () => {
		probeMock.mockResolvedValue(offer());
		const current = await mount({ ...base, onRestore: vi.fn() });
		expect(current().prompt?.titleKey).toBe('pptx.autosave.recovery.title');
	});

	it('offers nothing when the store has no snapshot for this deck', async () => {
		probeMock.mockResolvedValue(null);
		const current = await mount({ ...base, onRestore: vi.fn() });
		expect(current().prompt).toBeNull();
	});

	it('hands the recovered bytes to the host on restore, then closes', async () => {
		probeMock.mockResolvedValue(offer());
		const onRestore = vi.fn();
		const current = await mount({ ...base, onRestore });
		await act(async () => {
			current().restore();
		});
		expect(onRestore).toHaveBeenCalledWith(BYTES);
		expect(current().prompt).toBeNull();
	});

	it('drops the snapshot on discard, and never loads it', async () => {
		probeMock.mockResolvedValue(offer());
		discardMock.mockResolvedValue(undefined);
		const onRestore = vi.fn();
		const current = await mount({ ...base, onRestore });
		await act(async () => {
			current().discard();
		});
		expect(discardMock).toHaveBeenCalledWith(
			expect.objectContaining({ key: 'deck.pptx', timestamp: PROMPT.timestamp }),
		);
		expect(onRestore).not.toHaveBeenCalled();
		expect(current().prompt).toBeNull();
	});

	it('never probes while loading, without slides, or when the host forbade autosave', async () => {
		probeMock.mockResolvedValue(offer());
		await mount({ ...base, loading: true, onRestore: vi.fn() });
		await mount({ ...base, slideCount: 0, onRestore: vi.fn() });
		await mount({ ...base, autosaveAllowed: false, onRestore: vi.fn() });
		expect(probeMock).not.toHaveBeenCalled();
	});
});
