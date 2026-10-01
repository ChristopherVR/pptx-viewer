import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import FontFormattingGroup from './FontFormattingGroup.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountGroup(editable = true) {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [
				{
					id: 't1',
					type: 'text',
					x: 0,
					y: 0,
					width: 100,
					height: 20,
					text: 'Hello',
					textStyle: { italic: true, fontSize: 18 },
				},
			] as never,
		},
	]);
	editor.selection.setAll(['t1']);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(FontFormattingGroup, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const button = (id: string) =>
		target.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.font.${id}"]`)!;
	const style = () => {
		const element = editor.slides[0]?.elements[0];
		return element?.type === 'text' ? element.textStyle : undefined;
	};
	return { button, style };
}

describe('fontFormattingGroup', () => {
	it('reflects pressed state and applies native toggles through patchSelected', () => {
		const { button, style } = mountGroup();
		expect(button('italic').getAttribute('aria-pressed')).toBe('true');
		expect(button('bold').getAttribute('aria-pressed')).toBe('false');
		button('bold').click();
		flushSync();
		expect(style()?.bold).toBeTruthy();
		expect(button('bold').getAttribute('aria-pressed')).toBe('true');
		button('clearFormatting').click();
		flushSync();
		expect(style()?.bold).toBeFalsy();
	});

	it('steps the font size and gates every control when read-only', () => {
		const { button, style } = mountGroup();
		const before = style()?.fontSize ?? 0;
		button('increaseFontSize').click();
		flushSync();
		expect(style()?.fontSize).toBeGreaterThan(before);
		cleanup?.();
		const readOnly = mountGroup(false);
		for (const id of ['bold', 'shadow', 'increaseFontSize', 'clearFormatting']) {
			expect(readOnly.button(id).disabled).toBeTruthy();
		}
	});
});
