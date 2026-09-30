// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildRibbonGallery } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

function mount() {
	const gallery = document.createElement('pptx-ui-ribbon-gallery');
	gallery.setAttribute('mode', 'inline');
	gallery.descriptor = buildRibbonGallery('shapeStyles', {
		element: { id: 'shape', type: 'shape', x: 0, y: 0, width: 100, height: 60, shapeType: 'rect' },
	});
	document.body.append(gallery);
	return gallery;
}

describe('shared ribbon gallery', () => {
	it('renders six inline previews and emits one stable intent for a popup pick', () => {
		const gallery = mount();
		const pick = vi.fn();
		gallery.addEventListener('gallery-pick', pick);
		expect(gallery.querySelectorAll('[data-gallery-item]')).toHaveLength(6);
		gallery.trigger.click();
		const item = gallery.popup.querySelector<HTMLButtonElement>('[data-gallery-item]')!;
		const itemId = item.dataset.galleryItem;
		item.click();
		expect(pick).toHaveBeenCalledOnce();
		expect(pick.mock.calls[0][0].detail).toStrictEqual({ gallery: 'shapeStyles', itemId });
		expect(gallery.open).toBeFalsy();
		expect(gallery.contains(gallery.popup)).toBeFalsy();
		expect(document.activeElement).toBe(gallery.trigger);
	});

	it('keeps a focused popup item through a controlled descriptor refresh', () => {
		const gallery = mount();
		gallery.trigger.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
		);
		const itemId = document.activeElement?.getAttribute('data-gallery-item');
		expect(itemId).toBeTruthy();
		gallery.descriptor = { ...gallery.descriptor! };
		expect(gallery.popup.contains(document.activeElement)).toBeTruthy();
		expect(document.activeElement?.getAttribute('data-gallery-item')).toBe(itemId);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(gallery.open).toBeFalsy();
		expect(document.activeElement).toBe(gallery.trigger);
	});

	it('closes on disabled state, refuses picks, and removes stale selection options', () => {
		const gallery = mount();
		const pick = vi.fn();
		gallery.addEventListener('gallery-pick', pick);
		gallery.open = true;
		gallery.disabled = true;
		expect(gallery.open).toBeFalsy();
		gallery.trigger.click();
		expect(gallery.open).toBeFalsy();
		expect(pick).not.toHaveBeenCalled();
		gallery.descriptor = undefined;
		expect(gallery.trigger.disabled).toBeTruthy();
	});

	it('cleans up on disconnect and keeps reconnected and independent instances isolated', () => {
		const first = mount();
		const second = mount();
		first.open = true;
		first.remove();
		expect(first.open).toBeFalsy();
		document.body.append(first);
		first.open = true;
		second.trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(first.open).toBeFalsy();
		second.trigger.click();
		expect(second.open).toBeTruthy();
		expect(first.open).toBeFalsy();
		expect(first.querySelectorAll('.gallery-view')).toHaveLength(1);
		expect(document.querySelectorAll('#pptx-ui-gallery-styles')).toHaveLength(1);
	});
});
