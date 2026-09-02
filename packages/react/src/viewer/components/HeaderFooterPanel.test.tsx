// @vitest-environment happy-dom
import type { PptxHeaderFooter } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderFooterPanel } from './HeaderFooterPanel';

/**
 * Regression: React's Header & Footer dialog was missing the Header
 * toggle/text field entirely and collapsed "Update automatically" vs a fixed
 * date into one boolean, both of which Vue's port (the wave-3-extended
 * reference) already covered via the shared `header-footer-dialog` helpers.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function render(headerFooter: PptxHeaderFooter, onUpdate = vi.fn()) {
	act(() =>
		root.render(
			<HeaderFooterPanel
				headerFooter={headerFooter}
				onUpdate={onUpdate}
				onApplyToAll={() => {}}
				onApplyToCurrent={() => {}}
				onClose={() => {}}
			/>,
		),
	);
	return onUpdate;
}

describe('headerFooterPanel', () => {
	it('shows the Header toggle and reveals the header text field once checked', () => {
		render({ hasHeader: true, headerText: 'Confidential' });
		const headerText = container.querySelector(
			'[data-testid="hf-header-text"]',
		) as HTMLInputElement;
		expect(headerText).not.toBeNull();
		expect(headerText.value).toBe('Confidential');
	});

	it('hides the header text field when the Header toggle is off', () => {
		render({ hasHeader: false });
		expect(container.querySelector('[data-testid="hf-header-text"]')).toBeNull();
	});

	it('calls onUpdate with hasHeader when the Header checkbox is toggled', () => {
		const onUpdate = render({ hasHeader: false });
		const checkbox = container.querySelector('[data-testid="hf-header"]') as HTMLInputElement;
		act(() => checkbox.click());
		expect(onUpdate).toHaveBeenCalledWith({ hasHeader: true });
	});

	it('shows "Update automatically" and hides the fixed-date field while dateTimeAuto is on', () => {
		render({ hasDateTime: true, dateTimeAuto: true });
		expect(container.querySelector('[data-testid="hf-date-auto"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="hf-date-text"]')).toBeNull();
	});

	it('shows the fixed-date text field once dateTimeAuto is off', () => {
		render({ hasDateTime: true, dateTimeAuto: false, dateTimeText: '2026-01-01' });
		const dateText = container.querySelector('[data-testid="hf-date-text"]') as HTMLInputElement;
		expect(dateText).not.toBeNull();
		expect(dateText.value).toBe('2026-01-01');
	});

	it('does not show any date sub-controls when Date and time is off', () => {
		render({ hasDateTime: false });
		expect(container.querySelector('[data-testid="hf-date-auto"]')).toBeNull();
		expect(container.querySelector('[data-testid="hf-date-text"]')).toBeNull();
	});
});
