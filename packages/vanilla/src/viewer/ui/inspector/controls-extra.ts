import { createEl } from '../../render';

/**
 * Extra reusable DOM control builders for the element-type-aware inspector
 * sections (select / checkbox / labelled range slider). Kept separate from
 * `ui/controls.ts` (button/colour/number field) so that file stays within the
 * project's file-size budget; same imperative-handle pattern.
 */

export interface SelectFieldOption<T extends string> {
	value: T;
	label: string;
}

export interface SelectFieldOptions<T extends string> {
	label: string;
	options: ReadonlyArray<SelectFieldOption<T>>;
	onChange(value: T): void;
}

export interface SelectFieldHandle<T extends string> {
	el: HTMLElement;
	setValue(value: T): void;
	setDisabled(disabled: boolean): void;
}

/** A labelled native `<select>` field (dropdown of a fixed value/label list). */
export function makeSelectField<T extends string>(
	doc: Document,
	options: SelectFieldOptions<T>,
): SelectFieldHandle<T> {
	const el = createEl(doc, 'label', 'pptxv-field pptxv-field-select');
	const caption = createEl(doc, 'span', 'pptxv-field-label');
	caption.textContent = options.label;
	el.appendChild(caption);

	const select = doc.createElement('select');
	select.className = 'pptxv-field-select-input';
	select.setAttribute('aria-label', options.label);
	for (const opt of options.options) {
		const optionEl = doc.createElement('option');
		optionEl.value = opt.value;
		optionEl.textContent = opt.label;
		select.appendChild(optionEl);
	}
	select.addEventListener('change', () => options.onChange(select.value as T));
	el.appendChild(select);

	return {
		el,
		setValue(value) {
			select.value = value;
		},
		setDisabled(disabled) {
			select.disabled = disabled;
		},
	};
}

export interface CheckboxFieldOptions {
	label: string;
	onChange(checked: boolean): void;
}

export interface CheckboxFieldHandle {
	el: HTMLElement;
	setValue(checked: boolean): void;
	setDisabled(disabled: boolean): void;
}

/** A labelled checkbox toggle. */
export function makeCheckboxField(
	doc: Document,
	options: CheckboxFieldOptions,
): CheckboxFieldHandle {
	const el = createEl(doc, 'label', 'pptxv-field pptxv-field-checkbox');
	const input = doc.createElement('input');
	input.type = 'checkbox';
	input.setAttribute('aria-label', options.label);
	input.addEventListener('change', () => options.onChange(input.checked));
	const caption = createEl(doc, 'span', 'pptxv-field-label');
	caption.textContent = options.label;
	el.append(input, caption);

	return {
		el,
		setValue(checked) {
			input.checked = checked;
		},
		setDisabled(disabled) {
			input.disabled = disabled;
		},
	};
}

export interface RangeFieldOptions {
	label: string;
	min: number;
	max: number;
	step?: number;
	/** Format the numeric readout shown next to the slider (defaults to the raw value). */
	formatValue?(value: number): string;
	/** Fired on every input (drag), for a live readout. */
	onInput?(value: number): void;
	/** Fired on commit (change/blur), the value that should be pushed through history. */
	onCommit(value: number): void;
}

export interface RangeFieldHandle {
	el: HTMLElement;
	setValue(value: number): void;
	setDisabled(disabled: boolean): void;
}

/** A labelled range slider with a live numeric readout, committing on change/blur. */
export function makeRangeField(doc: Document, options: RangeFieldOptions): RangeFieldHandle {
	const el = createEl(doc, 'label', 'pptxv-field pptxv-field-range');
	const caption = createEl(doc, 'span', 'pptxv-field-label');
	caption.textContent = options.label;
	el.appendChild(caption);

	const row = createEl(doc, 'span', 'pptxv-field-range-row');
	const input = doc.createElement('input');
	input.type = 'range';
	input.min = String(options.min);
	input.max = String(options.max);
	input.step = String(options.step ?? 1);
	input.setAttribute('aria-label', options.label);
	const readout = createEl(doc, 'span', 'pptxv-field-range-readout');

	const format = options.formatValue ?? ((v: number) => String(v));
	const refreshReadout = (): void => {
		readout.textContent = format(Number.parseFloat(input.value));
	};

	input.addEventListener('input', () => {
		refreshReadout();
		options.onInput?.(Number.parseFloat(input.value));
	});
	input.addEventListener('change', () => options.onCommit(Number.parseFloat(input.value)));

	row.append(input, readout);
	el.appendChild(row);

	return {
		el,
		setValue(value) {
			if (doc.activeElement !== input) {
				input.value = String(value);
				refreshReadout();
			}
		},
		setDisabled(disabled) {
			input.disabled = disabled;
		},
	};
}
