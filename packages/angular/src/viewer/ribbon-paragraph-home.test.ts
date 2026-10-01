/**
 * The Paragraph adapter reflects alignment into the shared strip and routes its
 * indent/alignment intents to the existing native edits. No Angular TestBed
 * (see `vitest.config.ts`): the component is built with stubbed signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';

function create(textStyle: Record<string, unknown>, canEdit: boolean) {
	const component = runInInjectionContext(
		Injector.create({ providers: [{ provide: EditorStateService, useValue: {} }] }),
		() => new RibbonParagraphControlsComponent(),
	);
	Object.assign(component, {
		canEdit: signal(canEdit),
		selectedElement: signal({
			type: 'text',
			id: 'p',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			text: 'Hello',
			textStyle,
		}),
	});
	return component;
}
const intent = (id: string) => new CustomEvent('home-request', { detail: { id } });

describe('ribbonParagraphControlsComponent shared strip', () => {
	it('reflects alignment and gates on edit rights', () => {
		const view = create({ align: 'justify' }, true)['paragraphView']();
		expect(view.controls['home.paragraph.justify']?.pressed).toBeTruthy();
		expect(view.controls['home.paragraph.alignLeft']?.pressed).toBeFalsy();
		expect(view.controls['home.paragraph.alignLeft']?.disabled).toBeFalsy();
		const readOnly = create({}, false)['paragraphView']();
		expect(readOnly.controls['home.paragraph.alignLeft']?.disabled).toBeTruthy();
	});

	it('routes intents to the native indent and alignment edits', () => {
		const component = create({}, true);
		const indent = vi
			.spyOn(component as never, 'changeIndent' as never)
			.mockReturnValue(undefined as never);
		const align = vi
			.spyOn(component as never, 'setAlign' as never)
			.mockReturnValue(undefined as never);
		component['paragraphRequest'](intent('home.paragraph.increaseIndent'));
		component['paragraphRequest'](intent('home.paragraph.decreaseIndent'));
		component['paragraphRequest'](intent('home.paragraph.alignCenter'));
		expect(indent.mock.calls).toStrictEqual([[24], [-24]]);
		expect(align).toHaveBeenCalledExactlyOnceWith('center');
	});
});
