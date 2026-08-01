import { createEl } from '../render';
import type { IconName } from './icons';
import { createIcon } from './icons';

/**
 * Small reusable DOM control builders for the editing chrome (format toolbar +
 * inspector). Each returns the element plus an imperative handle so the editor
 * can enable/disable and reflect the selected element's values without a
 * framework. Pure DOM assembly; all behaviour is the caller's `on*` handlers.
 */

export interface ButtonOptions {
	label: string;
	icon?: IconName;
	/** Short text glyph when no icon (e.g. "B" for bold). */
	text?: string;
	/**
	 * Visible text label rendered next to the icon; turns the fixed-size icon
	 * button into a React-style labelled pill (`.pptxv-btn-pill`).
	 */
	textLabel?: string;
	/** Extra class on the button (e.g. for a bold/italic glyph style). */
	className?: string;
	onClick(): void;
}

export interface ButtonHandle {
	btn: HTMLButtonElement;
	setActive(active: boolean): void;
	setDisabled(disabled: boolean): void;
}

/** Build an icon/glyph button labelled (title + aria-label) via `label`. */
export function makeButton(doc: Document, options: ButtonOptions): ButtonHandle {
	const btn = createEl(
		doc,
		'button',
		`pptxv-btn${options.className ? ` ${options.className}` : ''}`,
	);
	btn.type = 'button';
	btn.title = options.label;
	btn.setAttribute('aria-label', options.label);
	if (options.icon) {
		btn.appendChild(createIcon(doc, options.icon));
	} else if (options.text !== undefined) {
		// `.pptxv-btn` is a FIXED 28x28 icon box with `overflow: visible`, so a
		// text label wider than 28px is painted (and hit-tested) outside the
		// button's own border box, over whichever neighbour sits there. The
		// later sibling wins `elementFromPoint`, which is how a coordinate click
		// on one ribbon button used to activate the button to its right. Tagging
		// every text-bearing button lets the stylesheet size the box to its
		// label, so a button's ink can never leave its own rect.
		btn.classList.add('pptxv-btn-text');
		btn.textContent = options.text;
	}
	if (options.textLabel !== undefined) {
		btn.classList.add('pptxv-btn-pill');
		const labelEl = createEl(doc, 'span', 'pptxv-btn-label');
		labelEl.textContent = options.textLabel;
		btn.appendChild(labelEl);
	}
	btn.addEventListener('click', options.onClick);
	return {
		btn,
		setActive(active) {
			btn.classList.toggle('is-active', active);
			btn.setAttribute('aria-pressed', String(active));
		},
		setDisabled(disabled) {
			btn.disabled = disabled;
		},
	};
}

export interface ColorControlOptions {
	label: string;
	/** Fired on every colour change (native `<input type=color>` input event). */
	onInput(hex: string): void;
}

export interface ColorControlHandle {
	el: HTMLElement;
	setValue(hex: string | undefined): void;
	setDisabled(disabled: boolean): void;
}

/** Normalise an arbitrary colour string to a 7-char `#rrggbb` for `<input>`. */
function toHexInputValue(hex: string | undefined, fallback: string): string {
	if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/u.test(hex)) {
		return hex.toLowerCase();
	}
	return fallback;
}

/**
 * A labelled colour swatch backed by a native `<input type="color">`. The
 * visible swatch shows the current colour; clicking it opens the OS picker.
 */
export function makeColorControl(
	doc: Document,
	options: ColorControlOptions,
	fallback = '#000000',
): ColorControlHandle {
	const el = createEl(doc, 'label', 'pptxv-color');
	el.title = options.label;
	el.setAttribute('aria-label', options.label);
	const input = doc.createElement('input');
	input.type = 'color';
	input.className = 'pptxv-color-input';
	input.value = fallback;
	input.setAttribute('aria-label', options.label);
	input.addEventListener('input', () => options.onInput(input.value));
	el.appendChild(input);
	return {
		el,
		setValue(hex) {
			input.value = toHexInputValue(hex, fallback);
		},
		setDisabled(disabled) {
			input.disabled = disabled;
			el.classList.toggle('is-disabled', disabled);
		},
	};
}

export interface NumberFieldOptions {
	label: string;
	min?: number;
	max?: number;
	step?: number;
	/** Fired on commit (Enter / change / blur) with the parsed number. */
	onCommit(value: number): void;
}

export interface NumberFieldHandle {
	el: HTMLElement;
	input: HTMLInputElement;
	setValue(value: number): void;
	setDisabled(disabled: boolean): void;
}

/**
 * A compact labelled numeric field. Commits on change/blur/Enter (never per
 * keystroke), so typing "-12" isn't committed digit-by-digit. The label text is
 * shown before the input (e.g. "X", "W").
 */
export function makeNumberField(doc: Document, options: NumberFieldOptions): NumberFieldHandle {
	const el = createEl(doc, 'label', 'pptxv-field');
	const caption = createEl(doc, 'span', 'pptxv-field-label');
	caption.textContent = options.label;
	el.appendChild(caption);
	const input = doc.createElement('input');
	input.type = 'number';
	input.className = 'pptxv-field-input';
	input.setAttribute('aria-label', options.label);
	if (options.min !== undefined) {
		input.min = String(options.min);
	}
	if (options.max !== undefined) {
		input.max = String(options.max);
	}
	input.step = String(options.step ?? 1);
	el.appendChild(input);

	/**
	 * The value the model already holds, so a commit that would not change
	 * anything can be dropped.
	 *
	 * Enter fires BOTH handlers below: the `keydown` listener commits, and the
	 * browser then raises `change` because the value differs from the one the
	 * field was focused with. Each commit is a separate undo step, so typing one
	 * number and pressing Enter took two presses of Undo to reverse, the first of
	 * which appeared to do nothing at all. Re-committing an unchanged value is
	 * never meaningful, so tracking the last committed value collapses the pair
	 * and also stops a plain focus-and-leave being recorded as an edit.
	 */
	let committedValue = Number.NaN;

	const commit = (): void => {
		const value = Number.parseFloat(input.value);
		if (!Number.isFinite(value) || value === committedValue) {
			return;
		}
		committedValue = value;
		options.onCommit(value);
	};
	input.addEventListener('change', commit);
	input.addEventListener('keydown', (event) => {
		event.stopPropagation();
		if (event.key === 'Enter') {
			commit();
		}
	});
	return {
		el,
		input,
		setValue(value) {
			const displayed = Math.round(value * 100) / 100;
			// Whatever the model says is by definition already committed, even
			// while the field is focused and therefore not repainted. Store the
			// DISPLAYED precision: that is what the input parses back, so a model
			// value of 53.004 shown as 53 must not read as a pending edit.
			committedValue = displayed;
			// Never clobber the field while the user is editing it.
			if (doc.activeElement !== input) {
				input.value = String(displayed);
			}
		},
		setDisabled(disabled) {
			input.disabled = disabled;
		},
	};
}
