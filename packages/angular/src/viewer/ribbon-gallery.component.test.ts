/**
 * `<pptx-ribbon-gallery>` rendered against the REAL shared Shape Styles
 * gallery: tiles come from the descriptor, `applied` drives `aria-pressed`,
 * and a pick dispatches the shared apply result through the editor's
 * undoable update path. Also pins the DOM contract the framework-neutral
 * e2e spec relies on (`data-ribbon-gallery`, `-popup`, `data-gallery-item`).
 */
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import type { PptxSlide, ShapePptxElement } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import { buildRibbonGallery, inlineGalleryItems } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { dispatchGalleryResult } from './ribbon-gallery-helpers';
import { RibbonGalleryComponent } from './ribbon-gallery.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
afterEach(() => {
	TestBed.resetTestingModule();
});

function shape(): ShapePptxElement {
	return { id: 'sh1', type: 'shape', x: 0, y: 0, width: 100, height: 60, shapeType: 'rect' };
}

interface Mounted {
	root: HTMLElement;
	editor: EditorStateService;
	set: (name: string, value: unknown) => void;
	detect: () => void;
}

/** Render the gallery (classic `@Input`s, so plain `setInput` values bind). */
function mount(mode: 'inline' | 'dropdown'): Mounted {
	TestBed.configureTestingModule({
		imports: [RibbonGalleryComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' }), EditorStateService],
	});
	TestBed.inject(TranslateService).setTranslation('en', translationsEn);
	TestBed.inject(TranslateService).use('en');
	const editor = TestBed.inject(EditorStateService);
	editor.setSlides([{ id: 's1', slideNumber: 1, elements: [shape()] } as PptxSlide]);
	const fixture = TestBed.createComponent(RibbonGalleryComponent);
	const set = (name: string, value: unknown): void => fixture.componentRef.setInput(name, value);
	set('gallery', 'shapeStyles');
	set('mode', mode);
	set('control', 'shapeFormat.shapeStyles.gallery');
	set('element', editor.slides()[0].elements[0]);
	set('slideIndex', 0);
	set('canEdit', true);
	fixture.detectChanges();
	return {
		root: fixture.nativeElement as HTMLElement,
		editor,
		set,
		detect: () => fixture.detectChanges(),
	};
}

function tiles(root: ParentNode): HTMLButtonElement[] {
	return [...root.querySelectorAll<HTMLButtonElement>('[data-gallery-item]')];
}

describe('ribbon gallery (inline mode)', () => {
	it('renders the descriptor strip with aria-pressed from item.applied', () => {
		const { root } = mount('inline');
		const expected = inlineGalleryItems(buildRibbonGallery('shapeStyles', { element: shape() }));
		expect(expected.length).toBeGreaterThan(0);
		const wrapper = root.querySelector('[data-ribbon-control="shapeFormat.shapeStyles.gallery"]');
		expect(wrapper).not.toBeNull();
		const strip = tiles(root);
		expect(strip.map((t) => t.dataset.galleryItem)).toStrictEqual(expected.map((i) => i.id));
		for (const [i, tile] of strip.entries()) {
			expect(tile.getAttribute('aria-pressed')).toBe(String(expected[i].applied));
			expect(tile.innerHTML).toContain('<svg');
			expect(tile.getAttribute('aria-label')).toBeTruthy();
		}
		const more = root.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		expect(more?.getAttribute('aria-label')).toMatch(/^More /u);
	});

	it('opens the popup, applies a pick with undo, closes, and marks it applied', () => {
		const { root, editor, set, detect } = mount('inline');
		root.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]')?.click();
		detect();
		const popup = root.querySelector('[data-ribbon-gallery-popup="shapeStyles"]');
		expect(popup).not.toBeNull();
		const popupTiles = tiles(popup as HTMLElement);
		const all = buildRibbonGallery('shapeStyles', { element: shape() }).sections.flatMap(
			(s) => s.items,
		);
		expect(popupTiles).toHaveLength(all.length);
		const picked = popupTiles[popupTiles.length - 1];
		const pickedId = picked.dataset.galleryItem;
		const before = editor.slides()[0].elements[0];
		picked.click();
		detect();
		expect(root.querySelector('[data-ribbon-gallery-popup]')).toBeNull();
		const after = editor.slides()[0].elements[0];
		expect(after).not.toStrictEqual(before);
		expect(editor.canUndo()).toBeTruthy();
		set('element', after);
		detect();
		root.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]')?.click();
		detect();
		const reopened = root.querySelector(
			`[data-ribbon-gallery-popup] [data-gallery-item="${pickedId}"]`,
		);
		expect(reopened?.getAttribute('aria-pressed')).toBe('true');
	});
});

describe('ribbon gallery (dropdown mode)', () => {
	it('is one trigger that opens the popup and closes on Escape', () => {
		const { root, detect } = mount('dropdown');
		expect(tiles(root)).toHaveLength(0);
		const trigger = root.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		expect(trigger?.disabled).toBeFalsy();
		trigger?.click();
		detect();
		expect(root.querySelector('[data-ribbon-gallery-popup="shapeStyles"]')).not.toBeNull();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		detect();
		expect(root.querySelector('[data-ribbon-gallery-popup]')).toBeNull();
	});

	it('is disabled for a read-only deck or when nothing is selected', () => {
		const { root, set, detect } = mount('dropdown');
		const trigger = (): HTMLButtonElement | null =>
			root.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		set('canEdit', false);
		detect();
		expect(trigger()?.disabled).toBeTruthy();
		set('canEdit', true);
		set('element', null);
		detect();
		expect(trigger()?.disabled).toBeTruthy();
	});
});

describe('dispatchGalleryResult', () => {
	it('routes element patches to updateElement and schemes to the theme path', () => {
		const calls: string[] = [];
		const targets = {
			editor: { updateElement: (i: number, id: string) => calls.push(`el:${i}:${id}`) },
			slideIndex: 2,
			themes: {
				applyThemeVariant: (v: object, name: string) =>
					calls.push(`theme:${Object.keys(v).join()}:${name}`),
			},
		};
		expect(dispatchGalleryResult(null, targets)).toBeFalsy();
		dispatchGalleryResult({ kind: 'element', elementId: 'x', patch: {} }, targets);
		dispatchGalleryResult({ kind: 'themeColorScheme', colorScheme: {}, name: 'Blue' }, targets);
		dispatchGalleryResult({ kind: 'themeFontScheme', fontScheme: {}, name: 'Arial' }, targets);
		expect(calls).toStrictEqual(['el:2:x', 'theme:colorScheme:Blue', 'theme:fontScheme:Arial']);
		expect(
			dispatchGalleryResult(
				{ kind: 'themeFontScheme', fontScheme: {}, name: 'Arial' },
				{ ...targets, themes: null },
			),
		).toBeFalsy();
	});
});
