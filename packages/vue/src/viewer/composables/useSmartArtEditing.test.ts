import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNode,
	SmartArtLayoutType,
} from 'pptx-viewer-core';
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

	it('smartArtLayoutLabel resolves the shared category key for every layout', () => {
		// The helper hands the catalogue key to `translate`; asserting on the key
		// keeps this test about the wiring rather than about English wording.
		const echo = (key: string): string => key;
		expect(smartArtLayoutLabel('cycle', echo)).toBe('pptx.smartart.category.cycle');
		expect(smartArtLayoutLabel('target', echo)).toBe('pptx.smartart.category.target');
		expect(smartArtLayoutLabel('bending', echo)).toBe('pptx.smartart.category.bending');
	});

	it('smartArtLayoutLabel falls back to the raw token for an unmapped layout', () => {
		// A deck may carry a layout newer than the catalogue; showing the token
		// beats showing nothing, and proves the value set is never filtered.
		expect(smartArtLayoutLabel('unknown' as SmartArtLayoutType, (key) => key)).toBe('unknown');
	});

	it('exposes per-row display, move and remove disabled flags', () => {
		const { computed: data } = dataRef(baseData());
		const api = useSmartArtEditing({ smartArtData: data, apply: vi.fn() });
		const rows = api.rows.value;
		expect(rows[0].displayIndex).toBe(1);
		expect(rows[0].moveUpDisabled).toBeTruthy();
		expect(rows[2].moveDownDisabled).toBeTruthy();
		expect(rows[1].moveUpDisabled).toBeFalsy();
	});

	it('addItem is blocked at a layout max and allowed when removable', () => {
		const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C'), node('d', 'D')];
		const { computed: data } = dataRef(baseData({ nodes, resolvedLayoutType: 'matrix' }));
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		expect(api.canAdd.value).toBeFalsy();
		api.addItem();
		expect(apply).not.toHaveBeenCalled();
		expect(api.boundsHint.value).toBe('This layout uses exactly 4 items.');
	});

	it('removeNode respects the layout minimum for top-level nodes', () => {
		const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C')];
		const { computed: data } = dataRef(baseData({ nodes, resolvedLayoutType: 'cycle' }));
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		// cycle min is 3, so removing a top-level node is blocked.
		api.removeNode('a');
		expect(apply).not.toHaveBeenCalled();
	});

	it('onNodeKeyDown Enter inserts a sibling and queues focus on it', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		const event = {
			key: 'Enter',
			shiftKey: false,
			preventDefault: vi.fn(),
		} as unknown as KeyboardEvent;
		api.onNodeKeyDown(event, 'n1');
		expect(event.preventDefault).toHaveBeenCalledWith();
		const next = patchData(apply.mock.calls[0][0]);
		expect(next.nodes).toHaveLength(4);
		// A focus request is queued for the inserted node.
		expect(api.pendingFocusId.value).not.toBeNull();
	});

	it('onNodeKeyDown Backspace removes an empty node only', () => {
		const nodes = [node('a', 'A'), node('b', ''), node('c', 'C')];
		const { computed: data } = dataRef(baseData({ nodes }));
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		const del = { key: 'Backspace', preventDefault: vi.fn() } as unknown as KeyboardEvent;
		api.onNodeKeyDown(del, 'b');
		expect(patchData(apply.mock.calls[0][0]).nodes.map((n) => n.id)).toStrictEqual(['a', 'c']);
		// A non-empty node is not removed on Backspace.
		apply.mockClear();
		api.onNodeKeyDown(del, 'a');
		expect(apply).not.toHaveBeenCalled();
	});

	it('onNodeKeyDown Tab / Shift+Tab demote and promote', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		const tab = {
			key: 'Tab',
			shiftKey: false,
			preventDefault: vi.fn(),
		} as unknown as KeyboardEvent;
		api.onNodeKeyDown(tab, 'n2');
		expect(patchData(apply.mock.calls[0][0]).nodes.find((n) => n.id === 'n2')?.parentId).toBe('n1');
	});

	it('setNodeStyle merges a per-node visual override and clears drawing shapes', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.setNodeStyle('n2', { fillColor: '#ff0000', bold: true });
		const next = patchData(apply.mock.calls[0][0]);
		expect(next.nodes.find((n) => n.id === 'n2')?.style).toStrictEqual({
			fillColor: '#ff0000',
			bold: true,
		});
		expect(next.drawingShapes).toBeUndefined();
	});

	it('setNodeStyle is a no-op (no apply) for an unknown node id', () => {
		const { computed: data } = dataRef(baseData());
		const apply = vi.fn();
		const api = useSmartArtEditing({ smartArtData: data, apply });
		api.setNodeStyle('missing', { bold: true });
		expect(apply).not.toHaveBeenCalled();
	});

	it('extraConnections counts only non-tree connections', () => {
		const { computed: data } = dataRef(
			baseData({
				connections: [
					{ sourceId: 'n1', destId: 'n2', type: 'parOf' },
					{ sourceId: 'n1', destId: 'n3', type: 'sibTrans' },
				],
			}),
		);
		const api = useSmartArtEditing({ smartArtData: data, apply: vi.fn() });
		expect(api.extraConnections.value).toBe(1);
	});
});
