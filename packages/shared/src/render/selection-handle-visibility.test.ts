import { describe, expect, it } from 'vitest';

import { shouldShowElementHandles } from './selection-handle-visibility';

describe('shouldShowElementHandles', () => {
	it('shows handles for a single selected element on an editable canvas', () => {
		expect(shouldShowElementHandles(true, true, 1)).toBeTruthy();
	});

	it('shows handles even while that same element is being inline-edited', () => {
		// There is no inline-edit flag in the signature at all: the caller no
		// longer suppresses handles for the actively-edited element, which is
		// the whole point of this helper.
		expect(shouldShowElementHandles(true, true, 1)).toBeTruthy();
	});

	it('hides handles when the canvas is not editable', () => {
		expect(shouldShowElementHandles(false, true, 1)).toBeFalsy();
	});

	it('hides handles when the element is not selected', () => {
		expect(shouldShowElementHandles(true, false, 0)).toBeFalsy();
	});

	it('hides handles during a multi-selection', () => {
		expect(shouldShowElementHandles(true, true, 2)).toBeFalsy();
	});
});
