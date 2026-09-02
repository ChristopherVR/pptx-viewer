import { schemaLabel } from 'pptx-viewer-shared';

/**
 * A caption plus its control, wrapped in one `<label>`.
 *
 * The control is named EXPLICITLY rather than leaning on the wrapper. A label
 * that wraps its control lends the control its whole text content, and once the
 * `<option>`s are appended that text is the caption plus every option, so a
 * label-text lookup for any option word ("Rotate") matches the dropdown. The
 * caption is the name; say so on the control.
 */
export function field<T extends HTMLElement>(doc: Document, text: string, control: T) {
	const label = doc.createElement('label');
	label.textContent = text;
	control.setAttribute('aria-label', text);
	label.appendChild(control);
	return { label, control };
}

export function input(doc: Document, text: string) {
	return field(doc, text, doc.createElement('input'));
}

export function number(doc: Document, text: string) {
	const result = input(doc, text);
	result.control.type = 'number';
	return result;
}

/**
 * `onCommit`, when given, fires on the native `change` event (the picker's
 * commit, never the continuous `input` a drag through the OS picker fires) so
 * a caller can push the pick into the deck's "Recent colours" MRU list
 * (`InspectorHandlers.pushRecentColor`) without flooding it while dragging.
 */
export function color(doc: Document, text: string, onCommit?: (hex: string) => void) {
	const result = input(doc, text);
	result.control.type = 'color';
	if (onCommit) {
		result.control.addEventListener('change', () => onCommit(result.control.value));
	}
	return result;
}

export function checkbox(doc: Document, text: string) {
	const result = input(doc, text);
	result.control.type = 'checkbox';
	return result;
}

export function select(doc: Document, text: string, values: readonly string[]) {
	const control = doc.createElement('select');
	setOptions(
		doc,
		control,
		values.map((item) => [item, item]),
	);
	return field(doc, text, control);
}

/**
 * A select whose options come from a shared `chart-editor-options` catalogue.
 *
 * Preferred over {@link select} for anything the other bindings also offer: the
 * value list and its translated labels then live in `pptx-viewer-shared` and
 * cannot drift, where a local `['thousands', 'millions', ...]` literal both
 * ships raw schema tokens to the user and silently diverges the moment React
 * gains an entry.
 */
export function optionSelect(
	doc: Document,
	text: string,
	options: ReadonlyArray<{ value: string; labelKey: string }>,
	translate: (key: string) => string,
) {
	const control = doc.createElement('select');
	setOptions(
		doc,
		control,
		options.map((option) => [option.value, translate(option.labelKey)]),
	);
	return field(doc, text, control);
}

/**
 * A select over a FIXED list of OOXML wire tokens, spelled through one of the
 * shared `schema-label-keys` maps.
 *
 * Preferred over {@link select} whenever the value list must stay byte-for-byte
 * as it is (because the control is already in parity with React) but the
 * options were reaching the user as raw schema tokens such as `inBase`,
 * `percentStacked` or `valAx`. Unlike {@link optionSelect} the catalogue here
 * cannot change WHICH values are offered: it only decides how each one is
 * spelled, and a token the map does not know still renders as itself.
 */
export function tokenSelect(
	doc: Document,
	text: string,
	values: readonly string[],
	keys: Readonly<Record<string, string>>,
	translate: (key: string) => string,
) {
	const control = doc.createElement('select');
	setOptions(
		doc,
		control,
		values.map((item) => [item, schemaLabel(keys, item, translate)]),
	);
	return field(doc, text, control);
}

export function setOptions(
	doc: Document,
	control: HTMLSelectElement,
	values: Array<[string, string]>,
): void {
	const selected = control.value;
	control.replaceChildren(
		...values.map(([key, text]) => {
			const option = doc.createElement('option');
			option.value = key;
			option.textContent = text;
			return option;
		}),
	);
	control.value = selected;
}

export function value(control: HTMLInputElement): number | undefined {
	return control.value === '' ? undefined : control.valueAsNumber;
}

export function set(control: HTMLInputElement, next: number | undefined): void {
	control.value = next === undefined ? '' : String(next);
}

export function numbers(text: string): number[] {
	return text.split(',').map(Number).filter(Number.isFinite);
}
