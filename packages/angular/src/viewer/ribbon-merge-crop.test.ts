/**
 * Home > Arrange's Merge Shapes dropdown and Crop controls, rendered, plus the
 * canvas context menu's Merge / Crop entries. The ribbon runs a merge as ONE
 * undo step that replaces the sources with one custom-geometry shape; the Crop
 * toggle enters crop mode; both controls vanish when the host hides them.
 */
import { ElementRef, signal } from '@angular/core';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide, ShapePptxElement } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { EditorContextMenuComponent } from './editor-context-menu.component';
import { EditorStateService } from './editor-state.service';
import { IsMobileService } from './is-mobile';
import { PictureCropService } from './picture-crop.service';
import { RibbonArrangeSectionComponent } from './ribbon-arrange-section.component';
import { RibbonCropComponent } from './ribbon-crop.component';
import { RibbonMergeShapesComponent } from './ribbon-merge-shapes.component';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
afterEach(() => {
	TestBed.resetTestingModule();
});

function rect(id: string, x: number): ShapePptxElement {
	return { id, type: 'shape', x, y: 0, width: 100, height: 100, shapeType: 'rect' };
}

function picture(): PptxElement {
	return {
		type: 'picture',
		id: 'pic',
		x: 300,
		y: 0,
		width: 200,
		height: 100,
		imageData: 'data:image/png;base64,AAAA',
	} as PptxElement;
}

interface Mounted {
	root: HTMLElement;
	editor: EditorStateService;
	crop: PictureCropService;
	detect: () => void;
}

