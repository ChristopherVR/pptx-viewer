import type { PptxElement, PptxSmartArtData, PptxSmartArtNode } from 'pptx-viewer-core';
import { resetSmartArtEditCounter } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { smartArtLayoutLabel, useSmartArtEditing } from './useSmartArtEditing';

function node(id: string, text: string, parentId?: string): PptxSmartArtNode {
	return { id, text, parentId };
}

function dataRef(initial: PptxSmartArtData) {
	const r = ref<PptxSmartArtData>(initial);
	return { r, computed: computed<PptxSmartArtData>(() => r.value) };
}

function baseData(overrides: Partial<PptxSmartArtData> = {}): PptxSmartArtData {
	return {
		nodes: [node('n1', 'A'), node('n2', 'B'), node('n3', 'C')],
		resolvedLayoutType: 'list',
		colorScheme: 'colorful1',
		style: 'flat',
		...overrides,
	} as PptxSmartArtData;
}

/** Extract the smartArtData out of an emitted element patch. */
function patchData(patch: Partial<PptxElement>): PptxSmartArtData {
	const data = (patch as { smartArtData?: PptxSmartArtData }).smartArtData;
	if (!data) {
		throw new Error('patch has no smartArtData');
	}
	return data;
}

describe('useSmartArtEditing', () => {
	beforeEach(() => {
		resetSmartArtEditCounter();
	});

	it('exposes rows with index + isChild metadata', () => {
		const { computed: data } = dataRef(
			baseData({ nodes: [node('p', 'Parent'), node('c', 'Child', 'p')] }),
		);
		const api = useSmartArtEditing({ smartArtData: data, apply: vi.fn() });
		expect(api.rows.value.map((r) => [r.node.id, r.index, r.isChild])).toStrictEqual([
			['p', 0, false],
			['c', 1, true],
		]);
	});

	it('addItem appends a node and applies a fresh data object', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.addItem();
		expect(apply).toHaveBeenCalledOnce();
		expect(patchData(apply.mock.calls[0][0]).nodes).toHaveLength(4);
	});

	it('removeNode is a no-op (no apply) when only one node remains', () => {
		const { computed: data } = dataRef(baseData({ nodes: [node('n1', 'Only')] }));
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.removeNode('n1');
		expect(apply).not.toHaveBeenCalled();
	});

	it('promote and demote defer to core ops', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.demote('n2');
		expect(patchData(apply.mock.calls[0][0]).nodes.find((n) => n.id === 'n2')?.parentId).toBe('n1');
	});

	it('setColorScheme skips when unchanged and applies when changed', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.setColorScheme('colorful1');
		expect(apply).not.toHaveBeenCalled();
		api.setColorScheme('monochromatic2');
		expect(patchData(apply.mock.calls[0][0]).colorScheme).toBe('monochromatic2');
	});

	it('switchLayout preserves nodes and updates the resolved layout', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.switchLayout('hierarchy');
		const next = patchData(apply.mock.calls[0][0]);
		expect(next.resolvedLayoutType).toBe('hierarchy');
		expect(next.nodes).toHaveLength(3);
	});

	it('never mutates the input data object', () => {
		const initial = baseData();
		const { computed: data } = dataRef(initial);
		const api = useSmartArtEditing({ smartArtData: data, apply: vi.fn() });
		api.addItem();
		api.removeNode('n2');
		api.switchLayout('cycle');
		expect(initial.nodes).toHaveLength(3);
		expect(initial.resolvedLayoutType).toBe('list');
	});

	it('smartArtLayoutLabel falls back to title-case for unmapped types', () => {
		expect(smartArtLayoutLabel('cycle')).toBe('Cycle');
		expect(smartArtLayoutLabel('target')).toBe('Target');
	});
});
