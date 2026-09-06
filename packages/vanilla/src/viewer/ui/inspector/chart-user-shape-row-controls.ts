/**
 * Plain-DOM input builders shared by `chart-user-shape-section.ts`'s row
 * renderer. Split out to keep that file under this repo's file-size
 * guideline once the row tree (W2-F: text/fill/line/alt-text/position/size
 * controls, not just the from/to anchor editor) grew past a single function.
 */

/** A fractional (0-1) anchor coordinate input, e.g. a `relSizeAnchor` corner. */
export function fractionInput(
	doc: Document,
	value: number,
	onChange: (next: number) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'number';
	control.step = '0.01';
	control.min = '0';
	control.max = '1';
	control.value = String(value);
	control.addEventListener('change', () => onChange(Number(control.value)));
	return control;
}

/** A plain (unbounded) numeric input with an accessible label, e.g. a rotation-in-degrees field. */
export function labeledNumberInput(
	doc: Document,
	value: number,
	ariaLabel: string,
	step: string,
	onChange: (next: number) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'number';
	control.step = step;
	control.value = String(value);
	control.setAttribute('aria-label', ariaLabel);
	control.addEventListener('change', () => onChange(Number(control.value)));
	return control;
}

/** A plain (unbounded) numeric input, e.g. an EMU position/size field. */
export function emuInput(
	doc: Document,
	value: number,
	onChange: (next: number) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'number';
	control.value = String(value);
	control.addEventListener('change', () => onChange(Number(control.value)));
	return control;
}

/** A single-line text input, e.g. a shape's paragraph text or alt text. */
export function textInput(
	doc: Document,
	value: string,
	ariaLabel: string,
	onChange: (next: string) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'text';
	control.value = value;
	control.setAttribute('aria-label', ariaLabel);
	control.addEventListener('change', () => onChange(control.value));
	return control;
}

/** A checkbox input with an accessible label, e.g. a shape's own flip flag. */
export function checkboxInput(
	doc: Document,
	checked: boolean,
	ariaLabel: string,
	onChange: (next: boolean) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'checkbox';
	control.checked = checked;
	control.setAttribute('aria-label', ariaLabel);
	control.addEventListener('change', () => onChange(control.checked));
	return control;
}

/** A colour-swatch input, e.g. a shape's fill or line colour. */
export function colorInput(
	doc: Document,
	value: string,
	ariaLabel: string,
	onChange: (next: string) => void,
): HTMLInputElement {
	const control = doc.createElement('input');
	control.type = 'color';
	control.value = value;
	control.setAttribute('aria-label', ariaLabel);
	control.addEventListener('change', () => onChange(control.value));
	return control;
}

/** A `<span>label</span>` element followed by the given control(s), as a fragment. */
export function labeledField(
	doc: Document,
	label: string,
	...controls: HTMLElement[]
): HTMLElement[] {
	const span = doc.createElement('span');
	span.textContent = label;
	return [span, ...controls];
}
