/**
 * ribbon-draw-section.component.test.ts: the Draw ribbon tab's pen colour
 * control (wave-4 B6). Live-preview drags fire the native `input` event
 * continuously; only the committed `change` should record a recent colour, so
 * this pins that split (`onColorInput` drives the live draw state,
 * `onColorCommit` pushes into `RecentColorsService`).
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { RecentColorsService } from './recent-colors.service';
import { RibbonDrawSectionComponent } from './ribbon-draw-section.component';

function createSection(pushed: string[]): RibbonDrawSectionComponent {
	const section = runInInjectionContext(
		Injector.create({
			providers: [
				{ provide: RecentColorsService, useValue: { push: (hex: string) => pushed.push(hex) } },
			],
		}),
		() => new RibbonDrawSectionComponent(),
	);
	Object.assign(section, {
		activeTool: signal('pen') as unknown as InputSignal<string>,
		drawingColor: signal('#000000') as unknown as InputSignal<string>,
		drawingWidth: signal(3) as unknown as InputSignal<number>,
	});
	return section;
}

function colorEvent(value: string): Event {
	const input = document.createElement('input');
	input.type = 'color';
	input.value = value;
	return { target: input } as unknown as Event;
}

describe('ribbonDrawSectionComponent pen colour (wave-4 B6)', () => {
	it('does not push on the live-preview input event', () => {
		const pushed: string[] = [];
		const section = createSection(pushed);
		section['onColorInput'](colorEvent('#ff0000'));
		expect(pushed).toStrictEqual([]);
	});

	it('pushes the committed change into RecentColorsService', () => {
		const pushed: string[] = [];
		const section = createSection(pushed);
		section['onColorCommit'](colorEvent('#ff0000'));
		expect(pushed).toStrictEqual(['#ff0000']);
	});

	it('does not throw when RecentColorsService is unavailable (standalone unit test)', () => {
		const section = runInInjectionContext(
			Injector.create({ providers: [] }),
			() => new RibbonDrawSectionComponent(),
		);
		expect(() => section['onColorCommit'](colorEvent('#123456'))).not.toThrow();
	});
});
