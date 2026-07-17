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
		expect(container.querySelector('.pptxv-mobile-toolbar')).toBeTruthy();
		expect(container.querySelector('.pptxv-mobile-nav')).toBeNull();
		expect(container.querySelectorAll('.pptxv-mobile-actions > nav > button')).toHaveLength(5);
		expect(container.querySelector('.pptxv-statusbar [aria-label*="Previous"]')).toBeNull();
		const primary = container.querySelector('.pptxv-ribbon-primary');
		expect(primary?.getAttribute('role')).toBeNull();
		// React-aligned quick-access cluster: comments, Present split, "+ Show",
		// inspector toggle, settings, overflow; collab appends broadcast + pill.
		expect(primary?.querySelector('button[aria-label="Comments"]')).toBeTruthy();
		expect(primary?.querySelector('.pptxv-present-split')).toBeTruthy();
		expect(primary?.querySelector('button[aria-label="Toggle inspector panel"]')).toBeTruthy();
		expect(primary?.querySelector('button[aria-label="Settings & Shortcuts"]')).toBeTruthy();
		expect(primary?.querySelector('button[aria-label="More actions"]')).toBeTruthy();
		expect(
			primary?.querySelector('button[aria-label="Broadcast to a live audience"]'),
		).toBeTruthy();
		expect(primary?.querySelector('.pptxv-collab-status')).toBeTruthy();
		// Share and Record live on the tab row's right side, matching React.
		const tabRowActions = container.querySelector('.pptxv-tabrow-actions');
		expect(tabRowActions?.querySelector('button[aria-label="Share"]')).toBeTruthy();
		expect(tabRowActions?.querySelector('button[aria-label="Record"]')).toBeTruthy();
		expect(container.querySelector('[data-pptx-inspector]')?.getAttribute('aria-label')).toBe(
			'Properties',
		);
		expect(container.querySelector('.pptxv-thumbs')?.getAttribute('role')).toBe('navigation');
		expect(container.querySelector('.pptxv-thumbs')?.getAttribute('aria-label')).toBe('Slides');
		expect(container.querySelector('.pptxv-statusbar')?.getAttribute('role')).toBeNull();
		expect(container.querySelector('[aria-label="Save"]')).toBeTruthy();

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

	it('wires the status-bar Notes button to expand/collapse the notes panel', () => {
		const { container } = mount();
		const notesBody = container.querySelector<HTMLElement>('.pptxv-notes-body');
		const notesBtn = container.querySelector<HTMLButtonElement>(
			'.pptxv-statusbar [aria-label="Toggle notes"]',
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

	it('uses the presentation settings and collaboration dialog for ribbon workflows', () => {
		const { viewer } = mount({ editable: true });
		const concrete = viewer as PptxViewer;
		concrete.toggleSubtitles();
		expect(concrete.store.get().presentationProperties.showSubtitles).toBeTruthy();

		concrete.openShare();
		expect(document.querySelector<HTMLElement>('.pptxv-modal-backdrop')?.hidden).toBeFalsy();
		expect(document.querySelector('.pptxv-modal-panel[aria-label="Share"]')).toBeTruthy();
	});
});
