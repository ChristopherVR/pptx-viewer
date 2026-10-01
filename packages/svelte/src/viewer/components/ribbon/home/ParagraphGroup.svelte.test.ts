import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ParagraphGroup from './ParagraphGroup.svelte';

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
					textStyle: { align: 'center' },
				},
			] as never,
		},
	]);
	editor.selection.setAll(['t1']);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ParagraphGroup, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const button = (id: string) =>
		target.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.paragraph.${id}"]`)!;
	const style = () => {
		const element = editor.slides[0]?.elements[0];
		return element?.type === 'text' ? element.textStyle : undefined;
	};
	return { button, style };
}

describe('paragraphGroup', () => {
	it('reflects the alignment and applies a new one through patchSelected', () => {
		const { button, style } = mountGroup();
		expect(button('alignCenter').getAttribute('aria-pressed')).toBe('true');
		button('alignRight').click();
		flushSync();
		expect(style()?.align).toBe('right');
		expect(button('alignRight').getAttribute('aria-pressed')).toBe('true');
		expect(button('alignCenter').getAttribute('aria-pressed')).toBe('false');
	});

	it('steps the indent and gates the strip when read-only', () => {
		const { button, style } = mountGroup();
		button('increaseIndent').click();
		flushSync();
		expect(style()?.paragraphMarginLeft).toBeGreaterThan(0);
		cleanup?.();
		const readOnly = mountGroup(false);
		expect(readOnly.button('alignLeft').disabled).toBeTruthy();
		expect(readOnly.button('increaseIndent').disabled).toBeTruthy();
	});
});
