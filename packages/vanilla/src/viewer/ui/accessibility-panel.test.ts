import type { AccessibilityIssue } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createAccessibilityPanel } from './accessibility-panel';

const issues: AccessibilityIssue[] = [
	{
		type: 'missingAltText',
		severity: 'error',
		slideIndex: 1,
		elementId: 'image-1',
		message: 'An image has no alternative text.',
		suggestion: 'Add a description.',
	},
	{
		type: 'blankSlide',
		severity: 'tip',
		slideIndex: 2,
		message: 'This slide is blank.',
		suggestion: 'Remove it if it is not intentional.',
	},
];

describe('createAccessibilityPanel', () => {
	it('groups shared checker issues and navigates to an issue slide', () => {
		const onSelectSlide = vi.fn();
		const panel = createAccessibilityPanel(document, createTranslator(), onSelectSlide);
		panel.open(issues);

		expect(panel.el.hidden).toBeFalsy();
		expect(panel.el.textContent).toContain('Errors (1)');
		expect(panel.el.textContent).toContain('Tips (1)');
		panel.el.querySelector<HTMLButtonElement>('.pptxv-accessibility-issue')?.click();
		expect(onSelectSlide).toHaveBeenCalledWith(1);
	});

	it('reports a successful check and closes through its close control', () => {
		const panel = createAccessibilityPanel(document, createTranslator(), vi.fn());
		panel.open([]);
		expect(panel.el.textContent).toContain('No issues found');
		panel.el.querySelector<HTMLButtonElement>('.pptxv-accessibility-close')?.click();
		expect(panel.el.hidden).toBeTruthy();
	});
});
