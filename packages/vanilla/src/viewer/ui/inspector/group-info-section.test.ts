import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createGroupInfoSection } from './group-info-section';
import type { InspectorState } from './types';

function sectionFactory() {
	return (): HTMLElement => document.createElement('div');
}

function state(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		isGroup: false,
		groupChildCount: undefined,
		...overrides,
	} as InspectorState;
}

describe('group info section', () => {
	it('hides itself when the selection is not a group', () => {
		const section = createGroupInfoSection(document, createTranslator(), sectionFactory());
		section.update(state({ isGroup: false }));
		expect(section.el.hidden).toBeTruthy();
	});

	it('shows the child count for a group with children', () => {
		const section = createGroupInfoSection(document, createTranslator(), sectionFactory());
		section.update(state({ isGroup: true, groupChildCount: 3 }));
		expect(section.el.hidden).toBeFalsy();
		expect(section.el.textContent).toContain('3');
		expect(section.el.textContent).toContain('children');
	});

	it('falls back to a generic label when the child count is unknown', () => {
		const section = createGroupInfoSection(document, createTranslator(), sectionFactory());
		section.update(state({ isGroup: true, groupChildCount: undefined }));
		expect(section.el.textContent).toContain('Grouped element');
	});
});
