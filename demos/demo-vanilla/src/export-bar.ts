import { t } from './demo-i18n';

/** Callbacks the export bar reports back to the demo shell. */
export interface ExportBarHandlers {
	exportPng: () => Promise<void>;
	exportPdf: () => Promise<void>;
}

export interface ExportBar {
	el: HTMLElement;
	/** Re-apply button labels after a language change. */
	refresh: () => void;
	destroy: () => void;
}

/**
 * Minimal PNG (current slide) / PDF (all slides) export affordance for the
 * demo shell: two plain buttons anchored bottom-left, opposite the
 * theme/language pickers. This deliberately stays a "couple of buttons" (per
 * the pptx-vanilla-viewer PNG+PDF export pass) rather than porting Vue's full
 * ExportMenu/ExportProgressModal UI, which is future ribbon-chrome work.
 */
export function createExportBar(handlers: ExportBarHandlers): ExportBar {
	const bar = document.createElement('div');
	bar.className = 'demo-export-bar';

	const pngButton = document.createElement('button');
	pngButton.type = 'button';
	const pdfButton = document.createElement('button');
	pdfButton.type = 'button';
	bar.append(pngButton, pdfButton);

	function withBusyState(button: HTMLButtonElement, run: () => Promise<void>): () => void {
		return () => {
			if (button.disabled) {
				return;
			}
			pngButton.disabled = true;
			pdfButton.disabled = true;
			void run()
				.catch((error: unknown) => {
					console.error('[pptx-vanilla-viewer demo] export failed', error);
				})
				.finally(() => {
					pngButton.disabled = false;
					pdfButton.disabled = false;
				});
		};
	}

	pngButton.addEventListener('click', withBusyState(pngButton, handlers.exportPng));
	pdfButton.addEventListener('click', withBusyState(pdfButton, handlers.exportPdf));

	function refresh(): void {
		pngButton.textContent = t('demo.export.png');
		pngButton.title = t('demo.export.png');
		pdfButton.textContent = t('demo.export.pdf');
		pdfButton.title = t('demo.export.pdf');
	}
	refresh();

	return {
		el: bar,
		refresh,
		destroy: () => bar.remove(),
	};
}
