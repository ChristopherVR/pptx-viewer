// @vitest-environment happy-dom
/**
 * OlePropertiesPanel Object Name editing (see `ElementMiscPanels.tsx`).
 *
 * A browser cannot run the native application that owns an embedded OLE
 * object, so the object itself stays read-only, but `p:oleObj/@name`
 * (ECMA-376 SS13.3.4) already round-trips through parse/save/collaboration;
 * this is the editing surface for it. No `@testing-library/react` is
 * available in this workspace, so this follows the manual `createRoot` +
 * `act` harness pattern used elsewhere (see
 * `SlideNotesPanel.notes-style.test.tsx`).
 */
import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OlePropertiesPanel } from './ElementMiscPanels';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

function makeOle(overrides: Partial<OlePptxElement> = {}): OlePptxElement {
	return {
		id: 'ole_test',
		type: 'ole',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		...overrides,
	};
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

/** Set an `<input>`'s value via the native setter and fire a real `input` event, as React does. */
function setInputValue(input: HTMLInputElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
	setter?.call(input, value);
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

function getNameInput(): HTMLInputElement {
	const input = container.querySelector('input[type="text"]');
	if (!(input instanceof HTMLInputElement)) {
		throw new Error('Object Name input not found');
	}
	return input;
}

describe('olePropertiesPanel object name editing', () => {
	it('renders the current oleName in the Object Name field', () => {
		act(() => {
			root.render(
				<OlePropertiesPanel
					selectedElement={makeOle({ oleName: 'Q3 Budget' })}
					canEdit
					onUpdateElement={() => {}}
				/>,
			);
		});
		expect(getNameInput().value).toBe('Q3 Budget');
	});

	it('leaves the field blank when no oleName is set', () => {
		act(() => {
			root.render(
				<OlePropertiesPanel
					selectedElement={makeOle({ fileName: 'budget.xlsx' })}
					canEdit
					onUpdateElement={() => {}}
				/>,
			);
		});
		expect(getNameInput().value).toBe('');
	});

	it('commits a trimmed oleName patch on input', () => {
		const onUpdateElement = vi.fn();
		act(() => {
			root.render(
				<OlePropertiesPanel
					selectedElement={makeOle({})}
					canEdit
					onUpdateElement={onUpdateElement}
				/>,
			);
		});
		act(() => {
			setInputValue(getNameInput(), '  Q3 Budget  ');
		});
		expect(onUpdateElement).toHaveBeenCalledWith({ oleName: 'Q3 Budget' });
	});

	it('clears oleName when the field is emptied', () => {
		const onUpdateElement = vi.fn();
		act(() => {
			root.render(
				<OlePropertiesPanel
					selectedElement={makeOle({ oleName: 'Q3 Budget' })}
					canEdit
					onUpdateElement={onUpdateElement}
				/>,
			);
		});
		act(() => {
			setInputValue(getNameInput(), '');
		});
		expect(onUpdateElement).toHaveBeenCalledWith({ oleName: undefined });
	});

	it('disables the field when canEdit is false', () => {
		act(() => {
			root.render(
				<OlePropertiesPanel
					selectedElement={makeOle({})}
					canEdit={false}
					onUpdateElement={() => {}}
				/>,
			);
		});
		expect(getNameInput().disabled).toBeTruthy();
	});

	it('renders nothing for a non-OLE element', () => {
		const shape: PptxElement = { id: 's1', type: 'shape', x: 0, y: 0, width: 10, height: 10 };
		act(() => {
			root.render(
				<OlePropertiesPanel selectedElement={shape} canEdit onUpdateElement={() => {}} />,
			);
		});
		expect(container.innerHTML).toBe('');
	});
});
