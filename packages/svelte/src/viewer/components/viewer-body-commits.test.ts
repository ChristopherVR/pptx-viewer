import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../editor/editor-state.svelte';
import { createEditCommits } from './viewer-body-commits';

/**
 * On-canvas SmartArt commits must reflow the cached drawing shapes when the
 * edit leaves them cleared, as React's `handleCommitNodeText` /
 * `handleChangeNodeStyle` do. This binding never called
 * `rebuildDrawingShapesIfCleared`, so once a structural edit had emptied
 * `drawingShapes` the diagram stayed on the crude family approximation no
 * matter what was edited afterwards.
 */
function smartArt(drawingShapes: PptxSmartArtData['drawingShapes']): PptxElement {
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
			drawingShapes,
		},
	} as PptxElement;
}

/** A real deck's cached PowerPoint `dsp` drawing. */
const CACHED: PptxSmartArtData['drawingShapes'] = [
	{ id: 'dsp1', shapeType: 'roundRect', x: 0, y: 0, width: 100, height: 40, text: 'One' },
	{ id: 'dsp2', shapeType: 'roundRect', x: 0, y: 50, width: 100, height: 40, text: 'Two' },
];

/** Minimal `EditorState` surface the commit handlers actually read. */
function editorFor(element: PptxElement) {
	const applyElementPatch = vi.fn();
	const editor = { activeElements: [element], applyElementPatch } as unknown as EditorState;
	return { commits: createEditCommits(editor), applyElementPatch };
}

function patchedData(applyElementPatch: ReturnType<typeof vi.fn>): PptxSmartArtData | undefined {
	const patch = applyElementPatch.mock.calls[0]?.[1] as Partial<PptxElement> | undefined;
	return patch && 'smartArtData' in patch ? patch.smartArtData : undefined;
}

describe('createEditCommits smartArt reflow', () => {
	it('rebuilds a drawing an earlier structural edit had cleared, on a fill commit', () => {
		const { commits, applyElementPatch } = editorFor(smartArt([]));
		commits.commitSmartArtFill('sa1', 'n1', '#ff0000');
		const shapes = patchedData(applyElementPatch)?.drawingShapes ?? [];
		// Without the reflow this stays the empty array the structural edit left.
		expect(shapes).toHaveLength(2);
		expect(shapes[0]?.id).toBe('reflow-list-n1');
	});

	it('rebuilds a cleared drawing on a node-text commit too', () => {
		const { commits, applyElementPatch } = editorFor(smartArt([]));
		commits.commitSmartArtNode('sa1', 'n1', 'Uno');
		const shapes = patchedData(applyElementPatch)?.drawingShapes ?? [];
		expect(shapes.map((shape) => shape.id)).toStrictEqual(['reflow-list-n1', 'reflow-list-n2']);
		expect(shapes[0]?.text).toBe('Uno');
	});

	it('leaves an intact cached drawing alone on a text edit', () => {
		const { commits, applyElementPatch } = editorFor(smartArt(CACHED));
		commits.commitSmartArtNode('sa1', 'n1', 'Uno');
		const shapes = patchedData(applyElementPatch)?.drawingShapes ?? [];
		// The cached `dsp` drawing still wins: patched in place, never regenerated.
		expect(shapes.map((shape) => shape.id)).toStrictEqual(['dsp1', 'dsp2']);
		expect(shapes[0]?.text).toBe('Uno');
	});

	it('ignores a no-op text commit', () => {
		const { commits, applyElementPatch } = editorFor(smartArt(CACHED));
		commits.commitSmartArtNode('sa1', 'n1', 'One');
		expect(applyElementPatch).not.toHaveBeenCalled();
	});
});
