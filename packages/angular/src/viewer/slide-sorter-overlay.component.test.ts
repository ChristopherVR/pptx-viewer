import { DestroyRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';

describe('sorter selection adapter', () => {
	it('duplicates the range in descending order and zooms without leaving the sorter', () => {
		const injector = Injector.create({
			providers: [{ provide: DestroyRef, useValue: { onDestroy: () => () => undefined } }],
		});
		const component = runInInjectionContext(injector, () => new SlideSorterOverlayComponent());
		Object.defineProperty(component, 'slides', {
			value: signal([{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
		});
		Object.defineProperty(component, 'canEdit', { value: signal(true) });
		component.onThumbClick(0, new MouseEvent('click'));
		component.onThumbClick(1, new MouseEvent('click', { shiftKey: true }));
		const duplicates: number[] = [];
		component.duplicateSlide.subscribe((index) => duplicates.push(index));
		component.onKeydown(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
		component.onKeydown(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
		expect(duplicates).toStrictEqual([1, 0]);
		component.onKeydown(new KeyboardEvent('keydown', { key: '+', ctrlKey: true }));
		expect(component.state().zoom).toBe(110);
		const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
		escape.preventDefault();
		component.onKeydown(escape);
		expect(component.state().selectedIds).toStrictEqual(['a']);
	});
});
