import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface DialogShell {
	backdrop: HTMLButtonElement;
	dialog: HTMLElement;
	body: HTMLElement;
	footer: HTMLElement;
	close(): void;
}

/** Accessible modal shell shared by the remaining React-parity dialogs. */
export function createParityDialogShell(doc: Document, t: Translator, title: string): DialogShell {
	const backdrop = createEl(doc, 'button', 'pptxv-parity-backdrop');
	backdrop.type = 'button';
	backdrop.setAttribute('aria-label', t('pptx.common.close'));
	const dialog = createEl(doc, 'section', 'pptxv-parity-dialog');
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	const headingId = `pptxv-dialog-${crypto.randomUUID()}`;
	dialog.setAttribute('aria-labelledby', headingId);
	const header = createEl(doc, 'header', 'pptxv-parity-header');
	const heading = createEl(doc, 'h2');
	heading.id = headingId;
	heading.textContent = title;
	const closeButton = createEl(doc, 'button');
	closeButton.type = 'button';
	closeButton.textContent = '×';
	closeButton.setAttribute('aria-label', t('pptx.common.close'));
	header.append(heading, closeButton);
	const body = createEl(doc, 'div', 'pptxv-parity-body');
	const footer = createEl(doc, 'footer', 'pptxv-parity-footer');
	dialog.append(header, body, footer);
	doc.body.append(backdrop, dialog);
	const close = (): void => {
		doc.removeEventListener('keydown', onKeyDown);
		backdrop.remove();
		dialog.remove();
	};
	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			close();
		}
	};
	doc.addEventListener('keydown', onKeyDown);
	backdrop.addEventListener('click', close);
	closeButton.addEventListener('click', close);
	queueMicrotask(() => closeButton.focus());
	return { backdrop, dialog, body, footer, close };
}

export function appendDialogButton(
	doc: Document,
	parent: HTMLElement,
	label: string,
	onClick: () => void,
	primary = false,
): HTMLButtonElement {
	const button = createEl(doc, 'button', primary ? 'is-primary' : '');
	button.type = 'button';
	button.textContent = label;
	button.addEventListener('click', onClick);
	parent.appendChild(button);
	return button;
}

export function appendCheckRow(
	doc: Document,
	parent: HTMLElement,
	label: string,
	checked: boolean,
): HTMLInputElement {
	const row = createEl(doc, 'label', 'pptxv-parity-check');
	const input = doc.createElement('input');
	input.type = 'checkbox';
	input.checked = checked;
	row.append(input, doc.createTextNode(label));
	parent.appendChild(row);
	return input;
}

/** A single named-radio choice: `label`/`checked` handled by `appendRadioRow`. */
export interface RadioOption {
	value: string;
	label: string;
}

/**
 * A vertical list of mutually-exclusive radio rows (e.g. File > Options >
 * Language). Reuses the `.pptxv-parity-check` label/row styling that
 * `appendCheckRow` already applies to checkboxes.
 */
export function appendRadioRow(
	doc: Document,
	parent: HTMLElement,
	name: string,
	options: readonly RadioOption[],
	selected: string,
	onSelect: (value: string) => void,
): void {
	for (const option of options) {
		const row = createEl(doc, 'label', 'pptxv-parity-check');
		const input = doc.createElement('input');
		input.type = 'radio';
		input.name = name;
		input.value = option.value;
		input.checked = option.value === selected;
		input.addEventListener('change', () => {
			if (input.checked) {
				onSelect(option.value);
			}
		});
		row.append(input, doc.createTextNode(option.label));
		parent.appendChild(row);
	}
}

/** A single swatch choice: a colour preview plus a label (e.g. a theme catalog entry). */
export interface SwatchOption {
	key: string;
	label: string;
	previewColor: string;
}

/**
 * A gallery of swatch buttons (e.g. File > Options > Appearance), mirroring
 * the Design ribbon tab's theme-gallery look. `selectedKey` highlights the
 * active choice via `.is-active`.
 */
export function appendSwatchRow(
	doc: Document,
	parent: HTMLElement,
	options: readonly SwatchOption[],
	selectedKey: string,
	onSelect: (key: string) => void,
): void {
	const row = createEl(doc, 'div', 'pptxv-parity-swatch-row');
	for (const option of options) {
		const swatchButton = doc.createElement('button');
		swatchButton.type = 'button';
		swatchButton.className = 'pptxv-parity-swatch';
		swatchButton.classList.toggle('is-active', option.key === selectedKey);
		const preview = createEl(doc, 'span', 'pptxv-parity-swatch-preview');
		preview.style.background = option.previewColor;
		const label = doc.createElement('span');
		label.textContent = option.label;
		swatchButton.append(preview, label);
		swatchButton.addEventListener('click', () => onSelect(option.key));
		row.appendChild(swatchButton);
	}
	parent.appendChild(row);
}
