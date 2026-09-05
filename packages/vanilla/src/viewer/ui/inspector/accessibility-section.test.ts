import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createAccessibilitySection } from './accessibility-section';
import type { InspectorHandlers, InspectorState } from './types';

function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		isTextShapeOrConnector: true,
		altText: '',
		title: '',
		...overrides,
	} as InspectorState;
}

function handlers(): InspectorHandlers {
	return {
		setAltText: vi.fn(),
		setTitle: vi.fn(),
	} as unknown as InspectorHandlers;
}

describe('accessibility section (shape/text/connector alt text and title)', () => {
	it('is hidden when nothing is selected', () => {
		const section = createAccessibilitySection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ hasSelection: false }));
		expect(section.el.hidden).toBeTruthy();
	});

	it('is hidden for an element kind other than text/shape/connector', () => {
		const section = createAccessibilitySection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ isTextShapeOrConnector: false }));
		expect(section.el.hidden).toBeTruthy();
	});

	it('shows the current altText and title for a shape', () => {
		const section = createAccessibilitySection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ altText: 'A red rectangle', title: 'Callout' }));
		expect(section.el.hidden).toBeFalsy();
		const textarea = section.el.querySelector('textarea') as HTMLTextAreaElement;
		const input = section.el.querySelector('input[type="text"]') as HTMLInputElement;
		expect(textarea.value).toBe('A red rectangle');
		expect(input.value).toBe('Callout');
	});

	it('commits altText on change', () => {
		const h = handlers();
		const section = createAccessibilitySection(document, createTranslator(), sectionFactory(), h);
		section.update(state());
		const textarea = section.el.querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = 'Updated description';
		textarea.dispatchEvent(new Event('change'));
		expect(h.setAltText).toHaveBeenCalledWith('Updated description');
	});

	it('commits title on change', () => {
		const h = handlers();
		const section = createAccessibilitySection(document, createTranslator(), sectionFactory(), h);
		section.update(state());
		const input = section.el.querySelector('input[type="text"]') as HTMLInputElement;
		input.value = 'Updated title';
		input.dispatchEvent(new Event('change'));
		expect(h.setTitle).toHaveBeenCalledWith('Updated title');
	});
});
