import type { PptxElement, PptxSlide, PptxThemeColorScheme } from 'pptx-viewer-core';
import type { RibbonGalleryApplyResult, RibbonGalleryContext } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createGalleryActions } from '../../../editor/editor-gallery-actions';
import { createTranslator } from '../../../i18n';
import { createInitialViewerState, createStore } from '../../../state';
import { createRibbonGalleryHub } from './gallery-hub';
import { createRibbonGallery } from './ribbon-gallery';

const colorMap = { dk1: '#000000', lt1: '#FFFFFF', accent1: '#156082', accent2: '#E97132' };

function shape(): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#FF0000', fillMode: 'solid' },
		textSegments: [{ text: 'Hi', style: { color: '#000000' } }],
	} as unknown as PptxElement;
}

function context(element: PptxElement | null): RibbonGalleryContext {
	return { element, themeColorMap: colorMap };
}

describe('ribbon gallery (vanilla)', () => {
	it('renders dropdown tiles from the descriptor with the DOM contract', () => {
		const t = createTranslator();
		const hub = createRibbonGalleryHub(vi.fn());
		const gallery = createRibbonGallery(
			document,
			t,
			{ gallery: 'shapeStyles', control: 'home.drawing.quickStyles', mode: 'dropdown' },
			hub,
		);
		hub.sync(context(shape()), true);
		expect(gallery.el.getAttribute('data-ribbon-control')).toBe('home.drawing.quickStyles');
		expect(gallery.trigger.getAttribute('data-ribbon-gallery')).toBe('shapeStyles');
		expect(gallery.popup.getAttribute('data-ribbon-gallery-popup')).toBe('shapeStyles');
		// The panel's tiles are built when it opens, not on every selection sync.
		expect(gallery.popup.querySelectorAll('[data-gallery-item]')).toHaveLength(0);
		// ... and it is only in the DOM while open, like the other bindings' popups.
		expect(gallery.el.contains(gallery.popup)).toBeFalsy();
		gallery.trigger.click();
		expect(gallery.el.contains(gallery.popup)).toBeTruthy();
		const tiles = gallery.popup.querySelectorAll('[data-gallery-item]');
		expect(tiles.length).toBeGreaterThan(6);
		expect(tiles[0].querySelector('svg')).not.toBeNull();
		expect(tiles[0].getAttribute('aria-label')).toBe('Colored Outline - Dark 1');
		expect(gallery.popup.querySelectorAll('.pptxv-gallery-heading')).toHaveLength(2);
		expect(gallery.trigger.disabled).toBeFalsy();
	});

	it('is disabled with no selection or when not editable', () => {
		const t = createTranslator();
		const hub = createRibbonGalleryHub(vi.fn());
		const gallery = createRibbonGallery(
			document,
			t,
			{ gallery: 'shapeStyles', control: 'home.drawing.quickStyles', mode: 'dropdown' },
			hub,
		);
		hub.sync(context(null), true);
		expect(gallery.trigger.disabled).toBeTruthy();
		hub.sync(context(shape()), false);
		expect(gallery.trigger.disabled).toBeTruthy();
		gallery.trigger.click();
		expect(gallery.isOpen()).toBeFalsy();
	});

	it('reflects the applied entry as aria-pressed', () => {
		const t = createTranslator();
		const dispatched: RibbonGalleryApplyResult[] = [];
		const hub = createRibbonGalleryHub((result) => dispatched.push(result));
		const gallery = createRibbonGallery(
			document,
			t,
			{ gallery: 'shapeStyles', control: 'shapeFormat.shapeStyles.gallery', mode: 'inline' },
			hub,
		);
		hub.sync(context(shape()), true);
		const first = gallery.el.querySelector<HTMLButtonElement>('[data-gallery-item]')!;
		first.click();
		const result = dispatched[0];
		expect(result.kind).toBe('element');
		if (result.kind !== 'element') {
			return;
		}
		const styled = { ...shape(), ...result.patch } as PptxElement;
		hub.sync(context(styled), true);
		const pressed = gallery.el.querySelector(`[data-gallery-item="${first.dataset.galleryItem}"]`);
		expect(pressed?.getAttribute('aria-pressed')).toBe('true');
	});

	it('renders an inline strip plus a "more" trigger and opens / closes the popup', () => {
		const t = createTranslator();
		const hub = createRibbonGalleryHub(vi.fn());
		const gallery = createRibbonGallery(
			document,
			t,
			{ gallery: 'shapeStyles', control: 'shapeFormat.shapeStyles.gallery', mode: 'inline' },
			hub,
		);
		document.body.appendChild(gallery.el);
		hub.sync(context(shape()), true);
		expect(gallery.el.getAttribute('data-ribbon-control')).toBe('shapeFormat.shapeStyles.gallery');
		expect(gallery.el.querySelectorAll('.pptxv-gallery-strip [data-gallery-item]')).toHaveLength(6);
		expect(gallery.trigger.getAttribute('aria-label')).toBe('More Shape Styles');
		gallery.trigger.click();
		expect(gallery.isOpen()).toBeTruthy();
		gallery.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(gallery.isOpen()).toBeFalsy();
		gallery.trigger.click();
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(gallery.isOpen()).toBeFalsy();
		gallery.el.remove();
	});

	it('dispatches a tile pick as an undoable element patch through the update path', () => {
		const t = createTranslator();
		const slide = { id: 'slide1', rId: 'r1', slideNumber: 1, elements: [shape()] };
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [slide as unknown as PptxSlide],
			selectedElementId: 's1',
			selectedElementIds: ['s1'],
		});
		const ops = { pushHistory: vi.fn(), commitChange: vi.fn() };
		const actions = createGalleryActions({ store, ops, deck: { applyThemeEdit: vi.fn() } });
		const hub = createRibbonGalleryHub((result) => actions.applyRibbonGalleryResult(result));
		const gallery = createRibbonGallery(
			document,
			t,
			{ gallery: 'shapeStyles', control: 'home.drawing.quickStyles', mode: 'dropdown' },
			hub,
		);
		hub.sync(context(shape()), true);
		gallery.trigger.click();
		gallery.popup.querySelector<HTMLButtonElement>('[data-gallery-item]')!.click();
		expect(ops.pushHistory).toHaveBeenCalledOnce();
		expect(ops.commitChange).toHaveBeenCalledOnce();
		expect(gallery.isOpen()).toBeFalsy();
		const updated = store.get().slides[0].elements[0];
		expect(updated).not.toBe(slide.elements[0]);
		expect(updated.id).toBe('s1');
	});

	it('routes theme scheme picks to the theme editing path', () => {
		const store = createStore({ ...createInitialViewerState(), editable: true });
		const applyThemeEdit = vi.fn();
		const actions = createGalleryActions({
			store,
			ops: { pushHistory: vi.fn(), commitChange: vi.fn() },
			deck: { applyThemeEdit },
		});
		const colorScheme = { ...colorMap } as unknown as PptxThemeColorScheme;
		actions.applyRibbonGalleryResult({ kind: 'themeColorScheme', colorScheme, name: 'Blue' });
		expect(applyThemeEdit).toHaveBeenCalledWith({ colorScheme, fontScheme: {}, name: 'Blue' });
	});
});
