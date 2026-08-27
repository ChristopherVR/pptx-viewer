import type { InkPptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';
import { useInkDrawing } from './useInkDrawing';

function buildOps(): { ops: EditorOperations; addElement: ReturnType<typeof vi.fn> } {
	const addElement = vi.fn();
	const ops = { addElement } as unknown as EditorOperations;
	return { ops, addElement };
}

describe('useInkDrawing: authored pressure parity with React', () => {
	it('does not author inkPointPressures for a mouse stroke (uniform pressure)', () => {
		const { ops, addElement } = buildOps();
		const { addInkStroke } = useInkDrawing({
			canEdit: () => true,
			presenting: ref(false),
			activeTool: ref('pen'),
			activeSlide: computed(() => undefined),
			selectedElementIds: ref([]),
			ops,
		});

		addInkStroke({
			points: [
				{ x: 0, y: 0, pressure: 0.5 },
				{ x: 10, y: 5, pressure: 0.5 },
				{ x: 20, y: 0, pressure: 0.5 },
			],
			color: '#000000',
			width: 3,
			tool: 'pen',
		});

		expect(addElement).toHaveBeenCalledOnce();
		const ink = addElement.mock.calls[0][0] as InkPptxElement;
		expect(ink.type).toBe('ink');
		expect(ink.inkPointPressures).toBeUndefined();
	});

	it('authors a variable-width inkPointPressures channel for a stylus stroke with varying pressure', () => {
		const { ops, addElement } = buildOps();
		const { addInkStroke } = useInkDrawing({
			canEdit: () => true,
			presenting: ref(false),
			activeTool: ref('pen'),
			activeSlide: computed(() => undefined),
			selectedElementIds: ref([]),
			ops,
		});

		const pressures = [0.1, 0.4, 0.9, 0.3];
		addInkStroke({
			points: [
				{ x: 0, y: 0, pressure: pressures[0] },
				{ x: 10, y: 5, pressure: pressures[1] },
				{ x: 20, y: 0, pressure: pressures[2] },
				{ x: 30, y: 5, pressure: pressures[3] },
			],
			color: '#000000',
			width: 3,
			tool: 'pen',
		});

		const ink = addElement.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkPointPressures).toStrictEqual([pressures]);
	});

	it('scales highlighter width 3x while still authoring its pressure channel', () => {
		const { ops, addElement } = buildOps();
		const { addInkStroke } = useInkDrawing({
			canEdit: () => true,
			presenting: ref(false),
			activeTool: ref('highlighter'),
			activeSlide: computed(() => undefined),
			selectedElementIds: ref([]),
			ops,
		});

		addInkStroke({
			points: [
				{ x: 0, y: 0, pressure: 0.2 },
				{ x: 10, y: 0, pressure: 0.8 },
			],
			color: '#ffff00',
			width: 2,
			tool: 'highlighter',
		});

		const ink = addElement.mock.calls[0][0] as InkPptxElement;
		expect(ink.inkWidths).toStrictEqual([6]);
		expect(ink.inkOpacities).toStrictEqual([0.4]);
		expect(ink.inkPointPressures).toStrictEqual([[0.2, 0.8]]);
	});

	it('does not add an element for a single-point tap', () => {
		const { ops, addElement } = buildOps();
		const { addInkStroke } = useInkDrawing({
			canEdit: () => true,
			presenting: ref(false),
			activeTool: ref('pen'),
			activeSlide: computed(() => undefined),
			selectedElementIds: ref([]),
			ops,
		});

		addInkStroke({ points: [{ x: 5, y: 5 }], color: '#000', width: 3, tool: 'pen' });
		expect(addElement).not.toHaveBeenCalled();
	});
});
