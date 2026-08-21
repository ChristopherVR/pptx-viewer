import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createPositionSection } from './position-section';
import type { InspectorState } from './types';

/** A `section()` factory matching the one `createInspector` passes in. */
function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		isLocked: false,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		rotation: 0,
		...overrides,
	} as InspectorState;
}

describe('position section lock toggle', () => {
	it('calls toggleElementLock when the lock button is clicked', () => {
		const toggleElementLock = vi.fn();
		const position = createPositionSection(
			document,
			createTranslator(),
			sectionFactory(),
			vi.fn(),
			toggleElementLock,
		);
		position.update(state());

		const button = position.el.querySelector('button');
		expect(button).toBeTruthy();
		button!.click();
		expect(toggleElementLock).toHaveBeenCalledOnce();
	});

	it('reflects the locked state via aria-pressed', () => {
		const position = createPositionSection(
			document,
			createTranslator(),
			sectionFactory(),
			vi.fn(),
			vi.fn(),
		);

		position.update(state({ isLocked: false }));
		const button = position.el.querySelector('button')!;
		expect(button.getAttribute('aria-pressed')).toBe('false');

		position.update(state({ isLocked: true }));
		expect(button.getAttribute('aria-pressed')).toBe('true');
	});

	it('disables the lock button when nothing is selected', () => {
		const position = createPositionSection(
			document,
			createTranslator(),
			sectionFactory(),
			vi.fn(),
			vi.fn(),
		);
		position.update(state({ hasSelection: false }));
		const button = position.el.querySelector('button')!;
		expect(button.disabled).toBeTruthy();
	});
});
