/**
 * slide-background-card.component.test.ts: "Hide Background Graphics"
 * checkbox (`p:sld/@showMasterSp`) added to the BACKGROUND card, parity with
 * react/vue/svelte/vanilla.
 *
 * No TestBed (matching the rest of this package): the component is
 * constructed inside a plain `Injector` context, mirroring
 * `slide-transition-card.component.test.ts`.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { SlideBackgroundCardComponent } from './slide-background-card.component';

/** The protected surface the template binds to. */
interface BackgroundCardControls {
	hideBackgroundGraphics: () => boolean;
	onToggleHideBackgroundGraphics: (event: Event) => void;
}

function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements: [], ...overrides } as PptxSlide;
}

/** A change event carrying the checkbox's checked state. */
function checkedEvent(checked: boolean): Event {
	return { target: { checked } as HTMLInputElement } as unknown as Event;
}

function harness(overrides: Partial<PptxSlide> = {}): {
	editor: EditorStateService;
	controls: BackgroundCardControls;
} {
	const editor = new EditorStateService();
	editor.setSlides([slide(overrides)]);
	const injector = Injector.create({
		providers: [
			{ provide: EditorStateService, useValue: editor },
			{ provide: LoadContentService, useValue: { slideMasters: () => [], getHandler: () => null } },
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
		],
	});
	const card = runInInjectionContext(injector, () => new SlideBackgroundCardComponent());
	// See the module doc: `input()` fields are overwritten with plain functions
	// since nothing here binds them through Angular's real input machinery.
	(card as unknown as { slideIndex: () => number }).slideIndex = () => 0;
	(card as unknown as { canEdit: () => boolean }).canEdit = () => true;
	return { editor, controls: card as unknown as BackgroundCardControls };
}

describe('slide background card: Hide Background Graphics', () => {
	it('is unchecked by default (background graphics shown)', () => {
		const { controls } = harness();
		expect(controls.hideBackgroundGraphics()).toBeFalsy();
	});

	it('is checked when showMasterShapes is false', () => {
		const { controls } = harness({ showMasterShapes: false });
		expect(controls.hideBackgroundGraphics()).toBeTruthy();
	});

	it('sets showMasterShapes: false on the slide when checked', () => {
		const { editor, controls } = harness();
		controls.onToggleHideBackgroundGraphics(checkedEvent(true));
		expect(editor.slides()[0]?.showMasterShapes).toBeFalsy();
	});

	it('sets showMasterShapes: true on the slide when unchecked', () => {
		const { editor, controls } = harness({ showMasterShapes: false });
		controls.onToggleHideBackgroundGraphics(checkedEvent(false));
		expect(editor.slides()[0]?.showMasterShapes).toBeTruthy();
	});
});
