import type {
	ViewerOptionsControl,
	ViewerOptionsSection,
	ViewerOptionsStore,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/**
 * Generic control-row builders for the File > Options dialog: schema-driven
 * toggle / select / number / text rows plus whole-section rendering, all
 * reading and writing through the shared `ViewerOptionsStore`. The vanilla
 * counterpart of React's `OptionsPane` `ControlRow`.
 */

/** Build the shared row label span, with the optional "(i)" info tooltip. */
function buildLabel(doc: Document, t: Translator, control: ViewerOptionsControl): HTMLElement {
	const label = createEl(doc, 'span', 'pptxv-options-row-label');
	label.appendChild(doc.createTextNode(t(control.labelKey)));
	if (control.infoKey) {
		const info = createEl(doc, 'i', 'pptxv-options-info');
		info.textContent = 'i';
		info.title = t(control.infoKey);
		info.setAttribute('aria-label', t(control.infoKey));
		label.appendChild(info);
	}
	return label;
}

function rowClass(control: ViewerOptionsControl): string {
	return `pptxv-options-row${control.indent ? ' is-indent' : ''}`;
}

function appendToggleRow(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	control: ViewerOptionsControl,
	store: ViewerOptionsStore,
): void {
	const row = createEl(doc, 'label', rowClass(control));
	const input = doc.createElement('input');
	input.type = 'checkbox';
	input.checked = store.getValue(control.group, control.key) === true;
	input.addEventListener('change', () => {
		store.setValue(control.group, control.key, input.checked);
	});
	row.append(buildLabel(doc, t, control), input);
	parent.appendChild(row);
}

function appendSelectRow(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	control: Extract<ViewerOptionsControl, { kind: 'select' }>,
	store: ViewerOptionsStore,
): void {
	const row = createEl(doc, 'div', rowClass(control));
	const select = doc.createElement('select');
	select.setAttribute('aria-label', t(control.labelKey));
	for (const choice of control.choices) {
		const option = doc.createElement('option');
		option.value = choice.value;
		option.textContent = t(choice.labelKey);
		select.appendChild(option);
	}
	const value = store.getValue(control.group, control.key);
	select.value = typeof value === 'string' ? value : '';
	select.addEventListener('change', () => {
		store.setValue(control.group, control.key, select.value);
	});
	row.append(buildLabel(doc, t, control), select);
	parent.appendChild(row);
}

function appendNumberRow(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	control: Extract<ViewerOptionsControl, { kind: 'number' }>,
	store: ViewerOptionsStore,
): void {
	const row = createEl(doc, 'div', rowClass(control));
	const wrap = createEl(doc, 'span', 'pptxv-options-number');
	const input = doc.createElement('input');
	input.type = 'number';
	input.min = String(control.min);
	input.max = String(control.max);
	input.step = String(control.step ?? 1);
	input.setAttribute('aria-label', t(control.labelKey));
	const value = store.getValue(control.group, control.key);
	input.value = String(typeof value === 'number' ? value : control.min);
	input.addEventListener('change', () => {
		const parsed = Number(input.value);
		if (Number.isFinite(parsed)) {
			const clamped = Math.min(control.max, Math.max(control.min, parsed));
			input.value = String(clamped);
			store.setValue(control.group, control.key, clamped);
		}
	});
	wrap.appendChild(input);
	if (control.unitKey) {
		const unit = createEl(doc, 'span', 'pptxv-options-unit');
		unit.textContent = t(control.unitKey);
		wrap.appendChild(unit);
	}
	row.append(buildLabel(doc, t, control), wrap);
	parent.appendChild(row);
}

function appendTextRow(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	control: Extract<ViewerOptionsControl, { kind: 'text' }>,
	store: ViewerOptionsStore,
): void {
	const row = createEl(doc, 'div', rowClass(control));
	const input = doc.createElement('input');
	input.type = 'text';
	input.setAttribute('aria-label', t(control.labelKey));
	if (control.maxLength !== undefined) {
		input.maxLength = control.maxLength;
	}
	const value = store.getValue(control.group, control.key);
	input.value = typeof value === 'string' ? value : '';
	input.addEventListener('change', () => {
		store.setValue(control.group, control.key, input.value);
	});
	row.append(buildLabel(doc, t, control), input);
	parent.appendChild(row);
}

/** Append one schema control row of any kind. */
export function appendControlRow(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	control: ViewerOptionsControl,
	store: ViewerOptionsStore,
): void {
	if (control.kind === 'toggle') {
		appendToggleRow(doc, t, parent, control, store);
	} else if (control.kind === 'select') {
		appendSelectRow(doc, t, parent, control, store);
	} else if (control.kind === 'number') {
		appendNumberRow(doc, t, parent, control, store);
	} else {
		appendTextRow(doc, t, parent, control, store);
	}
}

/**
 * Append a whole schema section: title, optional description, control rows,
 * and the optional bespoke block (`section.special`) rendered by the caller.
 */
export function appendOptionsSection(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	section: ViewerOptionsSection,
	store: ViewerOptionsStore,
	renderSpecial?: (section: ViewerOptionsSection, host: HTMLElement) => void,
): void {
	const host = createEl(doc, 'section', 'pptxv-options-section');
	const title = createEl(doc, 'h3');
	title.textContent = t(section.titleKey);
	host.appendChild(title);
	if (section.descriptionKey) {
		const description = createEl(doc, 'p', 'pptxv-options-section-desc');
		description.textContent = t(section.descriptionKey);
		host.appendChild(description);
	}
	for (const control of section.controls) {
		appendControlRow(doc, t, host, control, store);
	}
	if (section.special && renderSpecial) {
		renderSpecial(section, host);
	}
	parent.appendChild(host);
}

/** Append a small secondary action button (Reset / Clear cache / Add / Remove). */
export function appendOptionsAction(
	doc: Document,
	parent: HTMLElement,
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const button = createEl(doc, 'button', 'pptxv-options-action');
	button.type = 'button';
	button.textContent = label;
	button.addEventListener('click', onClick);
	parent.appendChild(button);
	return button;
}
