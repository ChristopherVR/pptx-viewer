// @vitest-environment happy-dom
/**
 * B7 (wave-4): Action Settings gains the wave-4 verbs + the custom-show
 * picker (`data-testid="pptx-action-custom-show"` / `-return`).
 */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionSettingsPanel } from './ActionSettingsPanel';

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

function shapeElement(): PptxElement {
	return {
		id: 'shape-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as unknown as PptxElement;
}

describe('actionSettingsPanel custom show target (wave-4 B7)', () => {
	it('shows the custom-show select and return-after checkbox once that type is picked', () => {
		const onUpdateElement = vi.fn();
		act(() => {
			root.render(
				<ActionSettingsPanel
					selectedElement={shapeElement()}
					slides={[]}
					canEdit
					customShows={[{ id: 'showA', name: 'Reverse' }]}
					onUpdateElement={onUpdateElement}
				/>,
			);
		});

		const clickSelect = container.querySelector(
			'[data-pptx-action-trigger="click"] select',
		) as HTMLSelectElement;
		act(() => {
			clickSelect.value = 'customShow';
			clickSelect.dispatchEvent(new Event('change', { bubbles: true }));
		});

		const showSelect = container.querySelector(
			'[data-testid="pptx-action-custom-show"]',
		) as HTMLSelectElement;
		const returnCheckbox = container.querySelector(
			'[data-testid="pptx-action-custom-show-return"]',
		) as HTMLInputElement;
		expect(showSelect).not.toBeNull();
		expect(returnCheckbox).not.toBeNull();
		expect(Array.from(showSelect.options).some((o) => o.value === 'showA')).toBeTruthy();

		// Picking a show with no id yet must not commit (canCommitActionType gate).
		expect(onUpdateElement).not.toHaveBeenCalled();

		act(() => {
			showSelect.value = 'showA';
			showSelect.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onUpdateElement).toHaveBeenCalledWith(
			expect.objectContaining({
				actionClick: expect.objectContaining({ action: expect.stringContaining('showA') }),
			}),
		);
	});
});
