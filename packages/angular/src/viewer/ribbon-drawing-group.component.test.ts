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
 *
 * The Fill/Outline swatch pickers were `disabled` placeholders that were
 * never wired up at all; the tests below pin that picking a swatch commits
 * the same `fillColor`/`fillMode`/`strokeColor` keys React's and Vue's
 * DrawingGroup do (via the shared `shapeFillChange`/`shapeOutlineChange`).
 */
/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts; merging them across blocks (or
   across intervening statements within one) isn't a style choice, it would
   scramble the sequencing the test is asserting on. */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { SHAPE_PRESET_DEFS, shapeFillChange, shapeOutlineChange } from '../internal/shared';
import type { ShapePresetDef } from '../internal/shared';
import { newPresetShapeElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import {
	canFormatShapeSelection,
	fillColorOf,
	outlineColorOf,
	RibbonDrawingGroupComponent,
	shapeStylePatch,
} from './ribbon-drawing-group.component';

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

describe('ribbonDrawingGroupComponent Fill/Outline wiring', () => {
	function shapeEl(overrides: Partial<PptxElement> = {}): PptxElement {
		return {
			type: 'shape',
			id: 'shape-1',
			name: '',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			shapeStyle: { fillColor: '#111111', strokeColor: '#222222' },
			...overrides,
		} as PptxElement;
	}

	it('is disabled without an editable, shape-like selection', () => {
		expect(canFormatShapeSelection(true, shapeEl())).toBeTruthy();
		expect(canFormatShapeSelection(false, shapeEl())).toBeFalsy();
		expect(canFormatShapeSelection(true, null)).toBeFalsy();
		const table = { type: 'table', id: 't1' } as unknown as PptxElement;
		expect(canFormatShapeSelection(true, table)).toBeFalsy();
	});

	it('reads the swatch dot colour off the current selection, defaulting when unset', () => {
		expect(fillColorOf(shapeEl())).toBe('#111111');
		expect(outlineColorOf(shapeEl())).toBe('#222222');
		expect(fillColorOf(shapeEl({ shapeStyle: {} }))).toBe('#ffffff');
		expect(outlineColorOf(shapeEl({ shapeStyle: {} }))).toBe('#000000');
		expect(fillColorOf(null)).toBe('#ffffff');
		expect(outlineColorOf(null)).toBe('#000000');
	});

	it('merges a Fill pick into the existing shape style via the shared decision function', () => {
		const patch = shapeStylePatch(shapeEl(), shapeFillChange('#3b82f6'));
		expect(patch).toStrictEqual({
			shapeStyle: { fillColor: '#3b82f6', fillMode: 'solid', strokeColor: '#222222' },
		});
	});

	it('merges an Outline pick without disturbing the existing fill', () => {
		const patch = shapeStylePatch(shapeEl(), shapeOutlineChange('#ff0000'));
		expect(patch).toStrictEqual({
			shapeStyle: { fillColor: '#111111', strokeColor: '#ff0000' },
		});
	});

	it('has no patch for a non-shape or absent selection (the picker stays disabled)', () => {
		expect(shapeStylePatch(null, shapeFillChange('#ff0000'))).toBeUndefined();
		const table = { type: 'table', id: 't1' } as unknown as PptxElement;
		expect(shapeStylePatch(table, shapeFillChange('#ff0000'))).toBeUndefined();
	});

	it('the Fill button commits through EditorStateService.updateElement (end-to-end)', () => {
		const editor = new EditorStateService();
		editor.setSlides([slide('s1', [shapeEl()])]);

		const patch = shapeStylePatch(editor.slides()[0].elements[0], shapeFillChange('#00ff00'));
		expect(patch).toBeDefined();
		if (patch) {
			editor.updateElement(0, 'shape-1', patch);
		}

		expect(
			(editor.slides()[0].elements[0] as unknown as { shapeStyle: Record<string, unknown> })
				.shapeStyle,
		).toMatchObject({ fillColor: '#00ff00', fillMode: 'solid' });
	});
});
