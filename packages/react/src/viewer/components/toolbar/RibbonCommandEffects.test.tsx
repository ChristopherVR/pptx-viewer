// @vitest-environment happy-dom
/**
 * Ribbon controls that rendered with the right label and did the wrong thing
 * (or nothing).
 *
 * `Toolbar.test.tsx` renders to static markup, which proves a control exists;
 * these mount for real and click because callback/unit defects are invisible
 * to a markup assertion. Examples include Design > Slide Size opening the
 * wrong dialog, a font preset emitting the wrong unit, and Transitions >
 * Preview re-committing the slide's existing transition.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { DesignSection } = await import('./DesignTransitionsReviewSection');
const { HomeSection } = await import('./HomeSection');
const { TextSection } = await import('./TextSection');
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

describe('home > font size', () => {
	it('converts a selected point size to model pixels', () => {
		const onUpdateTextStyle = vi.fn();
		act(() => {
			root.render(
				<HomeSection
					canEdit
					clipboardPayload={null}
					onCopy={() => {}}
					onCut={() => {}}
					onPaste={() => {}}
					layoutOptions={[]}
					onInsertSlideFromLayout={() => {}}
					selectedElement={
						{
							type: 'text',
							id: 'font-size',
							x: 0,
							y: 0,
							width: 100,
							height: 20,
							text: 'Hello',
							textStyle: { fontSize: 16 },
						} as import('pptx-viewer-core').PptxElement
					}
					onUpdateTextStyle={onUpdateTextStyle}
				/>,
			);
		});

		const picker = container.querySelector<HTMLButtonElement>(
			'button[aria-label="pptx.ribbon.fontSize"]',
		);
		expect(picker).not.toBeNull();
		act(() => picker!.click());

		const tenPointOption = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent?.trim() === '10',
		);
		expect(tenPointOption).toBeDefined();
		act(() => tenPointOption!.click());

		const patch = onUpdateTextStyle.mock.lastCall?.[0] as { fontSize?: number } | undefined;
		expect(patch?.fontSize).toBeCloseTo(10 * (96 / 72));
	});

	it('keeps point units when the shared callback targets a table cell', () => {
		const onUpdateTextStyle = vi.fn();
		act(() => {
			root.render(
				<HomeSection
					canEdit
					clipboardPayload={null}
					onCopy={() => {}}
					onCut={() => {}}
					onPaste={() => {}}
					layoutOptions={[]}
					onInsertSlideFromLayout={() => {}}
					selectedElement={
						{
							type: 'table',
							id: 'table-cell-font-size',
							x: 0,
							y: 0,
							width: 100,
							height: 40,
							tableData: { rows: [], columnWidths: [] },
						} as import('pptx-viewer-core').PptxElement
					}
					onUpdateTextStyle={onUpdateTextStyle}
				/>,
			);
		});

		act(() =>
			container
				.querySelector<HTMLButtonElement>('button[aria-label="pptx.ribbon.fontSize"]')
				?.click(),
		);
		const tenPointOption = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent?.trim() === '10',
		);
		act(() => tenPointOption?.click());
		expect(onUpdateTextStyle).toHaveBeenCalledWith({ fontSize: 10 });
	});
});

describe('text > font size stepper', () => {
	it('steps ordinary text by two PowerPoint points in model pixels', () => {
		const onUpdateTextStyle = vi.fn();
		act(() => {
			root.render(
				<TextSection
					canEdit
					selectedElement={
						{
							type: 'text',
							id: 'font-size-step',
							x: 0,
							y: 0,
							width: 100,
							height: 20,
							text: 'Hello',
							textStyle: { fontSize: 48.1 * (96 / 72) },
						} as import('pptx-viewer-core').PptxElement
					}
					onUpdateTextStyle={onUpdateTextStyle}
					onTransformTextCase={() => {}}
				/>,
			);
		});
		act(() =>
			container
				.querySelector<HTMLButtonElement>('button[title="pptx.text.increaseFontSize"]')
				?.click(),
		);
		expect(onUpdateTextStyle.mock.lastCall?.[0]?.fontSize).toBeCloseTo(50.1 * (96 / 72));
	});

	it('steps the 18-point fallback in point units when no size is explicit', () => {
		const onUpdateTextStyle = vi.fn();
		act(() => {
			root.render(
				<TextSection
					canEdit
					selectedElement={
						{
							type: 'text',
							id: 'font-size-fallback-step',
							x: 0,
							y: 0,
							width: 100,
							height: 20,
							text: 'Hello',
						} as import('pptx-viewer-core').PptxElement
					}
					onUpdateTextStyle={onUpdateTextStyle}
					onTransformTextCase={() => {}}
				/>,
			);
		});
		act(() =>
			container
				.querySelector<HTMLButtonElement>('button[title="pptx.text.increaseFontSize"]')
				?.click(),
		);
		expect(onUpdateTextStyle.mock.lastCall?.[0]?.fontSize).toBeCloseTo(20 * (96 / 72));
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
