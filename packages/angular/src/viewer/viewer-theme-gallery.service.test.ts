import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { buildThemeColorMap } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorScheme } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { ViewerThemeGalleryService } from './viewer-theme-gallery.service';

const OFFICE_ACCENT1 = '#4472C4';
const ION_ACCENT1 = '#B01513';

const OFFICE_COLORS: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: OFFICE_ACCENT1,
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	hlink: '#0563C1',
	folHlink: '#954F72',
};

function createService(): {
	gallery: ViewerThemeGalleryService;
	editor: EditorStateService;
	loader: LoadContentService;
} {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: destroyRefStub },
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
			{ provide: EditorStateService, useClass: EditorStateService },
			{ provide: LoadContentService, useClass: LoadContentService },
			{ provide: ViewerThemeGalleryService, useClass: ViewerThemeGalleryService },
		],
	});
	return {
		editor: runInInjectionContext(injector, () => injector.get(EditorStateService)),
		loader: runInInjectionContext(injector, () => injector.get(LoadContentService)),
		gallery: runInInjectionContext(injector, () => injector.get(ViewerThemeGalleryService)),
	};
}

describe('viewerThemeGalleryService', () => {
	it('re-colours templateElementsBySlideId alongside slides when applying a theme', () => {
		const { gallery, editor, loader } = createService();
		editor.setSlides([{ id: 's1', rId: 's1', slideNumber: 1, elements: [] }]);
		loader.themeColorMap.set(buildThemeColorMap(OFFICE_COLORS));
		editor.templateElementsBySlideId.set({
			s1: [
				{
					type: 'shape',
					id: 'bg_1',
					x: 0,
					y: 0,
					width: 200,
					height: 100,
					shapeStyle: { fillColor: OFFICE_ACCENT1 },
				} as PptxElement,
			],
		});

		gallery.applyCustomTheme(
			{ ...OFFICE_COLORS, accent1: ION_ACCENT1 },
			{ majorFont: { latin: 'Calibri' }, minorFont: { latin: 'Calibri' } },
			'Custom',
		);

		const patched = editor.templateElementsBySlideId().s1?.[0] as {
			shapeStyle?: { fillColor?: string };
		};
		expect(patched?.shapeStyle?.fillColor).toBe(ION_ACCENT1);
	});
});
