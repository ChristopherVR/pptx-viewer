// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

import { useAutosave } from './useAutosave';
import type { UseAutosaveResult } from './useAutosave';

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}

describe('useAutosave', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('debounces a slides change and runs onSave after intervalMs', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		const onSave = vi.fn(() => Promise.resolve());
		const scope = effectScope();
		let api!: UseAutosaveResult;
		scope.run(() => {
			api = useAutosave({ slides, intervalMs: 2000, onSave });
		});

		// Initial state: nothing dirty, nothing saved.
		expect(api.isDirty.value).toBeFalsy();
		expect(api.status.value).toBe('idle');
		expect(onSave).not.toHaveBeenCalled();

		// Edit (immutable reassignment).
		slides.value = [slide('a'), slide('b')];
		expect(api.isDirty.value).toBeTruthy();
		expect(onSave).not.toHaveBeenCalled();

		// Before the window elapses: still nothing.
		vi.advanceTimersByTime(1999);
		expect(onSave).not.toHaveBeenCalled();

		// Window elapses → save fires.
		vi.advanceTimersByTime(1);
		await vi.runOnlyPendingTimersAsync();
		expect(onSave).toHaveBeenCalledOnce();
		expect(api.status.value).toBe('saved');
		expect(api.isDirty.value).toBeFalsy();
		expect(api.lastSavedAt.value).not.toBeNull();

		scope.stop();
	});

	it('coalesces rapid edits into a single debounced save', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		const onSave = vi.fn(() => Promise.resolve());
		const scope = effectScope();
		scope.run(() => {
			useAutosave({ slides, intervalMs: 1000, onSave });
		});

		slides.value = [slide('1')];
		vi.advanceTimersByTime(500);
		slides.value = [slide('2')];
		vi.advanceTimersByTime(500);
		slides.value = [slide('3')];
		expect(onSave).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1000);
		await vi.runOnlyPendingTimersAsync();
		expect(onSave).toHaveBeenCalledOnce();

		scope.stop();
	});

	it('saveNow runs immediately, bypassing the debounce', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		const onSave = vi.fn(() => Promise.resolve());
		const scope = effectScope();
		let api!: UseAutosaveResult;
		scope.run(() => {
			api = useAutosave({ slides, intervalMs: 5000, onSave });
		});

		slides.value = [slide('a'), slide('b')];
		await api.saveNow();
		expect(onSave).toHaveBeenCalledOnce();
		expect(api.status.value).toBe('saved');
		expect(api.isDirty.value).toBeFalsy();

		// The previously-armed debounce timer must not double-fire.
		vi.advanceTimersByTime(5000);
		await vi.runOnlyPendingTimersAsync();
		expect(onSave).toHaveBeenCalledOnce();

		scope.stop();
	});

	it('transitions through saving → saved', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		let resolveSave: (() => void) | undefined;
		const onSave = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				}),
		);
		const scope = effectScope();
		let api!: UseAutosaveResult;
		scope.run(() => {
			api = useAutosave({ slides, intervalMs: 1000, onSave });
		});

		slides.value = [slide('b')];
		vi.advanceTimersByTime(1000);
		await Promise.resolve();
		expect(api.status.value).toBe('saving');

		resolveSave?.();
		await vi.runOnlyPendingTimersAsync();
		expect(api.status.value).toBe('saved');

		scope.stop();
	});

	it('sets status to error when onSave rejects', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		const onSave = vi.fn(() => Promise.reject(new Error('boom')));
		const scope = effectScope();
		let api!: UseAutosaveResult;
		scope.run(() => {
			api = useAutosave({ slides, intervalMs: 1000, onSave });
		});

		slides.value = [slide('b')];
		vi.advanceTimersByTime(1000);
		await vi.runOnlyPendingTimersAsync();
		expect(api.status.value).toBe('error');
		expect(api.isDirty.value).toBeTruthy();

		scope.stop();
	});

	it('does not autosave when disabled, but saveNow still works', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		const enabled = ref(false);
		const onSave = vi.fn(() => Promise.resolve());
		const scope = effectScope();
		let api!: UseAutosaveResult;
		scope.run(() => {
			api = useAutosave({ slides, enabled, intervalMs: 1000, onSave });
		});

		slides.value = [slide('b')];
		expect(api.isDirty.value).toBeTruthy();
		vi.advanceTimersByTime(2000);
		await vi.runOnlyPendingTimersAsync();
		expect(onSave).not.toHaveBeenCalled();

		await api.saveNow();
		expect(onSave).toHaveBeenCalledOnce();

		scope.stop();
	});

	it('clears the pending timer on scope dispose', async () => {
		const slides = ref<PptxSlide[]>([slide('a')]);
		const onSave = vi.fn(() => Promise.resolve());
		const scope = effectScope();
		scope.run(() => {
			useAutosave({ slides, intervalMs: 1000, onSave });
		});

		slides.value = [slide('b')];
		scope.stop();
		vi.advanceTimersByTime(5000);
		await vi.runOnlyPendingTimersAsync();
		expect(onSave).not.toHaveBeenCalled();
	});
});
