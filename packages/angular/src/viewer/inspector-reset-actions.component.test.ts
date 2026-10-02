/**
 * #398: the inspector reset and clear actions share one gating contract
 * (`inspector-reset-actions` in pptx-viewer-shared) across all five bindings.
 * No TestBed (see `vitest.config.ts`): components are instantiated directly
 * with their inputs stubbed as signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { ChartDataEditorComponent } from './chart-data-editor.component';
import { EditorStateService } from './editor-state.service';
import { ImageCropWashPanelComponent } from './image-crop-wash-panel.component';
import { ImagePropertiesPanelComponent } from './image-properties-panel.component';
import { LoadContentService } from './load-content.service';
import { MediaPropertiesPanelComponent } from './media-properties-panel.component';
import { SlideBackgroundCardComponent } from './slide-background-card.component';

const inject = <T>(factory: () => T): T =>
	runInInjectionContext(Injector.create({ providers: [] }), factory);

const picture = (extra: object = {}): PptxElement =>
	({ id: 'p', type: 'image', x: 0, y: 0, width: 10, height: 10, ...extra }) as PptxElement;

function stub(target: object, values: Record<string, unknown>): void {
	for (const [key, value] of Object.entries(values)) {
		(target as Record<string, unknown>)[key] = () => value;
	}
}

describe('angular inspector reset and clear actions', () => {
	it('reset Picture is gated on editability and an override, and clears effects and crop shape', () => {
		const make = (element: PptxElement, canEdit = true) => {
			const panel = inject(() => new ImagePropertiesPanelComponent());
			Object.assign(panel, { element: signal(element), canEdit: signal(canEdit) });
			return panel;
		};
		const clean = make(picture());
		const patches: Partial<PptxElement>[] = [];
		clean.patch.subscribe((p) => patches.push(p));
		expect(clean['resetEnabled']()).toBeFalsy();
		clean['reset']();
		expect(patches).toStrictEqual([]);

		const dirty = make(picture({ imageEffects: { brightness: 3 } }));
		dirty.patch.subscribe((p) => patches.push(p));
		expect(dirty['resetEnabled']()).toBeTruthy();
		dirty['reset']();
		expect(patches).toStrictEqual([{ imageEffects: undefined, cropShape: 'none' }]);

		expect(make(picture({ imageEffects: { brightness: 3 } }), false)['resetEnabled']()).toBeFalsy();
	});

	it('reset Crop zeroes the insets and is disabled when not editable', () => {
		const make = (canEdit: boolean) => {
			const panel = inject(() => new ImageCropWashPanelComponent());
			Object.assign(panel, { element: signal(picture()), canEdit: signal(canEdit) });
			return panel;
		};
		const panel = make(true);
		const patches: Partial<PptxElement>[] = [];
		panel.patch.subscribe((p) => patches.push(p));
		panel['resetCrop']();
		expect(patches).toStrictEqual([{ cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 }]);
		expect(make(false)['croppable']()).toBeFalsy();
	});

	it('reset trim is visible only for editable trimmed media and patches both ends', () => {
		const make = (trimStartMs: number | undefined, canEdit: boolean) => {
			const panel = inject(() => new MediaPropertiesPanelComponent());
			const element = { id: 'm', type: 'media', x: 0, y: 0, width: 1, height: 1, trimStartMs };
			Object.assign(panel, { element: signal(element), canEdit: signal(canEdit) });
			return panel;
		};
		expect(make(undefined, true)['resetTrimState']().visible).toBeFalsy();
		const trimmed = make(250, true);
		expect(trimmed['resetTrimState']().visible).toBeTruthy();
		expect(trimmed['trimResetPatch']()).toStrictEqual({ trimStartMs: 0, trimEndMs: 0 });
		expect(make(250, false)['resetTrimState']().visible).toBeFalsy();
	});

	it('clear series colour is shown only for a coloured series while editable', () => {
		const editor = Object.create(ChartDataEditorComponent.prototype) as ChartDataEditorComponent;
		stub(editor, { canEdit: true });
		expect(
			editor['seriesClearState']({ name: 'a', values: [], color: '#fff' }).visible,
		).toBeTruthy();
		expect(editor['seriesClearState']({ name: 'a', values: [] }).visible).toBeFalsy();
		stub(editor, { canEdit: false });
		expect(
			editor['seriesClearState']({ name: 'a', values: [], color: '#fff' }).visible,
		).toBeFalsy();
	});

	it('clear Background removes every facet and respects canEdit', () => {
		const make = (canEdit: boolean) => {
			const editorState = new EditorStateService();
			editorState.setSlides([
				{
					id: 's',
					rId: 's',
					slideNumber: 1,
					elements: [],
					backgroundColor: '#123456',
				} as PptxSlide,
			]);
			const injector = Injector.create({
				providers: [
					{ provide: EditorStateService, useValue: editorState },
					{
						provide: LoadContentService,
						useValue: { slideMasters: () => [], getHandler: () => null },
					},
					{ provide: TranslateService, useValue: { instant: (key: string) => key } },
				],
			});
			const card = runInInjectionContext(injector, () => new SlideBackgroundCardComponent());
			Object.assign(card, { slideIndex: () => 0, canEdit: () => canEdit });
			return {
				editorState,
				controls: card as unknown as {
					clearState: () => { visible: boolean; enabled: boolean };
					onClear: () => void;
				},
			};
		};
		expect(make(false).controls.clearState()).toStrictEqual({ visible: true, enabled: false });
		const { editorState, controls } = make(true);
		expect(controls.clearState()).toStrictEqual({ visible: true, enabled: true });
		controls.onClear();
		expect(editorState.slides()[0]?.backgroundColor).toBeUndefined();
	});
});
