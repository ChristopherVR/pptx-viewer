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
		);
		expect(canvas.dataset.testid).toBe('notes-master-page');
		expect(canvas.style.backgroundColor).toBe('#abcdef');
		expect(canvas.querySelector('[data-region="body"]')?.textContent).toBe('Body');
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
