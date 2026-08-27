import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import type { InkPoint } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * `EditorInkController` drives `EditorState` (a runes class), so this suite
 * is named `.svelte.test.ts` to compile with the runes runtime, matching
 * `editor-background-controller.svelte.test.ts`.
 */

function slide(id: string, elements: PptxSlide['elements'] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

function make(current = 0) {
	const handler = {} as unknown as PptxHandler;
	const editor = new EditorState({ getCurrent: () => current, getHandler: () => handler });
	editor.editable = true;
	return editor;
}

const STROKE: InkPoint[] = [
	{ x: 10, y: 10 },
	{ x: 20, y: 10 },
	{ x: 30, y: 20 },
];

describe('editorInkController', () => {
	it('defaults to the select tool with no live preview', () => {
		const editor = make();
		expect(editor.inkOps.tool).toBe('select');
		expect(editor.inkOps.isDrawing).toBeFalsy();
		expect(editor.inkOps.livePathD).toBe('');
	});

	it('setTool switches tools and reports isDrawing for every non-select tool', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		for (const tool of ['pen', 'highlighter', 'eraser'] as const) {
			editor.inkOps.setTool(tool);
			expect(editor.inkOps.tool).toBe(tool);
			expect(editor.inkOps.isDrawing).toBeTruthy();
		}
		editor.inkOps.setTool('select');
		expect(editor.inkOps.isDrawing).toBeFalsy();
	});

	it('setTool to a draw tool clears the current selection', () => {
		const editor = make();
		editor.setSlides([slide('a', [])]);
		editor.select('some-id');
		editor.inkOps.setTool('pen');
		expect(editor.selectedElementId).toBeNull();
	});

	it('previewStroke builds the live SVG path from accumulated points', () => {
		const editor = make();
		editor.inkOps.previewStroke(STROKE);
		expect(editor.inkOps.livePathD).toBe('M 10 10 L 20 10 L 30 20');
	});

	it('commitStroke inserts a new ink element with the current colour/width, undoably', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.inkOps.setTool('pen');
		editor.inkOps.setColor('#ff0000');
		editor.inkOps.setWidth(5);
		editor.inkOps.previewStroke(STROKE);
		editor.inkOps.commitStroke(STROKE);

		expect(editor.inkOps.livePathD).toBe('');
		const elements = editor.slides[0].elements;
		expect(elements).toHaveLength(1);
		const ink = elements[0];
		expect(ink.type).toBe('ink');
		expect(editor.canUndo).toBeTruthy();
		if (ink.type === 'ink') {
			expect(ink.inkColors).toStrictEqual(['#ff0000']);
			expect(ink.inkWidths).toStrictEqual([5]);
			expect(ink.inkTool).toBe('pen');
		}

		editor.undo();
		expect(editor.slides[0].elements).toHaveLength(0);
	});

	it('commitStroke on the highlighter tool tags inkTool + opacity accordingly', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.inkOps.setTool('highlighter');
		editor.inkOps.commitStroke(STROKE);
		const ink = editor.slides[0].elements[0];
		expect(ink.type === 'ink' && ink.inkTool).toBe('highlighter');
		expect(ink.type === 'ink' && ink.inkOpacities).toStrictEqual([0.4]);
	});

	it('commitStroke does not author inkPointPressures for a uniform-pressure (mouse) stroke', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.inkOps.setTool('pen');
		editor.inkOps.commitStroke([
			{ x: 10, y: 10, pressure: 0.5 },
			{ x: 20, y: 10, pressure: 0.5 },
			{ x: 30, y: 20, pressure: 0.5 },
		]);
		const ink = editor.slides[0].elements[0];
		expect(ink.type === 'ink' && ink.inkPointPressures).toBeUndefined();
	});

	it('commitStroke authors a variable-width inkPointPressures channel for a varying-pressure (stylus) stroke', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.inkOps.setTool('pen');
		const pressures = [0.1, 0.6, 0.9];
		editor.inkOps.commitStroke([
			{ x: 10, y: 10, pressure: pressures[0] },
			{ x: 20, y: 10, pressure: pressures[1] },
			{ x: 30, y: 20, pressure: pressures[2] },
		]);
		const ink = editor.slides[0].elements[0];
		expect(ink.type === 'ink' && ink.inkPointPressures).toStrictEqual([pressures]);
	});

	it('commitStroke discards a too-short stroke (a plain tap)', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.inkOps.setTool('pen');
		editor.inkOps.commitStroke([{ x: 5, y: 5 }]);
		expect(editor.slides[0].elements).toHaveLength(0);
		expect(editor.canUndo).toBeFalsy();
	});

	it('commitStroke is a no-op while the eraser or select tool is active', () => {
		const editor = make();
		editor.setSlides([slide('a')]);
		editor.inkOps.setTool('eraser');
		editor.inkOps.commitStroke(STROKE);
		expect(editor.slides[0].elements).toHaveLength(0);
	});

	it('eraseElementAt deletes the topmost ink element under the point, undoably', () => {
		const editor = make();
		const inkBottom = {
			type: 'ink' as const,
			id: 'ink-bottom',
			x: 0,
			y: 0,
			width: 50,
			height: 50,
			inkPaths: ['M 0 0 L 50 50'],
		};
		const inkTop = {
			type: 'ink' as const,
			id: 'ink-top',
			x: 0,
			y: 0,
			width: 50,
			height: 50,
			inkPaths: ['M 0 0 L 50 50'],
		};
		editor.setSlides([slide('a', [inkBottom, inkTop])]);
		editor.inkOps.setTool('eraser');
		editor.inkOps.eraseElementAt({ x: 10, y: 10 });

		expect(editor.slides[0].elements.map((el) => el.id)).toStrictEqual(['ink-bottom']);
		expect(editor.canUndo).toBeTruthy();

		editor.undo();
		expect(editor.slides[0].elements.map((el) => el.id)).toStrictEqual(['ink-bottom', 'ink-top']);
	});

	it('eraseElementAt is a no-op when nothing is hit', () => {
		const editor = make();
		const ink = {
			type: 'ink' as const,
			id: 'ink-1',
			x: 100,
			y: 100,
			width: 20,
			height: 20,
			inkPaths: ['M 0 0 L 20 20'],
		};
		editor.setSlides([slide('a', [ink])]);
		editor.inkOps.eraseElementAt({ x: 0, y: 0 });
		expect(editor.slides[0].elements).toHaveLength(1);
		expect(editor.canUndo).toBeFalsy();
	});
});
