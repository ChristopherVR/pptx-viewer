import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useElementClipboard } from './useElementClipboard';

function shape(id: string, x = 0, y = 0): PptxElement {
	return { type: 'shape', id, name: '', x, y, width: 100, height: 50 } as PptxElement;
}

function group(id: string, children: PptxElement[]): PptxElement {
	return {
		type: 'group',
		id,
		name: '',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		children,
	} as PptxElement;
}

function useHarness() {
	const elements = new Map<string, PptxElement>();
	const selectedElementIds = ref<string[]>([]);
	const clipboard = useElementClipboard({
		findSlideElement: (id) => elements.get(id),
		addElement: (el) => elements.set(el.id, el),
		removeElement: (id) => elements.delete(id),
		selectedElementIds,
	});
	return { elements, selectedElementIds, clipboard };
}

describe('useElementClipboard', () => {
	it('pastes with the shared 20px cascade offset', () => {
		const { elements, clipboard } = useHarness();
		elements.set('a', shape('a', 0, 0));
		clipboard.copyElement('a');
		clipboard.pasteElement();
		const pasted = [...elements.values()].find((el) => el.id !== 'a')!;
		expect(pasted.id).not.toBe('a');
		expect(pasted.x).toBe(20);
		expect(pasted.y).toBe(20);
	});

	it('re-ids every descendant of a pasted group, not just the root', () => {
		const { elements, clipboard } = useHarness();
		elements.set('g', group('g', [shape('child-1'), shape('child-2')]));
		clipboard.copyElement('g');
		clipboard.pasteElement();
		const pasted = [...elements.values()].find((el) => el.id !== 'g') as PptxElement & {
			children: PptxElement[];
		};
		expect(pasted.id).not.toBe('g');
		const childIds = pasted.children.map((c) => c.id);
		expect(childIds).not.toContain('child-1');
		expect(childIds).not.toContain('child-2');
		expect(new Set(childIds).size).toBe(2);
	});
});
