import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createOlePropertiesSection } from './ole-properties-section';
import type { InspectorHandlers, InspectorState } from './types';

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
		oleName: undefined,
		...overrides,
	} as InspectorState;
}

function handlers(): InspectorHandlers & { setOleName: ReturnType<typeof vi.fn> } {
	return { setOleName: vi.fn() } as unknown as InspectorHandlers & {
		setOleName: ReturnType<typeof vi.fn>;
	};
}

describe('ole properties section', () => {
	it('hides itself when the selection is not an OLE object', () => {
		const section = createOlePropertiesSection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ isOle: false }));
		expect(section.el.hidden).toBeTruthy();
	});

	it('shows Embedded status by default', () => {
		const section = createOlePropertiesSection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ isOle: true, oleObjectType: 'excel' }));
		expect(section.el.hidden).toBeFalsy();
		expect(section.el.textContent).toContain('Embedded');
	});

	it('shows Linked status for a linked object', () => {
		const section = createOlePropertiesSection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ isOle: true, oleIsLinked: true }));
		expect(section.el.textContent).toContain('Linked');
	});

	it('shows the file name row when present, hides it when absent', () => {
		const section = createOlePropertiesSection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ isOle: true, oleFileName: 'budget.xlsx' }));
		expect(section.el.textContent).toContain('budget.xlsx');

		section.update(state({ isOle: true, oleFileName: undefined }));
		expect(section.el.textContent).not.toContain('budget.xlsx');
	});

	it('renders the current oleName in the Object Name field', () => {
		const section = createOlePropertiesSection(
			document,
			createTranslator(),
			sectionFactory(),
			handlers(),
		);
		section.update(state({ isOle: true, oleName: 'Q3 Budget' }));
		const input = section.el.querySelector('input[type="text"]');
		expect(input).not.toBeNull();
		expect((input as HTMLInputElement).value).toBe('Q3 Budget');
	});

	it('calls handlers.setOleName on change', () => {
		const h = handlers();
		const section = createOlePropertiesSection(document, createTranslator(), sectionFactory(), h);
		section.update(state({ isOle: true }));
		const input = section.el.querySelector('input[type="text"]') as HTMLInputElement;
		input.value = 'Q3 Budget';
		input.dispatchEvent(new Event('change', { bubbles: true }));
		expect(h.setOleName).toHaveBeenCalledWith('Q3 Budget');
	});
});
