/**
 * The animation panel's "On bookmark" trigger picker (Angular binding).
 *
 * No Angular TestBed (see `vitest.config.ts`): the panel is constructed in a
 * plain `Injector`, its inputs are stubbed as signals, and the template is
 * checked from source.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal, OutputEmitterRef, Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { bookmarkOptionValue, TRIGGER_OPTIONS } from '../internal/shared';
import type { MediaBookmarkOption } from '../internal/shared';
import { AnimationAuthorPanelComponent } from './animation-author-panel.component';
import { componentSource } from './component-source.test-support';

const TEMPLATE = componentSource(__dirname, 'animation-author-panel.component.html');

const SHAPE = { id: 'shape-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
const VIDEO = {
	id: 'video',
	type: 'media',
	mediaType: 'video',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	bookmarks: [
		{ label: 'BM1', time: 0.5 },
		{ label: 'BM2', time: 1.5 },
	],
} as PptxElement;

interface PanelInternals {
	bookmarkOptions: Signal<MediaBookmarkOption[]>;
	selectedBookmark: Signal<string>;
	onTriggerBookmarkChange: (event: Event) => void;
}

function createPanel(animations: PptxElementAnimation[]): {
	panel: PanelInternals;
	emitted: PptxElementAnimation[][];
} {
	const panel = runInInjectionContext(
		Injector.create({
			providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
		}),
		() => new AnimationAuthorPanelComponent(),
	);
	Object.assign(panel, {
		element: signal(SHAPE) as unknown as InputSignal<PptxElement>,
		animations: signal(animations) as unknown as InputSignal<readonly PptxElementAnimation[]>,
		slideElements: signal([SHAPE, VIDEO]) as unknown as InputSignal<readonly PptxElement[]>,
		canEdit: signal(true) as unknown as InputSignal<boolean>,
	});
	const emitted: PptxElementAnimation[][] = [];
	vi.spyOn(
		panel.animationsChange as OutputEmitterRef<PptxElementAnimation[]>,
		'emit',
	).mockImplementation((value) => {
		emitted.push(value);
	});
	return { panel: panel as unknown as PanelInternals, emitted };
}

describe('angular animation panel: On bookmark trigger', () => {
	it('offers the trigger and every media bookmark on the slide', () => {
		expect(TRIGGER_OPTIONS.map((o) => o.value)).toContain('onMediaBookmark');
		const { panel } = createPanel([
			{ elementId: SHAPE.id, entrance: 'fadeIn', trigger: 'onMediaBookmark' },
		]);
		expect(panel.bookmarkOptions().map((o) => o.label)).toStrictEqual(['BM1', 'BM2']);
		expect(panel.selectedBookmark()).toBe('');
	});

	it('commits the chosen bookmark with its media element', () => {
		const { panel, emitted } = createPanel([
			{ elementId: SHAPE.id, entrance: 'fadeIn', trigger: 'onMediaBookmark' },
		]);
		const select = document.createElement('select');
		const option = document.createElement('option');
		option.value = bookmarkOptionValue('video', 'BM2');
		select.append(option);
		select.value = option.value;
		panel.onTriggerBookmarkChange({ target: select } as unknown as Event);
		expect(emitted[0]?.[0]).toMatchObject({
			trigger: 'onMediaBookmark',
			triggerShapeId: 'video',
			triggerBookmark: 'BM2',
		});
	});

	it('shows the picker only for the On bookmark trigger', () => {
		expect(TEMPLATE).toContain("@if (current()?.trigger === 'onMediaBookmark')");
		expect(TEMPLATE).toContain('(change)="onTriggerBookmarkChange($event)"');
	});
});
