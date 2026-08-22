import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import NotesMasterCanvas from './NotesMasterCanvas.svelte';

/**
 * The Notes Master schematic's body-placeholder preview used to draw its
 * label at a fixed `font-size:12px` CSS rule regardless of the deck's
 * authored `<p:notesStyle>`. It now resolves through the shared
 * `resolveNotesSchematicBodyFontSizePx` cascade (see `notes-style-cascade.ts`),
 * passing `scale: 1` because this canvas is always drawn at its real 1:1 page
 * size and shrunk to fit via the caller's own `transform: scale(...)`.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function renderCanvas(props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(NotesMasterCanvas, { target, props });
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('notesMasterCanvas body placeholder font size', () => {
	it('falls back to the 9pt default (as px) when no notesStyle is authored', () => {
		const target = renderCanvas({
			notesMaster: { path: 'notes', placeholders: [{ type: 'body' }] },
			canvasSize: { width: 720, height: 960 },
		});
		const body = target.querySelector<HTMLElement>('[data-region="body"]');
		// 9pt / 0.75 = 12px at 1:1 scale.
		expect(body?.style.fontSize).toBe('12px');
	});

	it("resolves the deck's authored notesStyle level-0 font size instead of the fixed clamp", () => {
		const target = renderCanvas({
			notesMaster: {
				path: 'notes',
				placeholders: [{ type: 'body' }],
				notesStyle: { 0: { fontSize: 24 } }, // 24px -> 18pt
			},
			canvasSize: { width: 720, height: 960 },
		});
		const body = target.querySelector<HTMLElement>('[data-region="body"]');
		// 18pt / 0.75 = 24px at 1:1 scale: larger than the old fixed 12px.
		expect(body?.style.fontSize).toBe('24px');
	});

	it('does not apply the body font size to other placeholder labels', () => {
		const target = renderCanvas({
			notesMaster: {
				path: 'notes',
				placeholders: [{ type: 'sldNum' }],
				notesStyle: { 0: { fontSize: 96 } },
			},
			canvasSize: { width: 720, height: 960 },
		});
		const pageNum = target.querySelector<HTMLElement>('[data-region="sldNum"]');
		expect(pageNum?.style.fontSize).toBe('');
	});
});
