import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import {
	computeHandoutSlots,
	renderHandoutMasterCanvas,
	renderNotesMasterCanvas,
} from './master-canvases';

describe('master canvases', () => {
	it('renders typed notes placeholders using the framework-neutral hooks', () => {
		const canvas = renderNotesMasterCanvas(
			document,
			createTranslator(),
			{ path: 'notes', backgroundColor: '#abcdef', placeholders: [{ type: 'body' }] },
			{ width: 720, height: 960 },
			1,
		);
		expect(canvas.dataset.testid).toBe('notes-master-page');
		expect(canvas.style.backgroundColor).toBe('#abcdef');
		expect(canvas.querySelector('[data-region="body"]')?.textContent).toBe('Body');
	});

	it("resolves the body placeholder's schematic font size from the deck's notesStyle, scaled to the preview", () => {
		const canvas = renderNotesMasterCanvas(
			document,
			createTranslator(),
			{
				path: 'notes',
				placeholders: [{ type: 'body' }],
				notesStyle: { 0: { fontSize: 24 } }, // 24px -> 18pt
			},
			{ width: 360, height: 480 },
			0.5,
		);
		const body = canvas.querySelector<HTMLElement>('[data-region="body"]');
		// 18pt / 0.75 = 24px at 1:1, times a 0.5 schematic scale = 12px.
		expect(body?.style.fontSize).toBe('12px');
	});

	it('falls back to the default notes font size (scaled) with no authored notesStyle', () => {
		const canvas = renderNotesMasterCanvas(
			document,
			createTranslator(),
			{ path: 'notes', placeholders: [{ type: 'body' }] },
			{ width: 360, height: 480 },
			0.5,
		);
		const body = canvas.querySelector<HTMLElement>('[data-region="body"]');
		// 9pt default / 0.75 = 12px at 1:1, times a 0.5 schematic scale = 6px.
		expect(body?.style.fontSize).toBe('6px');
	});

	it('renders every supported handout grid', () => {
		for (const count of [1, 2, 3, 4, 6, 9]) {
			expect(computeHandoutSlots(count)).toHaveLength(count);
		}
		const canvas = renderHandoutMasterCanvas(
			document,
			createTranslator(),
			{ path: 'handout' },
			{ width: 720, height: 960 },
			6,
		);
		expect(canvas.dataset.testid).toBe('handout-master-page');
		expect(canvas.querySelectorAll('[data-testid="handout-slot"]')).toHaveLength(6);
		expect(canvas.textContent).toContain('Page Number');
	});
});
