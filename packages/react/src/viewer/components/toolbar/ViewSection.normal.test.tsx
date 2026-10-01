// @vitest-environment happy-dom
/**
 * View tab adapter: the shared `pptx-ui-ribbon-view` owns markup and state
 * reflection; this adapter only routes typed intents to the native handlers.
 */
import { registerPptxWebControls } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ViewSection } from './ViewSection';
import type { ViewSectionProps } from './ViewSection';

registerPptxWebControls();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function baseProps(overrides: Partial<ViewSectionProps> = {}): ViewSectionProps {
	return {
		canEdit: true,
		editTemplateMode: false,
		onSetEditTemplateMode: vi.fn(),
		spellCheckEnabled: false,
		onSetSpellCheckEnabled: vi.fn(),
		showGrid: false,
		showRulers: false,
		showGuides: false,
		snapToGrid: false,
		snapToShape: false,
		onSetShowGrid: vi.fn(),
		onSetShowRulers: vi.fn(),
		onSetShowGuides: vi.fn(),
		onSetSnapToGrid: vi.fn(),
		onSetSnapToShape: vi.fn(),
		onAddGuide: vi.fn(),
		onEnterMasterView: vi.fn(),
		...overrides,
	};
}

function render(overrides: Partial<ViewSectionProps> = {}) {
	act(() => root.render(React.createElement(ViewSection, baseProps(overrides))));
}
function button(id: string): HTMLButtonElement {
	return container
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

describe('viewSection', () => {
	it('routes view commands, including View > Normal, to the native handlers', () => {
		const onGoToNormalView = vi.fn();
		const onOpenReadingView = vi.fn();
		const onZoomToFit = vi.fn();
		render({ onGoToNormalView, onOpenReadingView, onZoomToFit });
		act(() => button('view.presentationViews.normal').click());
		act(() => button('view.presentationViews.readingView').click());
		act(() => button('view.zoom.fitToWindow').click());
		expect(onGoToNormalView).toHaveBeenCalledOnce();
		expect(onOpenReadingView).toHaveBeenCalledOnce();
		expect(onZoomToFit).toHaveBeenCalledOnce();
	});

	it('routes option toggles and guides with the requested value', () => {
		const onSetShowRulers = vi.fn();
		const onSetSnapToShape = vi.fn();
		const onAddGuide = vi.fn();
		render({ onSetShowRulers, onSetSnapToShape, onAddGuide });
		const row = container.querySelector('[data-ribbon-control="view.show.ruler"]')!;
		act(() => (row.shadowRoot!.querySelector('pptx-ui-checkbox') as HTMLElement).click());
		act(() => button('view.show.snapToShape').click());
		const guides = container.querySelectorAll(
			'[data-ribbon-control="view.show.addGuide"] pptx-ui-ribbon-command',
		);
		act(() => (guides[1] as HTMLElement).shadowRoot!.querySelector('button')!.click());
		expect(onSetShowRulers).toHaveBeenCalledExactlyOnceWith(true);
		expect(onSetSnapToShape).toHaveBeenCalledExactlyOnceWith(true);
		expect(onAddGuide).toHaveBeenCalledExactlyOnceWith('v');
	});

	it('reflects controlled and read-only state without invoking edit handlers', () => {
		const onEnterMasterView = vi.fn();
		render({ canEdit: false, onEnterMasterView, snapToShape: true, editTemplateMode: true });
		const master = button('view.masterViews.slideMaster');
		expect(master.disabled).toBeTruthy();
		act(() => master.click());
		expect(onEnterMasterView).not.toHaveBeenCalled();
		expect(button('view.show.snapToShape').getAttribute('aria-pressed')).toBe('true');
		const first = container.querySelector('pptx-ui-ribbon-view');
		render({ canEdit: true, snapToShape: false });
		expect(container.querySelector('pptx-ui-ribbon-view')).toBe(first);
		expect(button('view.masterViews.slideMaster').disabled).toBeFalsy();
	});
});
