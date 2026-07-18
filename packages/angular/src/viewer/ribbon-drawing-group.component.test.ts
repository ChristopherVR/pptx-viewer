/**
 * Regression tests for the Home tab Drawing group wiring.
 *
 * The Shapes dropdown used to emit a `shapeInsert` output that dead-ended at
 * `PowerPointViewerComponent` (never bound), so picking a shape did nothing.
 * The group now inserts straight through the shared {@link EditorStateService}
 * (like the Insert and Arrange sections); these tests pin that behaviour:
 * picking a preset adds a selected, undoable shape element to the active slide
 * and marks the deck dirty. No TestBed (matching `ribbon-command-wiring.test.ts`):
 * components are constructed inside a plain `Injector` context.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { SHAPE_PRESET_DEFS } from '../internal/shared';
import type { ShapePresetDef } from '../internal/shared';
import { newPresetShapeElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { RibbonDrawingGroupComponent } from './ribbon-drawing-group.component';

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

function createGroup(editor: EditorStateService): RibbonDrawingGroupComponent {
	return runInInjectionContext(
		Injector.create({ providers: [{ provide: EditorStateService, useValue: editor }] }),
		() => new RibbonDrawingGroupComponent(),
	);
}

/** Access the protected handlers the template binds to. */
interface DrawingGroupHandlers {
	onShapeSelect: (shape: ShapePresetDef) => void;
	onArrange: (direction: 'up' | 'down') => void;
	onArrangeEdge: (edge: 'front' | 'back') => void;
	shapesOpen: { set: (open: boolean) => void; (): boolean };
}

function handlers(group: RibbonDrawingGroupComponent): DrawingGroupHandlers {
	return group as unknown as DrawingGroupHandlers;
}

const RECT_PRESET = SHAPE_PRESET_DEFS[0];

describe('ribbonDrawingGroupComponent shape insertion', () => {
	it('inserts the picked preset into the active slide immediately', () => {
		const editor = new EditorStateService();
		editor.setSlides([slide('s1')]);
		const group = createGroup(editor);
		handlers(group).shapesOpen.set(true);

		handlers(group).onShapeSelect(RECT_PRESET);

		const elements = editor.slides()[0].elements;
		expect(elements).toHaveLength(1);
		expect(elements[0]).toMatchObject({ type: 'shape', shapeType: 'rect' });
		expect(elements[0].id).toBeTruthy();
		expect(handlers(group).shapesOpen()).toBeFalsy();
	});

	it('selects the new shape, marks the deck dirty, and supports undo', () => {
		const editor = new EditorStateService();
		editor.setSlides([slide('s1')]);
		const group = createGroup(editor);
		expect(editor.dirty()).toBeFalsy();

		handlers(group).onShapeSelect(RECT_PRESET);

		const inserted = editor.slides()[0].elements[0];
		expect(editor.selectedIds()).toStrictEqual([inserted.id]);
		expect(editor.dirty()).toBeTruthy();
		expect(editor.canUndo()).toBeTruthy();
		editor.undo();
		expect(editor.slides()[0].elements).toHaveLength(0);
	});

	it('uses the shared preset geometry id for every catalogue entry', () => {
		const editor = new EditorStateService();
		editor.setSlides([slide('s1')]);
		const group = createGroup(editor);

		for (const preset of SHAPE_PRESET_DEFS.slice(0, 12)) {
			handlers(group).onShapeSelect(preset);
		}

		const kinds = editor.slides()[0].elements.map((el) => (el as { shapeType?: string }).shapeType);
		expect(kinds).toStrictEqual(SHAPE_PRESET_DEFS.slice(0, 12).map((preset) => preset.type));
	});

	it('newPresetShapeElement carries the preset geometry and default styling', () => {
		const element = newPresetShapeElement('roundRect', 'Rounded');
		expect(element).toMatchObject({
			type: 'shape',
			id: '',
			name: 'Rounded',
			shapeType: 'roundRect',
		});
		expect((element as { shapeStyle?: { fillColor?: string } }).shapeStyle?.fillColor).toBe(
			'#3b82f6',
		);
	});
});

describe('ribbonDrawingGroupComponent arrange wiring', () => {
	function editorWithThree(): EditorStateService {
		const editor = new EditorStateService();
		const el = (id: string): PptxElement =>
			({ type: 'shape', id, name: '', x: 0, y: 0, width: 10, height: 10 }) as PptxElement;
		editor.setSlides([slide('s1', [el('a'), el('b'), el('c')])]);
		return editor;
	}

	it('routes the arrange dropdown to the shared layer operations', () => {
		const editor = editorWithThree();
		const group = createGroup(editor);
		editor.select(['a']);

		handlers(group).onArrange('up');
		expect(editor.slides()[0].elements.map((el) => el.id)).toStrictEqual(['b', 'a', 'c']);

		handlers(group).onArrangeEdge('front');
		expect(editor.slides()[0].elements.map((el) => el.id)).toStrictEqual(['b', 'c', 'a']);

		handlers(group).onArrangeEdge('back');
		expect(editor.slides()[0].elements.map((el) => el.id)).toStrictEqual(['a', 'b', 'c']);

		handlers(group).onArrange('down');
		expect(editor.slides()[0].elements.map((el) => el.id)).toStrictEqual(['a', 'b', 'c']);
	});
});
