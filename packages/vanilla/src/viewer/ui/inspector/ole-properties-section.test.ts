import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createOlePropertiesSection } from './ole-properties-section';
import type { InspectorState } from './types';

function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		isOle: false,
		oleObjectType: undefined,
		oleFileName: undefined,
		oleIsLinked: false,
		...overrides,
	} as InspectorState;
}

describe('ole properties section', () => {
	it('hides itself when the selection is not an OLE object', () => {
		const section = createOlePropertiesSection(document, createTranslator(), sectionFactory());
		section.update(state({ isOle: false }));
		expect(section.el.hidden).toBeTruthy();
	});

	it('shows Embedded status by default', () => {
		const section = createOlePropertiesSection(document, createTranslator(), sectionFactory());
		section.update(state({ isOle: true, oleObjectType: 'excel' }));
		expect(section.el.hidden).toBeFalsy();
		expect(section.el.textContent).toContain('Embedded');
	});

	it('shows Linked status for a linked object', () => {
		const section = createOlePropertiesSection(document, createTranslator(), sectionFactory());
		section.update(state({ isOle: true, oleIsLinked: true }));
		expect(section.el.textContent).toContain('Linked');
	});

	it('shows the file name row when present, hides it when absent', () => {
		const section = createOlePropertiesSection(document, createTranslator(), sectionFactory());
		section.update(state({ isOle: true, oleFileName: 'budget.xlsx' }));
		expect(section.el.textContent).toContain('budget.xlsx');

		section.update(state({ isOle: true, oleFileName: undefined }));
		expect(section.el.textContent).not.toContain('budget.xlsx');
	});
});
