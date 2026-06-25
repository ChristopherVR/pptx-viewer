import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { isElementInteractive, showsTemplateAffordance } from './template-mode';

function element(id: string): PptxElement {
	return { type: 'shape', id, name: '', x: 0, y: 0, width: 100, height: 50 } as PptxElement;
}

describe('template-mode gate', () => {
	const template = element('layout-shape-3');
	const masterTemplate = element('master-shape-1');
	const normal = element('shape-7');

	it('keeps a layout/master element non-interactive when editTemplateMode is off', () => {
		expect(isElementInteractive(template, true, false)).toBeFalsy();
		expect(isElementInteractive(masterTemplate, true, false)).toBeFalsy();
	});

	it('makes a layout/master element interactive when editTemplateMode is on', () => {
		expect(isElementInteractive(template, true, true)).toBeTruthy();
		expect(isElementInteractive(masterTemplate, true, true)).toBeTruthy();
	});

	it('leaves a normal slide element interactive regardless of editTemplateMode', () => {
		expect(isElementInteractive(normal, true, false)).toBeTruthy();
		expect(isElementInteractive(normal, true, true)).toBeTruthy();
	});

	it('never reports interactive when the canvas base interactivity is off', () => {
		expect(isElementInteractive(normal, false, true)).toBeFalsy();
		expect(isElementInteractive(template, false, true)).toBeFalsy();
	});

	it('shows the affordance only for template elements while editTemplateMode is on', () => {
		expect(showsTemplateAffordance(template, true)).toBeTruthy();
		expect(showsTemplateAffordance(template, false)).toBeFalsy();
		expect(showsTemplateAffordance(normal, true)).toBeFalsy();
	});
});

describe('editorStateService editTemplateMode', () => {
	it('defaults to off and toggles via setEditTemplateMode', () => {
		const svc = new EditorStateService();
		expect(svc.editTemplateMode()).toBeFalsy();
		svc.setEditTemplateMode(true);
		expect(svc.editTemplateMode()).toBeTruthy();
		svc.setEditTemplateMode(false);
		expect(svc.editTemplateMode()).toBeFalsy();
	});
});
