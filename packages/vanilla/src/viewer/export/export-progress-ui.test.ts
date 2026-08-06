import { exportAbortError } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { ExportController } from './export-controller';
import { createExportProgressModal } from './export-progress-modal';
import type { ExportProgressModal } from './export-progress-modal';
import { createExportProgressUi } from './export-progress-ui';

function fakeModal(): ExportProgressModal & {
	openCalls: { title: string; status: string }[];
	updates: { progress: number; status: string }[];
	closed: number;
} {
	const openCalls: { title: string; status: string }[] = [];
	const updates: { progress: number; status: string }[] = [];
	const handle = {
		openCalls,
		updates,
		closed: 0,
		open(title: string, status: string) {
			openCalls.push({ title, status });
		},
		update(progress: number, status: string) {
			updates.push({ progress, status });
		},
		close() {
			handle.closed += 1;
		},
	};
	return handle;
}

const noopController: ExportController = {
	exportSlidePng: async () => undefined,
	copySlideAsImage: async () => undefined,
	exportPdf: async () => undefined,
	exportJson: () => undefined,
	exportGif: async () => undefined,
	exportVideo: async () => undefined,
	print: async () => false,
};

describe('createExportProgressUi', () => {
	it('opens the modal, forwards slide progress, and closes on completion', async () => {
		const modal = fakeModal();
		const callerProgress = vi.fn();
		const controller: ExportController = {
			...noopController,
			exportPdf: async (options) => {
				options?.onProgress?.(0, 4);
				options?.onProgress?.(2, 4);
			},
		};
		const ui = createExportProgressUi({
			modal,
			controller,
			getTranslator: () => createTranslator('en'),
		});

		await ui.runPdf({ onProgress: callerProgress });

		expect(modal.openCalls).toStrictEqual([
			{ title: 'Export as PDF', status: 'Capturing slides...' },
		]);
		// Slide cursor mapped through the shared band maths, then the tail.
		expect(modal.updates.map((update) => update.progress)).toStrictEqual([0, 45, 95, 100]);
		expect(modal.updates[1].status).toBe('Rendering slide 3 of 4...');
		// A caller-supplied onProgress still observes the raw cursor.
		expect(callerProgress.mock.calls).toStrictEqual([
			[0, 4],
			[2, 4],
		]);
		expect(modal.closed).toBe(1);
	});

	it('cancel aborts the loop signal and swallows the AbortError silently', async () => {
		const modal = fakeModal();
		const errorSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
		let cancelInFlight = (): void => undefined;
		const controller: ExportController = {
			...noopController,
			exportGif: async (options) => {
				cancelInFlight();
				if (options?.signal?.aborted) {
					throw exportAbortError();
				}
			},
		};
		const ui = createExportProgressUi({
			modal,
			controller,
			getTranslator: () => createTranslator('en'),
		});
		cancelInFlight = () => ui.cancel();

		await ui.runGif();

		expect(errorSpy).not.toHaveBeenCalled();
		expect(modal.closed).toBeGreaterThan(0);
		errorSpy.mockRestore();
	});

	it('chains a caller-supplied abort signal into the envelope signal', async () => {
		const modal = fakeModal();
		const caller = new AbortController();
		let observed: AbortSignal | undefined;
		const controller: ExportController = {
			...noopController,
			exportVideo: async (options) => {
				observed = options?.signal;
				caller.abort();
				if (options?.signal?.aborted) {
					throw exportAbortError();
				}
			},
		};
		const ui = createExportProgressUi({
			modal,
			controller,
			getTranslator: () => createTranslator('en'),
		});

		await ui.runVideo({ signal: caller.signal });
		expect(observed?.aborted).toBeTruthy();
	});
});

describe('createExportProgressModal', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('mounts a labeled dialog with a bar, status, and a wired Cancel', () => {
		const onCancel = vi.fn();
		const modal = createExportProgressModal({
			doc: document,
			getTranslator: () => createTranslator('en'),
			onCancel,
		});

		modal.open('Export as PDF', 'Capturing slides...');
		const dialog = document.querySelector('.pptxv-export-progress-backdrop');
		expect(dialog?.getAttribute('role')).toBe('dialog');
		expect(dialog?.getAttribute('aria-label')).toBe('Export as PDF');
		expect(dialog?.querySelector('h3')?.textContent).toBe('Export as PDF');

		modal.update(45, 'Rendering slide 3 of 4...');
		const fill = dialog?.querySelector<HTMLElement>('.pptxv-export-progress-fill');
		expect(fill?.style.width).toBe('45%');
		expect(dialog?.querySelector('.pptxv-export-progress-status span')?.textContent).toBe(
			'Rendering slide 3 of 4...',
		);
		expect(dialog?.querySelector('.pptxv-export-progress-pct')?.textContent).toBe('45%');

		dialog?.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onCancel).toHaveBeenCalledOnce();

		modal.close();
		expect(document.querySelector('.pptxv-export-progress-backdrop')).toBeNull();
	});
});
