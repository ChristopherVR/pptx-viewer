import { t } from './demo-i18n';

/** Callbacks the export bar reports back to the demo shell. */
export interface ExportBarHandlers {
	exportPng: () => Promise<void>;
	exportPdf: () => Promise<void>;
	exportGif: () => Promise<void>;
	exportVideo: () => Promise<void>;
	print: () => Promise<void>;
}

export interface ExportBar {
	el: HTMLElement;
	/** Re-apply button labels after a language change. */
	refresh: () => void;
	destroy: () => void;
}

/** One export-bar button: compact label + translated tooltip + handler key. */
interface ButtonSpec {
	handler: keyof ExportBarHandlers;
	/** Compact button text; format acronyms are locale-invariant. */
	label: () => string;
	/** Full translated tooltip. */
	title: () => string;
}

const BUTTONS: ButtonSpec[] = [
	{ handler: 'exportPng', label: () => 'PNG', title: () => t('demo.export.png') },
	{ handler: 'exportPdf', label: () => 'PDF', title: () => t('demo.export.pdf') },
	{ handler: 'exportGif', label: () => 'GIF', title: () => t('demo.export.gif') },
	{ handler: 'exportVideo', label: () => 'WebM', title: () => t('demo.export.video') },
	{ handler: 'print', label: () => t('demo.export.print'), title: () => t('demo.export.print') },
];

/**
 * Compact export affordance for the demo shell: a row of small buttons
 * (PNG current slide, PDF / GIF / WebM video all slides, print) anchored
 * bottom-left, opposite the theme/language pickers. Deliberately stays a
 * button row rather than porting Vue's full ExportMenu/ExportProgressModal UI,
 * which is future ribbon-chrome work.
 */
export function createExportBar(handlers: ExportBarHandlers): ExportBar {
	const bar = document.createElement('div');
	bar.className = 'demo-export-bar';

	const buttons = BUTTONS.map((spec) => {
		const button = document.createElement('button');
		button.type = 'button';
		bar.append(button);
		return { spec, button };
	});

	function setAllDisabled(disabled: boolean): void {
		for (const { button } of buttons) {
			button.disabled = disabled;
		}
	}

	function runExclusive(run: () => Promise<void>): void {
		if (buttons.some(({ button }) => button.disabled)) {
			return;
		}
		setAllDisabled(true);
		void run()
			.catch((error: unknown) => {
				console.error('[pptx-vanilla-viewer demo] export failed', error);
			})
			.finally(() => {
				setAllDisabled(false);
			});
	}

	for (const { spec, button } of buttons) {
		button.addEventListener('click', () => {
			runExclusive(handlers[spec.handler]);
		});
	}

	function refresh(): void {
		for (const { spec, button } of buttons) {
			button.textContent = spec.label();
			button.title = spec.title();
		}
	}
	refresh();

	return {
		el: bar,
		refresh,
		destroy: () => bar.remove(),
	};
}
