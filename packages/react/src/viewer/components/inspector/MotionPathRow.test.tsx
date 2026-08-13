// @vitest-environment happy-dom
/**
 * The motion-path picker must NAME ITSELF.
 *
 * Every binding renders this row as a `<label>` wrapping a caption, the select
 * and (once a path is applied) a drag hint. A control nested in its label takes
 * the label's whole text content as its accessible name unless it carries its
 * own, and that text includes every `<option>`: the picker answered to the name
 * of any motion path in the catalogue. The same defect made a slide-show spec
 * match a transition picker (its options include "Rotate") while it was looking
 * for a rotate handle, so this is pinned per binding.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MotionPathRow } from './MotionPathRow';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

/**
 * The accessible name a label-text consumer computes for a form control: its
 * own `aria-label` if it has one, and otherwise the ENTIRE text of the `<label>`
 * wrapping it.
 */
function accessibleName(control: Element): string {
	const own = control.getAttribute('aria-label');
	return (own ?? control.closest('label')?.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

describe('motionPathRow', () => {
	it('names the select itself instead of borrowing the whole label', () => {
		act(() => {
			root.render(
				<MotionPathRow motionPath='M 0 0 L 0.37 0.11' canEdit onChange={() => undefined} />,
			);
		});

		const select = container.querySelector('select');
		expect(select).not.toBeNull();
		const name = accessibleName(select!);

		expect(name).toBe('pptx.animation.motionPath.label');
		// The caption alone: not the option list, and not the drag hint that also
		// sits inside the same `<label>`.
		expect(name).not.toContain('pptx.animation.motionPath.none');
		expect(name).not.toContain('pptx.animation.motionPath.editHint');
	});
});
