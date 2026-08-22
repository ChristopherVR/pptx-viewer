/**
 * notes-panel.component.test.ts: proves the `notesStyle` input reaches the
 * seeded rich-editor HTML and the print output.
 *
 * No Angular TestBed in this package (see `action-settings-panel.component.
 * test.ts`), so this exercises the exact same shared call chain the
 * component's `seedActiveSurface()` / `printNotes()` use
 * (`resolveNotesSegments` -> `segmentsToEditorHtml`, and `buildNotesPrintHtml`)
 * to prove a deck's `<p:notesStyle>` level-0 font size reaches the rendered
 * notes text, then asserts the component/template WIRING against the real
 * source files, matching `comment-body.component.test.ts`'s pattern.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxSlide, PptxTextStyleLevels } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildNotesPrintHtml,
	resolveNotesSegments,
	segmentsToEditorHtml,
} from '../internal/shared';

const HERE = dirname(fileURLToPath(import.meta.url));

const plainNotesSlide: PptxSlide = {
	id: 's1',
	rId: 's1',
	slideNumber: 1,
	elements: [],
	notes: 'Speaker notes with no explicit font size',
};

// `PlaceholderTextLevelStyle.fontSize` is stored in CSS px; the cascade
// converts to points (px * 0.75) before it reaches a `TextStyle`.
const notesStyle: PptxTextStyleLevels = {
	0: { fontSize: 32 },
};

describe('notes panel notesStyle wiring (shared call chain)', () => {
	it('fills in the seeded rich-editor HTML font size from the notes-style default', () => {
		const withoutStyle = segmentsToEditorHtml(resolveNotesSegments(plainNotesSlide));
		expect(withoutStyle).not.toContain('font-size:24pt');

		const withStyle = segmentsToEditorHtml(resolveNotesSegments(plainNotesSlide, notesStyle));
		expect(withStyle).toContain('font-size:24pt');
	});

	it('never overrides a segment that already carries an explicit font size', () => {
		const explicitSlide: PptxSlide = {
			...plainNotesSlide,
			notesSegments: [{ text: 'explicit', style: { fontSize: 10 } }],
		};
		const html = segmentsToEditorHtml(resolveNotesSegments(explicitSlide, notesStyle));
		expect(html).toContain('font-size:10pt');
		expect(html).not.toContain('font-size:24pt');
	});

	it('carries the notes-style default into the printed notes page', () => {
		const html = buildNotesPrintHtml([plainNotesSlide], (n) => `Slide ${n}`, notesStyle);
		expect(html).toContain('24pt');
	});
});

describe('notes panel notesStyle source wiring', () => {
	const componentSource = readFileSync(join(HERE, 'notes-panel.component.ts'), 'utf-8');

	it('declares a notesStyle input typed as PptxTextStyleLevels', () => {
		expect(componentSource).toContain(
			'readonly notesStyle = input<PptxTextStyleLevels | undefined>(undefined);',
		);
	});

	it('threads notesStyle() into every resolveNotesSegments call', () => {
		const calls = componentSource.match(/resolveNotesSegments\([^)]*\)/g) ?? [];
		expect(calls.length).toBeGreaterThan(0);
		for (const call of calls) {
			expect(call).toContain('this.notesStyle()');
		}
	});

	it('threads notesStyle() into the buildNotesPrintHtml call', () => {
		expect(componentSource).toMatch(
			/buildNotesPrintHtml\(\s*\[slide\],[\s\S]*?this\.notesStyle\(\)/,
		);
	});
});

describe('notes panel notesStyle template wiring', () => {
	it('binds [notesStyle] on both docked and mobile <pptx-notes-panel> instances', () => {
		const source = readFileSync(join(HERE, 'power-point-viewer.component.ts'), 'utf-8');
		const panelBlocks = source.split('<pptx-notes-panel').slice(1);
		expect(panelBlocks).toHaveLength(2);
		for (const block of panelBlocks) {
			expect(block).toContain('[notesStyle]="loader.notesMaster()?.notesStyle"');
		}
	});
});
