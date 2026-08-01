import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import { PresentationAnnotations } from './presentation-annotations.svelte';
import { RehearseState } from './rehearse-state.svelte';

function editor(): EditorState {
	const value = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	value.editable = true;
	value.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as PptxSlide]);
	return value;
}

describe('presentation parity state', () => {
	it('keeps presentation strokes as ink elements', () => {
		const target = editor();
		const annotations = new PresentationAnnotations();
		annotations.tool = 'pen';
		annotations.pointerDown(0, { x: 10, y: 20 });
		annotations.pointerMove(0, { x: 30, y: 40 });
		annotations.pointerUp(0);
		expect(annotations.count).toBe(1);
		annotations.keep(target);
		expect(target.slides[0]?.elements[0]?.type).toBe('ink');
		expect(annotations.count).toBe(0);
	});

	it('draws each tool in its own colour', () => {
		const annotations = new PresentationAnnotations();
		expect(annotations.penColor).toBe('#ff0000');
		expect(annotations.highlighterColor).toBe('#ffff00');

		annotations.penColor = '#0000ff';
		annotations.highlighterColor = '#00ff00';
		annotations.tool = 'pen';
		annotations.pointerDown(0, { x: 1, y: 1 });
		expect(annotations.current?.color).toBe('#0000ff');
		annotations.pointerUp(0);

		// The highlighter used to be hardcoded to #fde047 regardless of the model.
		annotations.tool = 'highlighter';
		annotations.pointerDown(0, { x: 1, y: 1 });
		expect(annotations.current?.color).toBe('#00ff00');
	});

	it('writes rehearsed slide timing to transitions', () => {
		const target = editor();
		const rehearse = new RehearseState();
		rehearse.start(0);
		rehearse.elapsedMs = 4300;
		rehearse.finish();
		rehearse.save(target);
		expect(target.slides[0]?.transition).toMatchObject({
			advanceAfterMs: 4300,
			advanceOnClick: true,
		});
	});
});
