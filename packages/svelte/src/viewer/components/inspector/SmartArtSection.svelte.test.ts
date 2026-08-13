import type { PptxElement, PptxSmartArtData, SmartArtPptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import SmartArtSection from './SmartArtSection.svelte';

/**
 * A structural SmartArt edit (add / remove / promote / demote / reorder /
 * layout switch / diagram style) clears the cached `dsp` drawing shapes to
 * `[]`. React's inspector funnels every one of those through
 * `applySmartArtData`, which runs `rebuildDrawingShapesIfCleared` so the
 * richer cached-shape render path stays active. This panel never did, so a
 * single Add left the diagram on the crude family approximation for the rest
 * of the session.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** A real deck's cached PowerPoint `dsp` drawing. */
const CACHED: PptxSmartArtData['drawingShapes'] = [
	{ id: 'dsp1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 40, text: 'One' },
	{ id: 'dsp2', shapeType: 'roundRect', x: 0, y: 50, width: 100, height: 40, text: 'Two' },
];

function smartArt(): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		smartArtData: {
			nodes: [
				{ id: 'n1', text: 'One' },
				{ id: 'n2', text: 'Two' },
			],
			resolvedLayoutType: 'list',
			drawingShapes: CACHED,
		},
	} as PptxElement;
}

function render(): { editor: EditorState; target: HTMLElement } {
	const element = smartArt();
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select(element.id);
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SmartArtSection, {
		target,
		props: { editor, el: element as SmartArtPptxElement },
	});
	flushSync();
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	return { editor, target };
}

function currentData(editor: EditorState): PptxSmartArtData | undefined {
	const element = editor.activeElements.find((candidate) => candidate.id === 'sa1');
	return element?.type === 'smartArt' ? element.smartArtData : undefined;
}

function clickButton(target: HTMLElement, label: string): void {
	const button = [...target.querySelectorAll('button')].find(
		(b) => b.textContent?.trim() === label,
	);
	button?.click();
	flushSync();
}

describe('smartArtSection structural reflow', () => {
	it('rebuilds the cached drawing shapes an Add cleared', () => {
		const { editor, target } = render();
		clickButton(target, 'Add');
		const data = currentData(editor);
		expect(data?.nodes).toHaveLength(3);
		// Without the reflow this is the empty array the core op left behind.
		expect(data?.drawingShapes).toHaveLength(3);
		expect(data?.drawingShapes?.[0]?.id).toBe('reflow-list-n1');
	});

	it('rebuilds after a layout switch', () => {
		const { editor, target } = render();
		target.querySelector<HTMLButtonElement>('[data-testid="smartart-layout-cycle"]')?.click();
		flushSync();
		const shapes = currentData(editor)?.drawingShapes ?? [];
		expect(shapes).toHaveLength(2);
		expect(shapes[0]?.id).toBe('reflow-cycle-n1');
	});

	it('leaves an intact cached drawing alone on a node-text edit', () => {
		const { editor, target } = render();
		const input = target.querySelector<HTMLInputElement>('[data-testid="smartart-node-text"]')!;
		input.value = 'Uno';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		const shapes = currentData(editor)?.drawingShapes ?? [];
		// The cached `dsp` drawing still wins: patched in place, never regenerated.
		expect(shapes.map((shape) => shape.id)).toStrictEqual(['dsp1', 'dsp2']);
		expect(shapes[0]?.text).toBe('Uno');
	});
});
