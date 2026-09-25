// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { isEditorControlTarget, isEditorTextInputTarget } from './editor-key-target';
import { mapEditorKey } from './editor-keymap';

function mount(html: string): HTMLElement {
	const host = document.createElement('div');
	host.innerHTML = html;
	document.body.appendChild(host);
	return host;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('isEditorControlTarget', () => {
	it('treats buttons, links and ARIA widgets as controls', () => {
		const host = mount(
			'<button id="b">B</button><a id="a" href="#">A</a>' +
				'<div role="tab" id="t">T</div><div role="dialog"><span id="in-dialog">x</span></div>' +
				'<div role="toolbar"><span id="in-toolbar">x</span></div>',
		);
		for (const id of ['b', 'a', 't', 'in-dialog', 'in-toolbar']) {
			expect(isEditorControlTarget(host.querySelector(`#${id}`))).toBeTruthy();
		}
	});

	it('treats a custom-element host (shadow-DOM control) as a control', () => {
		const host = mount('<pptx-ui-select id="s"></pptx-ui-select>');
		expect(isEditorControlTarget(host.querySelector('#s'))).toBeTruthy();
	});

	it('leaves the page itself and the slide canvas to the editor', () => {
		const host = mount(
			'<div data-pptx-viewport><div role="button" id="shape" tabindex="0">s</div></div>' +
				'<div id="plain" tabindex="0">root</div>',
		);
		expect(isEditorControlTarget(document.body)).toBeFalsy();
		expect(isEditorControlTarget(document.documentElement)).toBeFalsy();
		expect(isEditorControlTarget(host.querySelector('#shape'))).toBeFalsy();
		expect(isEditorControlTarget(host.querySelector('#plain'))).toBeFalsy();
		expect(isEditorControlTarget(null)).toBeFalsy();
	});

	it('keeps classifying form fields as text input, not as the Tab case', () => {
		const host = mount('<input id="i" />');
		expect(isEditorTextInputTarget(host.querySelector('#i'))).toBeTruthy();
	});
});

describe('tab on a chrome control', () => {
	it('is left to the browser so keyboard focus can move', () => {
		expect(mapEditorKey({ key: 'Tab' }, { isControlTarget: true }).action).toBeNull();
		expect(
			mapEditorKey({ key: 'Tab', shiftKey: true }, { isControlTarget: true }).action,
		).toBeNull();
	});

	it('still cycles the selection from the canvas', () => {
		expect(mapEditorKey({ key: 'Tab' }, { isControlTarget: false }).action).toBe(
			'cycleSelectionNext',
		);
	});

	it('does not change the other shortcuts on a control', () => {
		expect(mapEditorKey({ key: 'z', ctrlKey: true }, { isControlTarget: true }).action).toBe(
			'undo',
		);
	});
});
