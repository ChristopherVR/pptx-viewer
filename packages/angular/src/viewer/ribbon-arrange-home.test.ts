/**
 * The Arrange adapter reflects selection and edit rights into the four shared
 * strips and routes their typed intents to the editor service. No Angular
 * TestBed (see `vitest.config.ts`): the component is built with stubbed signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { RibbonArrangeSectionComponent } from './ribbon-arrange-section.component';

function create(editor: Record<string, unknown>, canEdit = true) {
	const component = runInInjectionContext(
		Injector.create({ providers: [{ provide: EditorStateService, useValue: editor }] }),
		() => new RibbonArrangeSectionComponent(),
	);
	Object.assign(component, { slideIndex: signal(1), canEdit: signal(canEdit) });
	return component;
}
const intent = (id: string, part?: string) =>
	new CustomEvent('home-request', { detail: part ? { id, part } : { id } });

describe('ribbonArrangeSectionComponent shared strips', () => {
	it('routes align, distribute, order and edit intents for the active slide', () => {
		const editor = {
			selectedIds: signal(['a', 'b', 'c']),
			alignSelected: vi.fn(),
			distributeSelected: vi.fn(),
			sendSelectedBackward: vi.fn(),
			bringSelectedForward: vi.fn(),
			sendSelectedToBack: vi.fn(),
			bringSelectedToFront: vi.fn(),
			duplicateSelected: vi.fn(),
			deleteSelected: vi.fn(),
		};
		const component = create(editor);
		component['onAlign'](intent('home.arrange.align', 'centerH'));
		component['onAlign'](intent('home.arrange.align', 'distribute-vertical'));
		component['onOrder'](intent('home.arrange.sendBackward'));
		component['onOrder'](intent('home.arrange.bringForward'));
		component['onOrder'](intent('home.arrange.sendToBack'));
		component['onOrder'](intent('home.arrange.bringToFront'));
		component['onEdit'](intent('home.arrange.duplicate'));
		component['onEdit'](intent('home.arrange.delete'));
		expect(editor.alignSelected).toHaveBeenCalledExactlyOnceWith(1, 'centerH');
		expect(editor.distributeSelected).toHaveBeenCalledExactlyOnceWith(1, 'vertical');
		for (const method of [
			'sendSelectedBackward',
			'bringSelectedForward',
			'sendSelectedToBack',
			'bringSelectedToFront',
			'duplicateSelected',
			'deleteSelected',
		] as const) {
			expect(editor[method]).toHaveBeenCalledExactlyOnceWith(1);
		}
	});

	it('gates on the selection, edit rights and the three-element distribute threshold', () => {
		const selected = signal(['a']);
		const component = create({ selectedIds: selected });
		let controls = component['arrangeView']().controls;
		expect(controls['home.arrange.delete']?.disabled).toBeFalsy();
		expect(controls['home.arrange.align#distribute-horizontal']?.disabled).toBeTruthy();
		selected.set(['a', 'b', 'c']);
		controls = component['arrangeView']().controls;
		expect(controls['home.arrange.align#distribute-horizontal']?.disabled).toBeFalsy();
		selected.set([]);
		expect(
			component['arrangeView']().controls['home.arrange.flipHorizontal']?.disabled,
		).toBeTruthy();
		const locked = create({ selectedIds: signal(['a']) }, false);
		expect(locked['arrangeView']().controls['home.arrange.duplicate']?.disabled).toBeTruthy();
	});
});
