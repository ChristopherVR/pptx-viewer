import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TableStyleEditor from './TableStyleEditor.svelte';

/**
 * W4-E: the table STYLE DEFINITION editor ("Edit style...") lets an author
 * change a `ppt/tableStyles.xml` section's fill/text/borders, and clone /
 * delete a style, entirely through the shared `pptx-viewer-shared`
 * describe/apply pair. Svelte port of React's `TableStyleEditor.test.tsx`.
 */
const STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

function styleMap(): ParsedTableStyleMap {
	return {
		[STYLE_ID]: {
			styleId: STYLE_ID,
			styleName: 'Medium Style 2 - Accent 1',
			wholeTblFill: { schemeColor: '', color: '#336699' },
		},
	};
}

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.unstubAllGlobals();
});

function mountEditor(props: {
	styleMap: ParsedTableStyleMap | undefined;
	styleId: string | undefined;
	canEdit?: boolean;
	onStyleMapChange: (m: ParsedTableStyleMap) => void;
	onDeleteStyle: (id: string) => void;
	onAssignStyle?: (id: string) => void;
	onClose: () => void;
}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TableStyleEditor, {
		target,
		props: { themeColorMap: undefined, ...props },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('tableStyleEditor', () => {
	it('shows the "no style selected" message with no styleId', () => {
		const target = mountEditor({
			styleMap: styleMap(),
			styleId: undefined,
			onStyleMapChange: vi.fn(),
			onDeleteStyle: vi.fn(),
			onClose: vi.fn(),
		});
		expect(target.textContent).toContain('Select a table style to edit its definition.');
	});

	it('lists all 14 parts and edits the fill colour of the selected one', () => {
		let emitted: ParsedTableStyleMap | undefined;
		const target = mountEditor({
			styleMap: styleMap(),
			styleId: STYLE_ID,
			onStyleMapChange: (m) => (emitted = m),
			onDeleteStyle: vi.fn(),
			onClose: vi.fn(),
		});
		const partButtons = Array.from(target.querySelectorAll('.parts button'));
		expect(partButtons).toHaveLength(14);

		const fillInput = target.querySelector<HTMLInputElement>('input[type="color"]');
		expect(fillInput).not.toBeNull();
		if (fillInput) {
			fillInput.value = '#ff0000';
			fillInput.dispatchEvent(new Event('change', { bubbles: true }));
		}
		flushSync();

		expect(emitted?.[STYLE_ID].wholeTblFill).toStrictEqual({ schemeColor: '', color: '#ff0000' });
	});

	it('creates a new style from the current one, based on a prompt', () => {
		vi.stubGlobal('prompt', vi.fn().mockReturnValue('My Custom Style'));
		let emitted: ParsedTableStyleMap | undefined;
		let assignedId: string | undefined;
		const target = mountEditor({
			styleMap: styleMap(),
			styleId: STYLE_ID,
			onStyleMapChange: (m) => (emitted = m),
			onDeleteStyle: vi.fn(),
			onAssignStyle: (id) => (assignedId = id),
			onClose: vi.fn(),
		});
		const createButton = Array.from(target.querySelectorAll('.actions button')).find((b) =>
			b.textContent?.includes('New style from current'),
		) as HTMLButtonElement;
		createButton.click();
		flushSync();

		const ids = Object.keys(emitted ?? {});
		expect(ids).toHaveLength(2);
		const newId = ids.find((id) => id !== STYLE_ID) as string;
		expect(emitted?.[newId].styleName).toBe('My Custom Style');
		expect(assignedId).toBe(newId);
	});

	it('creates a brand-new style with no current style selected and assigns it', () => {
		vi.stubGlobal('prompt', vi.fn().mockReturnValue('Brand New Style'));
		let emitted: ParsedTableStyleMap | undefined;
		let assignedId: string | undefined;
		const target = mountEditor({
			styleMap: undefined,
			styleId: undefined,
			onStyleMapChange: (m) => (emitted = m),
			onDeleteStyle: vi.fn(),
			onAssignStyle: (id) => (assignedId = id),
			onClose: vi.fn(),
		});
		expect(target.textContent).toContain('Select a table style to edit its definition.');
		const createButton = Array.from(target.querySelectorAll('.actions button')).find((b) =>
			b.textContent?.includes('Create new style'),
		) as HTMLButtonElement;
		expect(createButton).toBeTruthy();
		expect(createButton.disabled).toBeFalsy();
		createButton.click();
		flushSync();

		const ids = Object.keys(emitted ?? {});
		expect(ids).toHaveLength(1);
		expect(emitted?.[ids[0]].styleName).toBe('Brand New Style');
		expect(assignedId).toBe(ids[0]);
	});

	it('deletes the style after confirmation and reports both the map and the id', () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		let emitted: ParsedTableStyleMap | undefined;
		let deletedId: string | undefined;
		let closed = false;
		const target = mountEditor({
			styleMap: styleMap(),
			styleId: STYLE_ID,
			onStyleMapChange: (m) => (emitted = m),
			onDeleteStyle: (id) => (deletedId = id),
			onClose: () => (closed = true),
		});
		const deleteButton = Array.from(target.querySelectorAll('.actions button')).find((b) =>
			b.textContent?.includes('Delete style'),
		) as HTMLButtonElement;
		deleteButton.click();
		flushSync();

		expect(deletedId).toBe(STYLE_ID);
		expect(Object.keys(emitted ?? {})).toHaveLength(0);
		expect(closed).toBeTruthy();
	});

	it('disables field controls when canEdit is false', () => {
		const target = mountEditor({
			styleMap: styleMap(),
			styleId: STYLE_ID,
			canEdit: false,
			onStyleMapChange: vi.fn(),
			onDeleteStyle: vi.fn(),
			onClose: vi.fn(),
		});
		const fillInput = target.querySelector<HTMLInputElement>('input[type="color"]');
		expect(fillInput?.disabled).toBeTruthy();
	});
});
