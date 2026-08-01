import { describe, expect, it, vi } from 'vitest';

import { makeNumberField } from './controls';

/**
 * Regression cover for "one typed number, two undo steps".
 *
 * A numeric inspector field commits on `change` AND on Enter, and pressing
 * Enter raises both: the keydown handler fires, then the browser raises
 * `change` because the value differs from the one the field was focused with.
 * Every commit is a separate undo step, so a user who typed a width and pressed
 * Enter had to press Undo twice, and the first press appeared to do nothing.
 *
 * The contract these tests pin is narrower and easier to keep true than "count
 * the events": a commit is emitted only when the value actually differs from
 * what the model already holds.
 */

function typeInto(input: HTMLInputElement, value: string): void {
	input.value = value;
}

function pressEnter(input: HTMLInputElement): void {
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function fireChange(input: HTMLInputElement): void {
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('makeNumberField commit', () => {
	it('emits one commit when Enter is followed by the browser change event', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });
		field.setValue(53);

		typeInto(field.input, '222');
		pressEnter(field.input);
		fireChange(field.input);

		expect(onCommit).toHaveBeenCalledExactlyOnceWith(222);
	});

	it('emits nothing when the field is committed at the value it already had', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });
		field.setValue(53);

		// Focus and leave without editing: not an edit, so not an undo step.
		fireChange(field.input);

		expect(onCommit).not.toHaveBeenCalled();
	});

	it('still emits each distinct value in a sequence of edits', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });
		field.setValue(53);

		typeInto(field.input, '222');
		fireChange(field.input);
		typeInto(field.input, '333');
		fireChange(field.input);

		expect(onCommit.mock.calls.map((call) => call[0])).toStrictEqual([222, 333]);
	});

	it('emits again when the value returns to an earlier one', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });
		field.setValue(53);

		typeInto(field.input, '222');
		fireChange(field.input);
		typeInto(field.input, '53');
		fireChange(field.input);

		expect(onCommit.mock.calls.map((call) => call[0])).toStrictEqual([222, 53]);
	});

	it('treats a model value refreshed from outside as already committed', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });
		field.setValue(53);

		// The model moved (a canvas drag, a peer's edit); the field repaints.
		field.setValue(400);
		fireChange(field.input);

		expect(onCommit).not.toHaveBeenCalled();
	});

	it('does not treat display rounding as a pending edit', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });

		// The model carries more precision than the field can show.
		field.setValue(53.004);
		fireChange(field.input);

		expect(onCommit).not.toHaveBeenCalled();
	});

	it('ignores a non-numeric entry', () => {
		const onCommit = vi.fn();
		const field = makeNumberField(document, { label: 'X', onCommit });
		field.setValue(53);

		typeInto(field.input, '');
		fireChange(field.input);

		expect(onCommit).not.toHaveBeenCalled();
	});
});
