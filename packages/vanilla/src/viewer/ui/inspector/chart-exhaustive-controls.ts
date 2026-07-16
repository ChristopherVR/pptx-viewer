export function field<T extends HTMLElement>(doc: Document, text: string, control: T) {
	const label = doc.createElement('label');
	label.textContent = text;
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

export function color(doc: Document, text: string) {
	const result = input(doc, text);
	result.control.type = 'color';
	return result;
}

export function checkbox(doc: Document, text: string) {
	const result = input(doc, text);
	result.control.type = 'checkbox';
	return result;
}

export function select(doc: Document, text: string, values: string[]) {
	const control = doc.createElement('select');
	setOptions(
		doc,
		control,
		values.map((item) => [item, item]),
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