/** Render `component` with signal inputs (this JIT runner has no signal-input transform). */
function mount<T>(component: Type<T>, inputs: Record<string, unknown>): Mounted {
	TestBed.configureTestingModule({
		imports: [component],
		providers: [
			provideTranslateService({ fallbackLang: 'en' }),
			EditorStateService,
			PictureCropService,
			ViewerInspectorPanelService,
			IsMobileService,
		],
	});
	TestBed.overrideComponent(component, { add: { inputs: Object.keys(inputs) } });
	TestBed.inject(TranslateService).setTranslation('en', translationsEn);
	TestBed.inject(TranslateService).use('en');
	const editor = TestBed.inject(EditorStateService);
	editor.setSlides([
		{ id: 's1', slideNumber: 1, elements: [rect('a', 0), rect('b', 50), picture()] } as PptxSlide,
	]);
	const fixture = TestBed.createComponent(component);
	for (const [name, value] of Object.entries(inputs)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	fixture.detectChanges();
	return {
		root: fixture.nativeElement as HTMLElement,
		editor,
		crop: TestBed.inject(PictureCropService),
		detect: () => fixture.detectChanges(),
	};
}

function q(root: HTMLElement, selector: string): HTMLButtonElement | null {
	return root.querySelector<HTMLButtonElement>(selector);
}

describe('ribbon Merge Shapes', () => {
	it('is disabled (with the hint) until two mergeable shapes are selected', () => {
		const { root, editor, detect } = mount(RibbonMergeShapesComponent, {
			slideIndex: 0,
			canEdit: true,
		});
		const button = q(root, '[data-pptx-ribbon-control="merge-shapes"]');
		expect(button?.disabled).toBeTruthy();
		expect(button?.title).toBe(translationsEn['pptx.shape.mergeShapesHint']);
		editor.select(['a', 'b']);
		detect();
		expect(button?.disabled).toBeFalsy();
		expect(button?.getAttribute('aria-label')).toBe('Merge Shapes');
	});

	it('union replaces the two shapes with one custom shape in one undo step', () => {
		const { root, editor, detect } = mount(RibbonMergeShapesComponent, {
			slideIndex: 0,
			canEdit: true,
		});
		editor.select(['a', 'b']);
		detect();
		q(root, '[data-pptx-ribbon-control="merge-shapes"]')?.click();
		detect();
		const items = [...root.querySelectorAll('[role="menu"] [role="menuitem"]')];
		expect(items.map((el) => el.getAttribute('data-pptx-merge-op'))).toStrictEqual([
			'union',
			'combine',
			'fragment',
			'intersect',
			'subtract',
		]);
		q(root, '[data-pptx-merge-op="union"]')?.click();
		const elements = editor.slides()[0].elements;
		expect(elements).toHaveLength(2);
		const merged = elements[0] as ShapePptxElement;
		expect(merged.shapeType).toBe('custom');
		expect(merged.width).toBeCloseTo(150);
		expect(editor.selectedIds()).toStrictEqual([merged.id]);
		editor.undo();
		expect(editor.slides()[0].elements.map((el) => el.id)).toStrictEqual(['a', 'b', 'pic']);
	});
});

describe('ribbon Crop', () => {
	it('enables for a single picture and toggles crop mode', () => {
		const { root, editor, crop, detect } = mount(RibbonCropComponent, {
			slideIndex: 0,
			canEdit: true,
			selectedElement: picture(),
		});
		const toggle = q(root, '[data-pptx-ribbon-control="crop"]');
		expect(toggle?.disabled).toBeTruthy();
		editor.select(['pic']);
		detect();
		expect(toggle?.disabled).toBeFalsy();
		toggle?.click();
		detect();
		expect(crop.isCropping('pic')).toBeTruthy();
		expect(toggle?.getAttribute('aria-pressed')).toBe('true');
		toggle?.click();
		expect(crop.state()).toBeNull();
	});

	it('crops to a 1:1 aspect ratio as one undo step', () => {
		const { root, editor, detect } = mount(RibbonCropComponent, {
			slideIndex: 0,
			canEdit: true,
			selectedElement: picture(),
		});
		editor.select(['pic']);
		detect();
		q(root, '[data-pptx-ribbon-control="crop-menu"]')?.click();
		detect();
		expect(root.querySelectorAll('[data-pptx-crop-aspect]').length).toBeGreaterThan(5);
		expect(q(root, '[data-pptx-crop-action="fill"]')).not.toBeNull();
		q(root, '[data-pptx-crop-aspect="1:1"]')?.click();
		const pic = editor.slides()[0].elements[2];
		expect(pic.width).toBeCloseTo(pic.height);
		editor.undo();
		expect(editor.slides()[0].elements[2].width).toBe(200);
	});
});

describe('ribbon Arrange customisation', () => {
	it('hides Merge Shapes and Crop when the host hides them', () => {
		const shown = mount(RibbonArrangeSectionComponent, { hiddenActions: [], canEdit: true });
		expect(q(shown.root, '[data-pptx-ribbon-control="merge-shapes"]')).not.toBeNull();
		expect(q(shown.root, '[data-pptx-ribbon-control="crop"]')).not.toBeNull();
		TestBed.resetTestingModule();
		const hidden = mount(RibbonArrangeSectionComponent, {
			hiddenActions: ['mergeShapes', 'crop'],
			canEdit: true,
		});
		expect(q(hidden.root, '[data-pptx-ribbon-control="merge-shapes"]')).toBeNull();
		expect(q(hidden.root, '[data-pptx-ribbon-control="crop"]')).toBeNull();
	});
});

describe('context menu Merge / Crop entries', () => {
	/**
	 * The menu's host style reads its required x/y inputs, which this JIT runner
	 * cannot bind, so the menu is constructed (not rendered) and driven through
	 * the same `entries()` / `run()` its template uses.
	 */
	function menu(ids: string[]): {
		editor: EditorStateService;
		crop: PictureCropService;
		entries: () => { id: string; labelKey: string }[];
		run: (id: string) => void;
	} {
		TestBed.configureTestingModule({
			providers: [
				provideTranslateService({ fallbackLang: 'en' }),
				EditorStateService,
				PictureCropService,
				ViewerInspectorPanelService,
				IsMobileService,
				{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
			],
		});
		const editor = TestBed.inject(EditorStateService);
		editor.setSlides([
			{ id: 's1', slideNumber: 1, elements: [rect('a', 0), rect('b', 50), picture()] } as PptxSlide,
		]);
		editor.select(ids);
		const component = TestBed.runInInjectionContext(() => new EditorContextMenuComponent());
		Object.assign(component, { slideIndex: signal(0) });
		const view = component as unknown as {
			entries: () => { id: string; labelKey: string }[];
			run: (id: string) => void;
		};
		return {
			editor,
			crop: TestBed.inject(PictureCropService),
			entries: () => view.entries(),
			run: (id) => view.run(id),
		};
	}

	it('offers the five merge operations on a mergeable multi-selection and runs them', () => {
		const { editor, entries, run } = menu(['a', 'b']);
		const keys = entries().map((entry) => entry.labelKey);
		for (const key of ['Union', 'Combine', 'Fragment', 'Intersect', 'Subtract']) {
			expect(keys).toContain(`pptx.contextMenu.merge${key}`);
		}
		run('merge-fragment');
		// Two overlapping squares fragment into three pieces, plus the picture.
		expect(editor.slides()[0].elements).toHaveLength(4);
		editor.undo();
		expect(editor.slides()[0].elements).toHaveLength(3);
	});

	it('offers Crop on a single picture and enters crop mode', () => {
		const { crop, entries, run } = menu(['pic']);
		expect(entries().map((entry) => entry.id)).toContain('crop');
		expect(entries().some((entry) => entry.id.startsWith('merge-'))).toBeFalsy();
		run('crop');
		expect(crop.isCropping('pic')).toBeTruthy();
	});
});
