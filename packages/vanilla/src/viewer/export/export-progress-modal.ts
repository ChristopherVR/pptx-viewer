import { clampPercent } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * ExportProgressModal: a centered, non-dismissable overlay shown while a
 * multi-slide export (PDF / GIF / WebM) runs. Vanilla port of the shared
 * ExportProgressModal pattern (React/Vue/Angular/Svelte): same layout and
 * `--pptx-*` theme tokens, hand-built DOM instead of a template.
 *
 * It deliberately does NOT close on backdrop click or Escape: an export in
 * flight should only end by completing, erroring, or the user pressing
 * Cancel. `onCancel` aborts cooperatively (the export loops check the
 * signal between slides).
 */
export interface ExportProgressModal {
	/** Show the modal with a fresh title, zeroed bar, and initial status. */
	open(title: string, status: string): void;
	/** Update the bar (0-100, clamped) and the status line under it. */
	update(progress: number, status: string): void;
	/** Hide and remove the modal from the document. */
	close(): void;
}

export interface ExportProgressModalDeps {
	doc: Document;
	getTranslator(): Translator;
	/** The Cancel control was pressed (abort the in-flight export). */
	onCancel(): void;
}

/** Build a (closed) progress modal; `open` mounts it onto `doc.body`. */
export function createExportProgressModal(deps: ExportProgressModalDeps): ExportProgressModal {
	const { doc } = deps;
	let backdrop: HTMLElement | null = null;
	let heading: HTMLElement | null = null;
	let fill: HTMLElement | null = null;
	let statusLine: HTMLElement | null = null;
	let percentLine: HTMLElement | null = null;

	const build = (): void => {
		const t = deps.getTranslator();
		backdrop = createEl(doc, 'div', 'pptxv-export-progress-backdrop');
		backdrop.setAttribute('role', 'dialog');
		backdrop.setAttribute('aria-modal', 'true');
		const panel = createEl(doc, 'div', 'pptxv-export-progress-panel');
		heading = createEl(doc, 'h3');
		const track = createEl(doc, 'div', 'pptxv-export-progress-track');
		fill = createEl(doc, 'div', 'pptxv-export-progress-fill');
		track.appendChild(fill);
		const statusRow = createEl(doc, 'div', 'pptxv-export-progress-status');
		statusLine = createEl(doc, 'span');
		percentLine = createEl(doc, 'span', 'pptxv-export-progress-pct');
		statusRow.append(statusLine, percentLine);
		const actions = createEl(doc, 'div', 'pptxv-export-progress-actions');
		const cancel = createEl(doc, 'button');
		cancel.type = 'button';
		cancel.textContent = t('pptx.export.cancel');
		cancel.addEventListener('click', () => deps.onCancel());
		actions.appendChild(cancel);
		panel.append(heading, track, statusRow, actions);
		backdrop.appendChild(panel);
		doc.body.appendChild(backdrop);
	};

	const paint = (progress: number, status: string): void => {
		const clamped = clampPercent(progress);
		if (fill) {
			fill.style.width = `${clamped}%`;
		}
		if (statusLine) {
			statusLine.textContent = status;
		}
		if (percentLine) {
			percentLine.textContent = `${clamped}%`;
		}
	};

	return {
		open(title, status) {
			this.close();
			build();
			backdrop?.setAttribute('aria-label', title);
			if (heading) {
				heading.textContent = title;
			}
			paint(0, status);
		},
		update(progress, status) {
			paint(progress, status);
		},
		close() {
			backdrop?.remove();
			backdrop = null;
			heading = null;
			fill = null;
			statusLine = null;
			percentLine = null;
		},
	};
}
