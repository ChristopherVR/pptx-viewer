// @vitest-environment happy-dom
/**
 * Insert tab adapter: the shared `pptx-ui-ribbon-insert` owns markup and state
 * reflection; this adapter only routes typed intents to the native handlers and
 * keeps the Date/Time picker dialog native.
 */
import { registerPptxWebControls } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InsertSection } from './InsertSection';
import type { InsertSectionProps } from './InsertSection';

registerPptxWebControls();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function baseProps(overrides: Partial<InsertSectionProps> = {}): InsertSectionProps {
	return {
		canEdit: true,
		newShapeType: 'rect',
		onSetNewShapeType: vi.fn(),
		onArmFreeformTool: vi.fn(),
		onAddTextBox: vi.fn(),
		onAddShape: vi.fn(),
		onAddTable: vi.fn(),
		onAddChart: vi.fn(),
		onAddSmartArt: vi.fn(),
		onAddEquation: vi.fn(),
		onAddActionButton: vi.fn(),
		onInsertField: vi.fn(),
		onOpenHeaderFooter: vi.fn(),
		onOpenImagePicker: vi.fn(),
		onOpenMediaPicker: vi.fn(),
		hasSelection: false,
		onOpenHyperlinkDialog: vi.fn(),
		...overrides,
	};
}

function render(overrides: Partial<InsertSectionProps> = {}) {
	act(() => root.render(React.createElement(InsertSection, baseProps(overrides))));
}
function button(id: string): HTMLButtonElement {
	return container
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

describe('insertSection', () => {
	it('routes commands to the native handlers', () => {
		const props = baseProps({ hasSelection: true });
		act(() => root.render(React.createElement(InsertSection, props)));
		for (const id of [
			'insert.text.textBox',
			'insert.tables.table',
			'insert.images.pictures',
			'insert.media.media',
			'insert.illustrations.smartArt',
			'insert.symbols.equation',
			'insert.links.link',
		]) {
			act(() => button(id).click());
		}
		expect(props.onAddTextBox).toHaveBeenCalledOnce();
		expect(props.onAddTable).toHaveBeenCalledOnce();
		expect(props.onOpenImagePicker).toHaveBeenCalledOnce();
		expect(props.onOpenMediaPicker).toHaveBeenCalledOnce();
		expect(props.onAddSmartArt).toHaveBeenCalledOnce();
		expect(props.onAddEquation).toHaveBeenCalledOnce();
		expect(props.onOpenHyperlinkDialog).toHaveBeenCalledOnce();
	});

	it('routes the shape and chart pickers, the Freeform tools and the Action menu', () => {
		const props = baseProps({ activeFreeformTool: 'curve' });
		act(() => root.render(React.createElement(InsertSection, props)));
		const [shape, chart] = [...container.querySelectorAll('select')];
		act(() => {
			shape.value = 'star5';
			shape.dispatchEvent(new Event('change'));
			chart.value = 'pie';
			chart.dispatchEvent(new Event('change'));
		});
		expect(props.onSetNewShapeType).toHaveBeenCalledExactlyOnceWith('star5');
		act(() =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ribbon-control="insert.illustrations.shapes"] .pick',
				)!
				.click(),
		);
		act(() =>
			container
				.querySelector<HTMLButtonElement>(
					'[data-ribbon-control="insert.illustrations.chart"] .pick',
				)!
				.click(),
		);
		expect(props.onAddShape).toHaveBeenCalledOnce();
		expect(props.onAddChart).toHaveBeenCalledExactlyOnceWith('pie');
		const curve = container.querySelector<HTMLElement>('[data-pptx-drawing-tool="curve"]')!;
		expect(curve.shadowRoot!.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
		act(() => curve.click());
		expect(props.onArmFreeformTool).toHaveBeenCalledExactlyOnceWith(null);
		act(() =>
			container
				.querySelector<HTMLButtonElement>('[data-ribbon-control="insert.links.action"] .trigger')!
				.click(),
		);
		act(() => container.querySelector<HTMLButtonElement>('[data-insert-item]')!.click());
		expect(props.onAddActionButton).toHaveBeenCalledOnce();
	});

	it('inserts simple fields directly and opens the native Date/Time dialog', () => {
		const props = baseProps();
		act(() => root.render(React.createElement(InsertSection, props)));
		act(() =>
			container
				.querySelector<HTMLButtonElement>('[data-ribbon-control="insert.text.field"] .trigger')!
				.click(),
		);
		act(() => container.querySelector<HTMLButtonElement>('[data-insert-item="header"]')!.click());
		expect(props.onInsertField).toHaveBeenCalledExactlyOnceWith('header');
		act(() =>
			container
				.querySelector<HTMLButtonElement>('[data-ribbon-control="insert.text.field"] .trigger')!
				.click(),
		);
		act(() => container.querySelector<HTMLButtonElement>('[data-insert-item="datetime"]')!.click());
		expect(document.body.textContent).toContain('Format');
		act(() => {
			[...document.querySelectorAll('button')].find((el) => el.textContent === 'Insert')!.click();
		});
		expect(props.onInsertField).toHaveBeenLastCalledWith('datetime', expect.any(String));
	});

	it('reflects read-only and selection gating without invoking edit handlers', () => {
		const onAddTextBox = vi.fn();
		render({ canEdit: false, onAddTextBox, hasSelection: true });
		expect(button('insert.text.textBox').disabled).toBeTruthy();
		act(() => button('insert.text.textBox').click());
		expect(onAddTextBox).not.toHaveBeenCalled();
		expect(button('insert.links.link').disabled).toBeFalsy();
		const first = container.querySelector('pptx-ui-ribbon-insert');
		render({ canEdit: true, hasSelection: false });
		expect(container.querySelector('pptx-ui-ribbon-insert')).toBe(first);
		expect(button('insert.text.textBox').disabled).toBeFalsy();
		expect(button('insert.links.link').disabled).toBeTruthy();
	});

	it('hides controls the host does not support', () => {
		render({
			onAddChart: undefined,
			onInsertField: undefined,
			onOpenHeaderFooter: undefined,
			onArmFreeformTool: undefined,
		});
		const hidden = (selector: string) => container.querySelector<HTMLElement>(selector)!.hidden;
		expect(hidden('[data-ribbon-control="insert.illustrations.chart"]')).toBeTruthy();
		expect(hidden('[data-ribbon-control="insert.text.field"]')).toBeTruthy();
		expect(hidden('.stack')).toBeTruthy();
	});
});
