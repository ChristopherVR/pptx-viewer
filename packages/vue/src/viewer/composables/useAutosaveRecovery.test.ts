// @vitest-environment happy-dom
import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

const { probeMock, discardMock, acknowledgeMock } = vi.hoisted(() => ({
	probeMock: vi.fn(),
	discardMock: vi.fn(),
	acknowledgeMock: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	probeAutosaveRecovery: probeMock,
	discardAutosaveRecovery: discardMock,
	acknowledgeAutosaveRecovery: acknowledgeMock,
}));

const { useAutosaveRecovery } = await import('./useAutosaveRecovery');

const PROMPT: AutosaveRecoveryPrompt = {
	filePath: 'internal-key',
	timestamp: 1_700_000_000_000,
	size: 4096,
	ageMinutes: 3,
	titleKey: 'pptx.autosave.recovery.title',
	messageKey: 'pptx.autosave.recovery.message',
	messageParams: { file: 'Quarterly review.pptx', size: '4 KB' },
	ageKey: 'pptx.autosave.minutesAgo',
	ageParams: { count: 3 },
	restoreKey: 'pptx.autosave.recovery.restore',
	discardKey: 'pptx.autosave.recovery.discard',
};

const RECORD = {
	key: 'internal-key',
	data: new Uint8Array([1, 2, 3, 4]),
	timestamp: PROMPT.timestamp,
	size: 4096,
};

async function setup() {
	const scope = effectScope();
	const onRestore = vi.fn();
	let recovery!: ReturnType<typeof useAutosaveRecovery>;
	scope.run(() => {
		recovery = useAutosaveRecovery({
			filePath: () => 'internal-key',
			fileName: () => 'Quarterly review.pptx',
			loading: ref(false),
			error: ref(null),
			slideCount: () => 3,
			autosaveAllowed: () => true,
			onRestore,
		});
	});
	await nextTick();
	await Promise.resolve();
	return { recovery, onRestore, stop: () => scope.stop() };
}

describe('useAutosaveRecovery', () => {
	beforeEach(() => {
		probeMock.mockReset().mockResolvedValue({ prompt: PROMPT, record: RECORD });
		discardMock.mockReset().mockResolvedValue(undefined);
		acknowledgeMock.mockReset();
	});

	it('keeps the storage key private and passes the public file name to the probe', async () => {
		const harness = await setup();

		expect(probeMock).toHaveBeenCalledWith(
			'internal-key',
			expect.any(Number),
			'Quarterly review.pptx',
		);
		expect(harness.recovery.prompt.value?.messageParams.file).toBe('Quarterly review.pptx');
		harness.stop();
	});

	it('keeps the prompt busy until discard finishes and ignores overlapping actions', async () => {
		let finishDiscard!: () => void;
		discardMock.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishDiscard = resolve;
				}),
		);
		const harness = await setup();

		const pending = harness.recovery.discard();
		harness.recovery.restore();
		void harness.recovery.discard();

		expect(harness.recovery.discarding.value).toBeTruthy();
		expect(harness.recovery.prompt.value).not.toBeNull();
		expect(discardMock).toHaveBeenCalledOnce();
		expect(harness.onRestore).not.toHaveBeenCalled();

		finishDiscard();
		await pending;

		expect(harness.recovery.discarding.value).toBeFalsy();
		expect(harness.recovery.prompt.value).toBeNull();
		harness.stop();
	});

	it('acknowledges the exact snapshot after the viewer accepts it', async () => {
		const harness = await setup();

		harness.recovery.restore();

		expect(harness.onRestore).toHaveBeenCalledWith(RECORD.data);
		expect(acknowledgeMock).toHaveBeenCalledWith(RECORD);
		harness.stop();
	});

	it('keeps the prompt open after a failed discard', async () => {
		discardMock.mockRejectedValue(new Error('transaction failed'));
		const harness = await setup();

		await harness.recovery.discard();

		expect(harness.recovery.discarding.value).toBeFalsy();
		expect(harness.recovery.prompt.value).not.toBeNull();
		harness.stop();
	});
});
