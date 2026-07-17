import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExportUiState } from '../export/export-ui.svelte';
import type { ViewerToolbarProps } from './props';
import ViewerToolbar from './ViewerToolbar.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const stubExportUi = { exporting: false } as unknown as ExportUiState;

function renderToolbar(props: Partial<ViewerToolbarProps>) {
	const target = document.createElement('div');
	const instance = mount(ViewerToolbar, {
		target,
		props: {
			current: 0,
			total: 3,
			zoomPercent: 100,
			isFullscreen: false,
			onprev: vi.fn(),
			onnext: vi.fn(),
			onzoomin: vi.fn(),
			onzoomout: vi.fn(),
			onzoomfit: vi.fn(),
			onfullscreen: vi.fn(),
			showNotes: true,
			onshare: vi.fn(),
			onbroadcast: vi.fn(),
			exportUi: stubExportUi,
			...props,
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

describe('viewerToolbar hiddenActions', () => {
	it('renders every action when hiddenActions is omitted (backward compatible default)', () => {
		const target = renderToolbar({});

		expect(target.querySelector('[aria-label="Previous slide"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Next slide"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Zoom out"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-toolbar-share')).not.toBeNull();
		expect(target.querySelector('[aria-label="Broadcast Slide Show"]')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-toolbar-notes')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-export')).not.toBeNull();
		expect(target.querySelector('[aria-pressed]')).not.toBeNull();
	});

	it('hides the Share button when "share" is in hiddenActions, keeping Broadcast', () => {
		const target = renderToolbar({ hiddenActions: ['share'] });

		expect(target.querySelector('.pptx-svelte-toolbar-share')).toBeNull();
		expect(target.querySelector('[aria-label="Broadcast Slide Show"]')).not.toBeNull();
	});

	it('hides the Broadcast button when "broadcast" is in hiddenActions, keeping Share', () => {
		const target = renderToolbar({ hiddenActions: ['broadcast'] });

		expect(target.querySelector('[aria-label="Broadcast Slide Show"]')).toBeNull();
		expect(target.querySelector('.pptx-svelte-toolbar-share')).not.toBeNull();
	});

	it('hides the export menu when "export" is in hiddenActions', () => {
		const target = renderToolbar({ hiddenActions: ['export'] });

		expect(target.querySelector('.pptx-svelte-export')).toBeNull();
	});

	it('hides the notes toggle when "notes" is in hiddenActions', () => {
		const target = renderToolbar({ hiddenActions: ['notes'] });

		expect(target.querySelector('.pptx-svelte-toolbar-notes')).toBeNull();
	});

	it('hides the whole zoom cluster (out/fit/in) when "zoom" is in hiddenActions, keeping fullscreen', () => {
		const target = renderToolbar({ hiddenActions: ['zoom'] });

		expect(target.querySelector('[aria-label="Zoom out"]')).toBeNull();
		expect(target.querySelector('[aria-label="Zoom in"]')).toBeNull();
		expect(target.querySelector('.pptx-svelte-toolbar-zoom')).toBeNull();
		expect(target.querySelector('button[aria-label="Slide show"]')).not.toBeNull();
	});

	it('hides the whole navigation cluster (prev/counter/next) when "navigation" is in hiddenActions', () => {
		const target = renderToolbar({ hiddenActions: ['navigation'] });

		expect(target.querySelector('[aria-label="Previous slide"]')).toBeNull();
		expect(target.querySelector('[aria-label="Next slide"]')).toBeNull();
		expect(target.querySelector('.pptx-svelte-toolbar-counter')).toBeNull();
	});

	it('hides the fullscreen toggle when "fullscreen" is in hiddenActions', () => {
		const target = renderToolbar({ hiddenActions: ['fullscreen'] });

		expect(target.querySelector('button[aria-label="Slide show"]')).toBeNull();
	});

	it('still requires the onshare callback: hiddenActions alone does not add a Share button', () => {
		const target = renderToolbar({ onshare: undefined, hiddenActions: [] });

		expect(target.querySelector('.pptx-svelte-toolbar-share')).toBeNull();
	});
});
