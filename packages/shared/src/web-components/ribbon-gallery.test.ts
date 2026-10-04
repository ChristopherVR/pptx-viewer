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

	it('renders its tiles before connection, for hosts that build the ribbon detached', () => {
		const gallery = document.createElement('pptx-ui-ribbon-gallery');
		gallery.setAttribute('mode', 'inline');
		gallery.descriptor = buildRibbonGallery('shapeStyles', {
			element: {
				id: 'shape',
				type: 'shape',
				x: 0,
				y: 0,
				width: 100,
				height: 60,
				shapeType: 'rect',
			},
		});
		expect(gallery.isConnected).toBeFalsy();
		expect(gallery.querySelectorAll('.strip [data-gallery-item]')).toHaveLength(6);
		expect(gallery.querySelector('[data-ribbon-gallery="shapeStyles"]')).toBe(gallery.trigger);
		document.body.append(gallery);
		expect(gallery.querySelectorAll('.strip [data-gallery-item]')).toHaveLength(6);
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

describe('shared ribbon gallery command mode', () => {
	const element = {
		id: 'sa',
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 100,
		height: 60,
		smartArtData: { nodes: [{ id: 'n1', text: 'One' }] },
	} as never;

	it('draws a command without a panel and emits one pick on click', () => {
		const gallery = document.createElement('pptx-ui-ribbon-gallery');
		gallery.descriptor = buildRibbonGallery('smartArtAddShape', { element });
		document.body.append(gallery);
		const pick = vi.fn();
		gallery.addEventListener('gallery-pick', pick);
		expect(gallery.trigger.classList.contains('command')).toBeTruthy();
		expect(gallery.trigger.hasAttribute('aria-haspopup')).toBeFalsy();
		expect(gallery.trigger.textContent).toBe('Add Shape');
		gallery.trigger.click();
		expect(pick).toHaveBeenCalledOnce();
		expect(pick.mock.calls[0][0].detail).toStrictEqual({
			gallery: 'smartArtAddShape',
			itemId: 'run',
		});
		expect(gallery.open).toBeFalsy();
	});

	it('shows an unavailable command disabled, with its reason as the tooltip', () => {
		const gallery = document.createElement('pptx-ui-ribbon-gallery');
		gallery.descriptor = buildRibbonGallery('smartArtPromote', { element });
		document.body.append(gallery);
		const pick = vi.fn();
		gallery.addEventListener('gallery-pick', pick);
		expect(gallery.trigger.disabled).toBeTruthy();
		expect(gallery.trigger.title).toContain('text pane');
		gallery.trigger.click();
		expect(pick).not.toHaveBeenCalled();
	});

	it('marks large commands so the group keeps them out of the small-command stack', () => {
		const gallery = document.createElement('pptx-ui-ribbon-gallery');
		gallery.descriptor = buildRibbonGallery('smartArtResetGraphic', { element });
		document.body.append(gallery);
		expect(gallery.hasAttribute('data-command-large')).toBeTruthy();
		expect(gallery.trigger.classList.contains('command-large')).toBeTruthy();
	});
});
