import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import type { RibbonControlId } from '../internal/shared';
import { RibbonDesignSectionComponent } from './ribbon-design-section.component';

function section(editable: boolean) {
	const injector = Injector.create({ providers: [] });
	const component = runInInjectionContext(injector, () => new RibbonDesignSectionComponent());
	Object.assign(component, { canEdit: () => editable });
	return {
		component,
		request: (id: RibbonControlId) =>
			(component as unknown as { request(id: RibbonControlId): void }).request(id),
		injector,
	};
}
describe('design ribbon command routing', () => {
	it('routes each intent to its native surface exactly once', () => {
		const { component, request, injector } = section(true);
		const calls: string[] = [];
		component.toggleThemeGallery.subscribe(() => calls.push('gallery'));
		component.editTheme.subscribe(() => calls.push('editor'));
		component.openSlideSize.subscribe(() => calls.push('size'));
		component.toggleInspector.subscribe(() => calls.push('background'));
		for (const command of component.commands) {
			request(command.id);
		}
		expect(calls).toStrictEqual(['gallery', 'editor', 'size', 'background']);
		injector.destroy();
	});

	it('locks editing commands but preserves slide-size inspection', () => {
		const { component, request, injector } = section(false);
		let editing = 0;
		let sizes = 0;
		component.editTheme.subscribe(() => editing++);
		component.toggleInspector.subscribe(() => editing++);
		component.openSlideSize.subscribe(() => sizes++);
		request('design.themes.editTheme');
		request('design.customize.formatBackground');
		request('design.customize.slideSize');
		expect(editing).toBe(0);
		expect(sizes).toBe(1);
		injector.destroy();
	});
});
