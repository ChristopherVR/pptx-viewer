/**
 * slide-size-card.component.test.ts: PowerPoint's Maximize/Ensure-Fit prompt,
 * Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is constructed
 * inside a plain `Injector` context, matching
 * `viewer-document-properties.service.test.ts`. Pins wave-4 contract item 4:
 * a slide-size change that would resize existing content must prompt before
 * committing, and an empty deck must commit directly, as before.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveSlideSizeRescaleTransform } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { SlideSizeCardComponent } from './slide-size-card.component';

const SCREEN_4X3 = { widthEmu: 9144000, heightEmu: 6858000, type: 'screen4x3' };

function shapeElement(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		name: id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

function slideWith(elements: PptxElement[]): PptxSlide {
	return { elements } as PptxSlide;
}

interface Harness {
	card: SlideSizeCardComponent;
	editor: EditorStateService;
	loader: LoadContentService;
}

function createHarness(slides: PptxSlide[]): Harness {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const editor = new EditorStateService();
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: destroyRefStub },
			{ provide: EditorStateService, useValue: editor },
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
			LoadContentService,
			SlideSizeCardComponent,
		],
	});
	const loader = injector.get(LoadContentService);
	loader.slideSizeEmu.set(SCREEN_4X3);
	loader.canvasSize.set({ width: 960, height: 720 });
	editor.setSlides(slides);
	const card = runInInjectionContext(injector, () => injector.get(SlideSizeCardComponent));
	return { card, editor, loader };
}

function selectChange(value: string): Event {
	const select = document.createElement('select');
	const option = document.createElement('option');
	option.value = value;
	select.append(option);
	select.value = value;
	return { target: select } as unknown as Event;
}

describe('slideSizeCardComponent rescale prompt', () => {
	it('prompts instead of committing when the deck has content and the size differs', () => {
		const { card, loader } = createHarness([slideWith([shapeElement('el-1')])]);
		card['onPresetChange'](selectChange('screen16x9'));
		expect(card['pendingResize']()).toMatchObject({ type: 'screen16x9' });
		// Not yet committed.
		expect(loader.slideSizeEmu()).toStrictEqual(SCREEN_4X3);
	});

	it('commits directly with no prompt when the deck has no elements anywhere', () => {
		const { card, loader } = createHarness([slideWith([])]);
		card['onPresetChange'](selectChange('screen16x9'));
		expect(card['pendingResize']()).toBeNull();
		expect(loader.slideSizeEmu()).toMatchObject({ type: 'screen16x9' });
	});

	it('does not prompt when the confirmed size is unchanged', () => {
		const { card } = createHarness([slideWith([shapeElement('el-1')])]);
		card['onPresetChange'](selectChange('screen4x3'));
		expect(card['pendingResize']()).toBeNull();
	});

	it('maximize scales every slide element as one history entry, then commits the size', () => {
		const { card, editor, loader } = createHarness([slideWith([shapeElement('el-1')])]);
		card['onPresetChange'](selectChange('screen16x9'));
		const pending = card['pendingResize']();
		expect(pending).not.toBeNull();
		if (!pending) {
			return;
		}
		const canUndoBefore = editor.canUndo();
		card['onRescaleChoice'](pending, 'maximize');
		expect(card['pendingResize']()).toBeNull();
		expect(loader.slideSizeEmu()).toMatchObject({ type: 'screen16x9' });
		expect(editor.canUndo()).toBeTruthy();
		expect(canUndoBefore).toBeFalsy();
		// Maximize scales by the LARGER of the two axis ratios (shared's
		// `resolveSlideSizeRescaleTransform`); assert against that directly
		// rather than assuming which axis grows for this particular pair.
		const transform = resolveSlideSizeRescaleTransform(SCREEN_4X3, pending, 'maximize');
		const rescaledElement = editor.slides()[0]?.elements[0];
		expect(rescaledElement?.width).toBeCloseTo(100 * transform.scale);
	});
});
