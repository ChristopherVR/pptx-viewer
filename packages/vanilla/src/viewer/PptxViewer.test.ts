import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPptxViewer, PptxViewer } from './PptxViewer';
import type { PptxViewerInstance } from './types';

let active: PptxViewerInstance[] = [];

function mount(options?: ConstructorParameters<typeof PptxViewer>[1]): {
	container: HTMLElement;
	viewer: PptxViewerInstance;
} {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const viewer = createPptxViewer(container, options);
	active.push(viewer);
	return { container, viewer };
}

afterEach(() => {
	for (const viewer of active) {
		viewer.destroy();
	}
	active = [];
	document.body.replaceChildren();
});

describe('createPptxViewer', () => {
	it('builds the chrome (toolbar, thumbnails, viewport) and injects styles once', () => {
		const { container } = mount();
		expect(container.querySelector('.pptxv')).toBeTruthy();
		expect(container.querySelector('.pptxv-ribbon')).toBeTruthy();
		expect(container.querySelector('.pptxv-thumbs')).toBeTruthy();
		expect(container.querySelector('.pptxv-viewport')).toBeTruthy();

		mount();
		const styleTags = document.querySelectorAll('#pptx-vanilla-viewer-styles');
		expect(styleTags).toHaveLength(1);
	});

	it('honours showToolbar / showThumbnails options', () => {
		const { container } = mount({ showToolbar: false, showThumbnails: false });
		expect(container.querySelector('.pptxv-ribbon')).toBeNull();
		expect(container.querySelector('.pptxv-thumbs')).toBeNull();
		expect(container.querySelector('.pptxv-viewport')).toBeTruthy();
	});

	it('starts empty with the no-slides message and safe navigation', () => {
		const { container, viewer } = mount();
		expect(viewer.getSlideCount()).toBe(0);
		expect(viewer.getCurrentSlide()).toBe(0);
		const empty = container.querySelector<HTMLElement>('.pptxv-empty');
		expect(empty?.hidden).toBeFalsy();
		expect(empty?.textContent).toBe('No slides');

		// Navigation on an empty deck is a no-op, not a crash.
		viewer.next();
		viewer.prev();
		viewer.goToSlide(5);
		expect(viewer.getCurrentSlide()).toBe(0);
	});

	it('applies and replaces theme CSS variables on the root', () => {
		const { container, viewer } = mount({ theme: { colors: { primary: '#ff0000' } } });
		const root = container.querySelector<HTMLElement>('.pptxv');
		expect(root?.style.getPropertyValue('--pptx-primary')).toBe('#ff0000');

		viewer.setTheme({ colors: { background: '#001122' } });
		expect(root?.style.getPropertyValue('--pptx-primary')).toBe('');
		expect(root?.style.getPropertyValue('--pptx-background')).toBe('#001122');

		viewer.setTheme(undefined);
		expect(root?.style.getPropertyValue('--pptx-background')).toBe('');
	});

	it('translates chrome labels through the shared dictionary and setLocale', () => {
		const { container, viewer } = mount({
			locale: 'de',
			messages: { de: { 'pptx.statusBar.noSlides': 'Keine Folien' } },
		});
		expect(container.querySelector('.pptxv-empty')?.textContent).toBe('Keine Folien');

		viewer.setLocale('en');
		expect(container.querySelector('.pptxv-empty')?.textContent).toBe('No slides');
	});

	it('clamps setZoom and reports the effective scale', () => {
		const { viewer } = mount();
		viewer.setZoom(2);
		expect(viewer.getZoom()).toBe(2);
		viewer.setZoom(99);
		expect(viewer.getZoom()).toBe(8);
		viewer.setZoom(0.0001);
		expect(viewer.getZoom()).toBe(0.1);
	});

	it('fires onZoomChange with the new scale', () => {
		const onZoomChange = vi.fn();
		const { viewer } = mount({ onZoomChange });
		viewer.setZoom(1.5);
		expect(onZoomChange).toHaveBeenCalledWith(1.5);
	});

	it('surfaces load errors through onError and the error overlay', async () => {
		const onError = vi.fn();
		const { container, viewer } = mount({ onError });
		await viewer.loadFile(new ArrayBuffer(4));
		expect(onError).toHaveBeenCalledOnce();
		const overlay = container.querySelector<HTMLElement>('.pptxv-error');
		expect(overlay?.hidden).toBeFalsy();
		expect(container.querySelector('.pptxv-error-message')?.textContent).toBeTruthy();
	});

	it('exposes the registry and a null handler before any load', () => {
		const { viewer } = mount();
		expect(viewer.getHandler()).toBeNull();
		expect(viewer.getRegistry().has('text')).toBeTruthy();
	});

	it('destroy removes the chrome and is idempotent', () => {
		const { container, viewer } = mount();
		viewer.destroy();
		expect(container.querySelector('.pptxv')).toBeNull();
		viewer.destroy();
	});

	it('wires the toolbar Notes button to expand/collapse the notes panel', () => {
		const { container } = mount();
		const notesBody = container.querySelector<HTMLElement>('.pptxv-notes-body');
		const notesBtn = container.querySelector<HTMLButtonElement>(
			'.pptxv-ribbon [aria-label="Toggle notes"]',
		);
		expect(notesBody?.hidden).toBeTruthy();
		expect(notesBtn?.getAttribute('aria-pressed')).toBe('false');

		notesBtn?.click();
		expect(notesBody?.hidden).toBeFalsy();
		expect(notesBtn?.getAttribute('aria-pressed')).toBe('true');

		// The panel's own header toggle also flips the same, shared state.
		container.querySelector<HTMLButtonElement>('.pptxv-notes-header')?.click();
		expect(notesBody?.hidden).toBeTruthy();
	});

	it('renders view-only notes as readonly and editable notes as writable', () => {
		const { container: viewOnly } = mount();
		const viewOnlyTextarea = viewOnly.querySelector<HTMLTextAreaElement>('.pptxv-notes-textarea');
		expect(viewOnlyTextarea?.readOnly).toBeTruthy();

		const { container: editable } = mount({ editable: true });
		const editableTextarea = editable.querySelector<HTMLTextAreaElement>('.pptxv-notes-textarea');
		expect(editableTextarea?.readOnly).toBeFalsy();
	});
});
