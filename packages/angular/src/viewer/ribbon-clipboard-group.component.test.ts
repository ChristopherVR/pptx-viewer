/**
 * The Clipboard adapter reflects editor state into the shared strip and routes
 * its typed intent to the editor service. No Angular TestBed (see
 * `vitest.config.ts`): the component is instantiated with stubbed signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { RibbonClipboardGroupComponent } from './ribbon-clipboard-group.component';

function create(editor: Record<string, unknown>) {
	const component = runInInjectionContext(
		Injector.create({ providers: [{ provide: EditorStateService, useValue: editor }] }),
		() => new RibbonClipboardGroupComponent(),
	);
	Object.assign(component, { slideIndex: signal(2), canEdit: signal(true) });
	return component;
}
const intent = (id: string) => new CustomEvent('home-request', { detail: { id } });

describe('ribbonClipboardGroupComponent', () => {
	it('routes intents to the editor service for the active slide', () => {
		const editor = { paste: vi.fn(), cutSelected: vi.fn(), copySelected: vi.fn() };
		const component = create({ ...editor, hasClipboard: signal(true) });
		const painter = vi.spyOn(component.toggleFormatPainter, 'emit');
		component['request'](intent('home.clipboard.paste'));
		component['request'](intent('home.clipboard.cut'));
		component['request'](intent('home.clipboard.copy'));
		component['request'](intent('home.clipboard.formatPainter'));
		expect(editor.paste).toHaveBeenCalledExactlyOnceWith(2);
		expect(editor.cutSelected).toHaveBeenCalledExactlyOnceWith(2);
		expect(editor.copySelected).toHaveBeenCalledExactlyOnceWith(2);
		expect(painter).toHaveBeenCalledOnce();
	});

	it('reflects selection, clipboard and read-only state in the shared controls', () => {
		const component = create({ hasClipboard: signal(false) });
		Object.assign(component, { selectedElement: signal({ id: 'e1' }) });
		const controls = component['view']().controls;
		expect(controls['home.clipboard.paste']?.disabled).toBeTruthy();
		expect(controls['home.clipboard.copy']?.disabled).toBeFalsy();
		Object.assign(component, { canEdit: signal(false) });
		expect(component['view']().controls['home.clipboard.cut']?.disabled).toBeTruthy();
	});
});
