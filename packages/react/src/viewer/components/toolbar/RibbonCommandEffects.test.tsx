// @vitest-environment happy-dom
/**
 * Two ribbon controls that rendered with the right label and did the wrong
 * thing (or nothing).
 *
 * `Toolbar.test.tsx` renders to static markup, which proves a control exists;
 * these mount for real and click, because both defects here were invisible to a
 * markup assertion: Design > Slide Size opened the Document Properties dialog,
 * and Transitions > Preview re-committed the transition the slide already had,
 * which is an edit with nothing to see.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { DesignSection } = await import('./DesignTransitionsReviewSection');
const { TransitionsSection } = await import('./TransitionsSection');
const { TRANSITION_PREVIEW_ATTR } = await import('pptx-viewer-shared');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

/** The button whose `title` is `key`, clicked the way a user would. */
function click(title: string): void {
	const button = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
	if (!button) {
		throw new Error(`no button titled "${title}"`);
	}
	act(() => {
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
}

describe('design > Slide Size', () => {
	it('opens the slide-size surface rather than Document Properties', () => {
		const onOpenSlideSize = vi.fn<() => void>();
		const onOpenDocumentProperties = vi.fn<() => void>();
		act(() => {
			root.render(
				React.createElement(DesignSection, {
					canEdit: true,
					onToggleThemeGallery: vi.fn<() => void>(),
					isThemeGalleryOpen: false,
					onToggleThemeEditor: vi.fn<() => void>(),
					isThemeEditorOpen: false,
					onOpenDocumentProperties,
					onOpenSlideSize,
				}),
			);
		});

		click('pptx.ribbon.slideSizeTitle');

		expect(onOpenSlideSize).toHaveBeenCalledOnce();
		expect(onOpenDocumentProperties).not.toHaveBeenCalled();
	});
});

describe('transitions > Preview', () => {
	it('replays the transition on the stage and writes nothing', () => {
		const onTransitionChange = vi.fn();
		const stage = document.createElement('div');
		stage.setAttribute('aria-roledescription', 'slide');
		document.body.appendChild(stage);
		act(() => {
			root.render(
				React.createElement(TransitionsSection, {
					isInspectorPaneOpen: false,
					onToggleInspector: vi.fn<() => void>(),
					onApplyTransitionToAll: vi.fn<() => void>(),
					onTransitionChange,
					activeSlide: {
						id: 's1',
						elements: [],
						transition: { type: 'push', durationMs: 800 },
					} as unknown as import('pptx-viewer-core').PptxSlide,
				}),
			);
		});

		click('pptx.ribbon.previewTransition');

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		expect(onTransitionChange).not.toHaveBeenCalled();
		stage.remove();
	});
});
