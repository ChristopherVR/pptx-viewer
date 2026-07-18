import type {
	PptxAnimationDirection,
	PptxAnimationRepeatMode,
	PptxAnimationTimingCurve,
} from 'pptx-viewer-core';

import { createEl } from '../../render';

/** Direction options surfaced in the panel (React's four-arrow picker). */
export const DIRECTIONS: readonly PptxAnimationDirection[] = [
	'fromTop',
	'fromBottom',
	'fromLeft',
	'fromRight',
];

/** Timing-curve options with their (camel-cased) dictionary label keys. */
export const CURVES: readonly { value: PptxAnimationTimingCurve; labelKey: string }[] = [
	{ value: 'ease', labelKey: 'pptx.animation.timingCurve.ease' },
	{ value: 'ease-in', labelKey: 'pptx.animation.timingCurve.easeIn' },
	{ value: 'ease-out', labelKey: 'pptx.animation.timingCurve.easeOut' },
	{ value: 'linear', labelKey: 'pptx.animation.timingCurve.linear' },
];

/** Repeat-mode options (`'none'` clears the field). */
export const REPEAT_MODES: readonly ('none' | PptxAnimationRepeatMode)[] = [
	'none',
	'untilNextClick',
	'untilEndOfSlide',
];

/** A captioned field wrapper appended to `parent` (label + control slot). */
export function animField(doc: Document, labelText: string, parent: HTMLElement): HTMLLabelElement {
	const label = createEl(doc, 'label', 'pptxv-anim-field');
	const caption = createEl(doc, 'span');
	caption.textContent = labelText;
	label.appendChild(caption);
	parent.appendChild(label);
	return label;
}

/** A captioned `<select>` with the given value/label options. */
export function animSelect(
	doc: Document,
	labelText: string,
	entries: readonly { value: string; label: string }[],
	onChange: (value: string) => void,
	parent: HTMLElement,
): HTMLSelectElement {
	const label = animField(doc, labelText, parent);
	const select = doc.createElement('select');
	for (const entry of entries) {
		const option = doc.createElement('option');
		option.value = entry.value;
		option.textContent = entry.label;
		select.appendChild(option);
	}
	select.addEventListener('change', () => onChange(select.value));
	label.appendChild(select);
	return select;
}

/** A captioned clamped `<input type="number">`. */
export function animNumber(
	doc: Document,
	labelText: string,
	bounds: { min: number; max: number; step: number },
	onChange: (value: number) => void,
	parent: HTMLElement,
): HTMLInputElement {
	const label = animField(doc, labelText, parent);
	const input = doc.createElement('input');
	input.type = 'number';
	input.min = String(bounds.min);
	input.max = String(bounds.max);
	input.step = String(bounds.step);
	input.addEventListener('change', () => onChange(input.valueAsNumber));
	label.appendChild(input);
	return input;
}
