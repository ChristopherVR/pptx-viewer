import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import GradientPanel from './GradientPanel.svelte';

/**
 * GradientPanel tests: linear/radial type toggle, angle, and add/update/
 * remove colour stops, all built on the shared `gradient-picker.ts`. Named
 * `*.svelte.test.ts` so `mountPanel`'s props object can be wrapped in
 * `$state(...)` and refreshed between chained interactions (see
 * `notes-panel.svelte.test.ts`).
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function gradientShapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientAngle: 90,
			fillGradientStops: [
				{ color: '#111111', position: 0 },
				{ color: '#eeeeee', position: 100 },
			],
		},
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	return editor;
}

function currentEl(editor: EditorState): PptxElement {
	const el = editor.slides[0]?.elements[0];
	if (!el) {
		throw new Error('element missing');
	}
	return el;
}

type ShapeStyleShape = {
	shapeStyle?: {
		fillGradientType?: string;
		fillGradientAngle?: number;
		fillGradientStops?: Array<{ color: string; position: number }>;
	};
};

interface MountResult {
	target: HTMLElement;
	setProps: (next: { el: PptxElement }) => void;
}

function mountPanel(editor: EditorState, el: PptxElement): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, el });
	const instance = mount(GradientPanel, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return {
		target,
		setProps: (next) => {
			Object.assign(props, next);
			flushSync();
		},
	};
}

describe('gradientPanel', () => {
	it('renders the current type, angle, and stops', () => {
		const editor = makeEditor(gradientShapeEl());
		const { target } = mountPanel(editor, currentEl(editor));
		expect(target.querySelectorAll('.pptx-svelte-gradient-stop')).toHaveLength(2);
		const angle = target.querySelector<HTMLInputElement>('.pptx-svelte-gradient-angle input');
		expect(angle?.value).toBe('90');
	});

	it('switches gradient type to radial', () => {
		const editor = makeEditor(gradientShapeEl());
		const { target } = mountPanel(editor, currentEl(editor));
		const [, radialBtn] = target.querySelectorAll<HTMLButtonElement>(
			'.pptx-svelte-gradient-type button',
		);
		radialBtn?.click();
		flushSync();

		expect((currentEl(editor) as ShapeStyleShape).shapeStyle?.fillGradientType).toBe('radial');
	});

	it('changes the angle', () => {
		const editor = makeEditor(gradientShapeEl());
		const { target } = mountPanel(editor, currentEl(editor));
		const angle = target.querySelector<HTMLInputElement>('.pptx-svelte-gradient-angle input');
		if (!angle) {
			throw new Error('angle input not found');
		}
		angle.value = '45';
		angle.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect((currentEl(editor) as ShapeStyleShape).shapeStyle?.fillGradientAngle).toBe(45);
	});

	it('adds, updates, and removes a colour stop', () => {
		const editor = makeEditor(gradientShapeEl());
		const { target, setProps } = mountPanel(editor, currentEl(editor));

		target.querySelector<HTMLButtonElement>('.pptx-svelte-gradient-add')?.click();
		flushSync();
		expect((currentEl(editor) as ShapeStyleShape).shapeStyle?.fillGradientStops).toHaveLength(3);
		setProps({ el: currentEl(editor) });

		const [, middleStop] = target.querySelectorAll('.pptx-svelte-gradient-stop');
		const colorInput = middleStop?.querySelector<HTMLInputElement>('input[type="color"]');
		if (!colorInput) {
			throw new Error('stop colour input not found');
		}
		colorInput.value = '#123456';
		colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		expect((currentEl(editor) as ShapeStyleShape).shapeStyle?.fillGradientStops?.[1]?.color).toBe(
			'#123456',
		);
		setProps({ el: currentEl(editor) });

		target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-gradient-remove')[1]?.click();
		flushSync();
		expect((currentEl(editor) as ShapeStyleShape).shapeStyle?.fillGradientStops).toHaveLength(2);
	});

	it('disables removal once only two stops remain', () => {
		const editor = makeEditor(gradientShapeEl());
		const { target } = mountPanel(editor, currentEl(editor));
		const removeButtons = target.querySelectorAll<HTMLButtonElement>(
			'.pptx-svelte-gradient-remove',
		);
		expect(Array.from(removeButtons).every((btn) => btn.disabled)).toBeTruthy();
	});
});
