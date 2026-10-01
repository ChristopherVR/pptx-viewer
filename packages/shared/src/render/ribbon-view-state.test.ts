import { describe, expect, it } from 'vitest';

import { RIBBON_CONTROL_CATALOG } from './customization';
import { canRequestView, viewLabel } from './ribbon-view-state';
import type { RibbonViewState } from './ribbon-view-state';

const state: RibbonViewState = {
	editable: true,
	showRulers: false,
	showGrid: false,
	showGuides: false,
	snapToGrid: false,
	snapToShape: true,
	templateEditing: false,
};

describe('view intent boundaries', () => {
	it('guards edit-only commands but keeps navigation and display options in read-only mode', () => {
		const readOnly = { ...state, editable: false };
		expect(canRequestView(readOnly, { kind: 'command', value: 'slideMaster' })).toBeFalsy();
		expect(canRequestView(readOnly, { kind: 'command', value: 'eyedropper' })).toBeFalsy();
		expect(
			canRequestView(readOnly, { kind: 'option', value: 'templateEditing', enabled: true }),
		).toBeFalsy();
		expect(canRequestView(readOnly, { kind: 'command', value: 'readingView' })).toBeTruthy();
		expect(
			canRequestView(readOnly, { kind: 'option', value: 'showGrid', enabled: true }),
		).toBeTruthy();
		expect(canRequestView(readOnly, { kind: 'guide', axis: 'v' })).toBeTruthy();
	});

	it('rejects malformed programmatic intents', () => {
		expect(canRequestView(state, { kind: 'command', value: 'bogus' as never })).toBeFalsy();
		expect(
			canRequestView(state, { kind: 'option', value: 'bogus' as never, enabled: true }),
		).toBeFalsy();
		expect(canRequestView(state, { kind: 'guide', axis: 'x' as never })).toBeFalsy();
	});

	it('falls back when the translator echoes the key', () => {
		expect(viewLabel({ ...state, translate: (key) => key }, 'pptx.view.show', 'Show')).toBe('Show');
		expect(viewLabel({ ...state, translate: () => 'Zeigen' }, 'pptx.view.show', 'Show')).toBe(
			'Zeigen',
		);
		expect(RIBBON_CONTROL_CATALOG.view.show.controls.addGuide).toBeTruthy();
	});
});
