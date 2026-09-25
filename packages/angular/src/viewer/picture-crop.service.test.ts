/**
 * Crop mode's history contract in the Angular binding: live drags record no
 * undo, Enter / commit leaves exactly ONE undo step whose undo restores the
 * pre-crop picture, and Escape restores the picture leaving no undo step.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { beginCropDrag, dragCropHandle } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { PictureCropService } from './picture-crop.service';

function picture(): PptxElement {
	return {
		type: 'picture',
		id: 'pic',
		x: 100,
		y: 50,
		width: 200,
		height: 100,
		imageData: 'data:image/png;base64,AAAA',
	} as PptxElement;
}

function shape(): PptxElement {
	return { type: 'shape', id: 'sh', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

function setup(): { editor: EditorStateService; crop: PictureCropService } {
	const editor = new EditorStateService();
	editor.setSlides([{ id: 's1', slideNumber: 1, elements: [picture(), shape()] } as PptxSlide]);
	const injector = Injector.create({
		providers: [{ provide: EditorStateService, useValue: editor }, PictureCropService],
	});
	const crop = runInInjectionContext(injector, () => injector.get(PictureCropService));
	return { editor, crop };
}

function pic(editor: EditorStateService): PptxElement & { cropLeft?: number } {
	return editor.slides()[0].elements.find((el) => el.id === 'pic') as PptxElement & {
		cropLeft?: number;
	};
}

/** Drag the west handle 40 slide px to the right, live. */
function dragWest(editor: EditorStateService, crop: PictureCropService): void {
	crop.applyLive(dragCropHandle(beginCropDrag(pic(editor)), 'w', 40, 0));
}

function key(name: string): KeyboardEvent {
	return new KeyboardEvent('keydown', { key: name, cancelable: true });
}

describe('pictureCropService', () => {
	it('enters only on a croppable picture and selects it', () => {
		const { editor, crop } = setup();
		expect(crop.enter(0, editor.slides()[0].elements[1])).toBeFalsy();
		expect(crop.state()).toBeNull();
		expect(crop.enter(0, pic(editor))).toBeTruthy();
		expect(crop.activeElementId()).toBe('pic');
		expect(editor.selectedIds()).toStrictEqual(['pic']);
	});

	it('applies handle drags live without recording history', () => {
		const { editor, crop } = setup();
		crop.enter(0, pic(editor));
		dragWest(editor, crop);
		expect(pic(editor).cropLeft).toBeGreaterThan(0);
		expect(pic(editor).x).toBeCloseTo(140);
		expect(editor.canUndo()).toBeFalsy();
	});

	it('enter commits with ONE undo step that restores the pre-crop picture', () => {
		const { editor, crop } = setup();
		crop.enter(0, pic(editor));
		dragWest(editor, crop);
		dragWest(editor, crop);
		const event = key('Enter');
		expect(crop.handleKeyDown(event)).toBeTruthy();
		expect(event.defaultPrevented).toBeTruthy();
		expect(crop.state()).toBeNull();
		const cropped = pic(editor).cropLeft ?? 0;
		expect(cropped).toBeGreaterThan(0);
		expect(editor.canUndo()).toBeTruthy();

		editor.undo();
		expect(pic(editor).cropLeft ?? 0).toBe(0);
		expect(pic(editor).x).toBe(100);
		expect(pic(editor).width).toBe(200);
		expect(editor.canUndo()).toBeFalsy();
		editor.redo();
		expect(pic(editor).cropLeft).toBeCloseTo(cropped);
	});

	it('escape restores the picture and leaves no undo step', () => {
		const { editor, crop } = setup();
		crop.enter(0, pic(editor));
		dragWest(editor, crop);
		expect(crop.handleKeyDown(key('Escape'))).toBeTruthy();
		expect(crop.state()).toBeNull();
		expect(pic(editor).cropLeft ?? 0).toBe(0);
		expect(pic(editor).x).toBe(100);
		expect(editor.canUndo()).toBeFalsy();
	});

	it('commits nothing when the crop did not change, and ignores keys outside crop mode', () => {
		const { editor, crop } = setup();
		expect(crop.handleKeyDown(key('Escape'))).toBeFalsy();
		crop.enter(0, pic(editor));
		crop.commit();
		expect(editor.canUndo()).toBeFalsy();
	});

	it('toggle enters, then commits', () => {
		const { editor, crop } = setup();
		crop.toggle(0, pic(editor));
		expect(crop.isCropping('pic')).toBeTruthy();
		dragWest(editor, crop);
		crop.toggle(0, pic(editor));
		expect(crop.state()).toBeNull();
		expect(editor.canUndo()).toBeTruthy();
	});
});
