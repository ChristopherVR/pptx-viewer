/**
 * The View tab adapter routes typed shared intents to the existing outputs and
 * editor-state setter. No Angular TestBed (see `vitest.config.ts`): the
 * component is instantiated directly with stubbed signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { RibbonViewSectionComponent } from './ribbon-view-section.component';

function create(editor: Record<string, unknown> = {}): RibbonViewSectionComponent {
	const section = runInInjectionContext(
		Injector.create({ providers: [{ provide: EditorStateService, useValue: editor }] }),
		() => new RibbonViewSectionComponent(),
	);
	Object.assign(section, { canEdit: signal(true) as unknown as InputSignal<boolean> });
	return section;
}
const intent = (detail: unknown) => new CustomEvent('view-request', { detail });

describe('ribbonViewSectionComponent', () => {
	it('maps command intents to the existing outputs', () => {
		const section = create();
		const normal = vi.spyOn(section.goToNormalView, 'emit');
		const sorter = vi.spyOn(section.openSorter, 'emit');
		const fit = vi.spyOn(section.zoomToFit, 'emit');
		section['request'](intent({ kind: 'command', value: 'normal' }));
		section['request'](intent({ kind: 'command', value: 'slideSorter' }));
		section['request'](intent({ kind: 'command', value: 'zoomToFit' }));
		expect([normal, sorter, fit].map((spy) => spy.mock.calls.length)).toStrictEqual([1, 1, 1]);
	});

	it('maps option intents to toggles and the editor template mode, and guides to axes', () => {
		const setEditTemplateMode = vi.fn();
		const section = create({ setEditTemplateMode, editTemplateMode: signal(false) });
		const grid = vi.spyOn(section.toggleGrid, 'emit');
		const guide = vi.spyOn(section.addGuide, 'emit');
		section['request'](intent({ kind: 'option', value: 'showGrid', enabled: true }));
		section['request'](intent({ kind: 'option', value: 'templateEditing', enabled: true }));
		section['request'](intent({ kind: 'guide', axis: 'h' }));
		section['request'](intent({ kind: 'guide', axis: 'v' }));
		expect(grid).toHaveBeenCalledOnce();
		expect(setEditTemplateMode).toHaveBeenCalledExactlyOnceWith(true);
		expect(guide.mock.calls).toStrictEqual([['y'], ['x']]);
	});

	it('reflects controlled inputs in the shared state', () => {
		const section = create({ editTemplateMode: signal(true) });
		Object.assign(section, { showRulers: signal(true), snapToShape: signal(false) });
		expect(section['view']()).toMatchObject({
			editable: true,
			showRulers: true,
			snapToShape: false,
			templateEditing: true,
		});
	});
});
