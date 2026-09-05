// @vitest-environment happy-dom
/**
 * W4-E: the table STYLE DEFINITION editor ("Edit style...") lets an author
 * change a `ppt/tableStyles.xml` section's fill/text/borders, and clone /
 * delete a style, entirely through the shared `pptx-viewer-shared`
 * describe/apply pair - this test proves the React wiring round-trips those
 * edits back through `onStyleMapChange`/`onDeleteStyle`.
 */
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableStyleEditor } from './TableStyleEditor';
import { ThemeColorMapProvider } from './ThemeColorMapContext';

const STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

/** React tracks native input values internally; a plain `.value =` assign is invisible to it. */
function setNativeValue(input: HTMLInputElement, value: string): void {
	const nativeSetter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		'value',
	)?.set;
	nativeSetter?.call(input, value);
}

function styleMap(): ParsedTableStyleMap {
	return {
		[STYLE_ID]: {
			styleId: STYLE_ID,
			styleName: 'Medium Style 2 - Accent 1',
			wholeTblFill: { schemeColor: '', color: '#336699' },
		},
	};
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	// happy-dom does not implement window.prompt/confirm; stub them first so
	// vi.spyOn has an existing function to wrap.
	window.prompt = () => null;
	window.confirm = () => false;
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

describe('tableStyleEditor', () => {
	it('shows the "no style selected" message with no styleId', () => {
		act(() => {
			root.render(
				<TableStyleEditor
					styleMap={styleMap()}
					styleId={undefined}
					canEdit
					onStyleMapChange={vi.fn()}
					onDeleteStyle={vi.fn()}
					onClose={vi.fn()}
				/>,
			);
		});
		expect(container.textContent).toContain('pptx.tableStyleEditor.noStyleSelected');
	});

	it('lists all 14 parts and edits the fill colour of the selected one', () => {
		const onStyleMapChange = vi.fn();
		act(() => {
			root.render(
				<TableStyleEditor
					styleMap={styleMap()}
					styleId={STYLE_ID}
					canEdit
					onStyleMapChange={onStyleMapChange}
					onDeleteStyle={vi.fn()}
					onClose={vi.fn()}
				/>,
			);
		});
		const partButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
			b.textContent?.includes('pptx.tableStyleEditor.part.'),
		);
		expect(partButtons).toHaveLength(14);

		const fillInput = container.querySelector('input[type="color"]') as HTMLInputElement;
		expect(fillInput).toBeTruthy();
		act(() => {
			setNativeValue(fillInput, '#ff0000');
			fillInput.dispatchEvent(new Event('change', { bubbles: true }));
		});

		expect(onStyleMapChange).toHaveBeenCalledOnce();
		const nextMap = onStyleMapChange.mock.calls[0][0] as ParsedTableStyleMap;
		expect(nextMap[STYLE_ID].wholeTblFill).toStrictEqual({ schemeColor: '', color: '#ff0000' });
	});

	it('creates a new style from the current one, based on a prompt', () => {
		const onStyleMapChange = vi.fn();
		const onAssignStyle = vi.fn();
		vi.spyOn(window, 'prompt').mockReturnValue('My Custom Style');
		act(() => {
			root.render(
				<TableStyleEditor
					styleMap={styleMap()}
					styleId={STYLE_ID}
					canEdit
					onStyleMapChange={onStyleMapChange}
					onDeleteStyle={vi.fn()}
					onAssignStyle={onAssignStyle}
					onClose={vi.fn()}
				/>,
			);
		});
		const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('pptx.tableStyleEditor.newFromCurrent'),
		) as HTMLButtonElement;
		act(() => {
			createButton.click();
		});
		expect(onStyleMapChange).toHaveBeenCalledOnce();
		const nextMap = onStyleMapChange.mock.calls[0][0] as ParsedTableStyleMap;
		const ids = Object.keys(nextMap);
		expect(ids).toHaveLength(2);
		const newId = ids.find((id) => id !== STYLE_ID);
		expect(nextMap[newId as string].styleName).toBe('My Custom Style');
		expect(nextMap[newId as string].wholeTblFill).toStrictEqual({
			schemeColor: '',
			color: '#336699',
		});
		expect(onAssignStyle).toHaveBeenCalledWith(newId);
	});

	it('creates a brand-new style with no current style selected and assigns it', () => {
		const onStyleMapChange = vi.fn();
		const onAssignStyle = vi.fn();
		vi.spyOn(window, 'prompt').mockReturnValue('Brand New Style');
		act(() => {
			root.render(
				<TableStyleEditor
					styleMap={undefined}
					styleId={undefined}
					canEdit
					onStyleMapChange={onStyleMapChange}
					onDeleteStyle={vi.fn()}
					onAssignStyle={onAssignStyle}
					onClose={vi.fn()}
				/>,
			);
		});
		expect(container.textContent).toContain('pptx.tableStyleEditor.noStyleSelected');
		const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('pptx.tableStyleEditor.newStyle'),
		) as HTMLButtonElement;
		expect(createButton).toBeTruthy();
		expect(createButton.disabled).toBeFalsy();
		act(() => {
			createButton.click();
		});
		expect(onStyleMapChange).toHaveBeenCalledOnce();
		const nextMap = onStyleMapChange.mock.calls[0][0] as ParsedTableStyleMap;
		const ids = Object.keys(nextMap);
		expect(ids).toHaveLength(1);
		expect(nextMap[ids[0]].styleName).toBe('Brand New Style');
		expect(onAssignStyle).toHaveBeenCalledWith(ids[0]);
	});

	it('deletes the style after confirmation and reports both the map and the id', () => {
		const onStyleMapChange = vi.fn();
		const onDeleteStyle = vi.fn();
		const onClose = vi.fn();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		act(() => {
			root.render(
				<ThemeColorMapProvider value={{}}>
					<TableStyleEditor
						styleMap={styleMap()}
						styleId={STYLE_ID}
						canEdit
						onStyleMapChange={onStyleMapChange}
						onDeleteStyle={onDeleteStyle}
						onClose={onClose}
					/>
				</ThemeColorMapProvider>,
			);
		});
		const deleteButton = Array.from(container.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('pptx.tableStyleEditor.deleteStyle'),
		) as HTMLButtonElement;
		act(() => {
			deleteButton.click();
		});
		expect(onDeleteStyle).toHaveBeenCalledWith(STYLE_ID);
		const nextMap = onStyleMapChange.mock.calls[0][0] as ParsedTableStyleMap;
		expect(Object.keys(nextMap)).toHaveLength(0);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('disables every control when canEdit is false', () => {
		act(() => {
			root.render(
				<TableStyleEditor
					styleMap={styleMap()}
					styleId={STYLE_ID}
					canEdit={false}
					onStyleMapChange={vi.fn()}
					onDeleteStyle={vi.fn()}
					onClose={vi.fn()}
				/>,
			);
		});
		const partButton = container.querySelector('button') as HTMLButtonElement;
		expect(partButton.disabled).toBeFalsy(); // the Close button stays enabled
		const fillInput = container.querySelector('input[type="color"]') as HTMLInputElement;
		expect(fillInput.disabled).toBeTruthy();
	});
});
