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
import { registerPptxWebControls } from 'pptx-viewer-shared';
import type { PptxUiSelectElement } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { DesignSection } = await import('./DesignTransitionsReviewSection');
const { TextSection } = await import('./TextSection');
const { TransitionsSection } = await import('./TransitionsSection');
const { TRANSITION_PREVIEW_ATTR } = await import('pptx-viewer-shared');

registerPptxWebControls();

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
	const button =
		container.querySelector<HTMLButtonElement>(`button[title="${title}"]`) ??
		container
			.querySelector(`pptx-ui-ribbon-command[title="${title}"]`)
			?.shadowRoot?.querySelector<HTMLButtonElement>('button');
	if (!button) {
		throw new Error(`no button titled "${title}"`);
	}
	act(() => {
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
}

function fontPicker(control: 'fontFamily' | 'fontSize') {
	const host = container.querySelector<PptxUiSelectElement>(
		`pptx-ui-select[data-ribbon-control="home.font.${control}"]`,
	)!;
	return {
		host,
		trigger: host.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!,
		popup: host.shadowRoot!.querySelector<HTMLElement>('[role="listbox"]')!,
	};
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
	it.each([
		['fontFamily', 'deselection'],
		['fontFamily', 'read-only mode'],
		['fontSize', 'deselection'],
		['fontSize', 'read-only mode'],
	] as const)('closes %s on %s and re-enables without reopening', async (control, reason) => {
		const props: import('./TextSection').TextSectionProps = {
			canEdit: true,
			onToggleBullets: vi.fn(),
			onTransformTextCase: vi.fn(),
			selectedElement: {
				type: 'text',
				id: 'text',
				x: 0,
				y: 0,
				width: 100,
				height: 20,
				text: 'Hello',
			},
			onUpdateTextStyle: vi.fn(),
		};
		const render = async (enabled: boolean) =>
			act(async () =>
				root.render(
					<TextSection
						{...props}
						canEdit={reason === 'read-only mode' ? enabled : true}
						selectedElement={reason === 'deselection' && !enabled ? null : props.selectedElement}
					/>,
				),
			);
		await render(true);
		const { host, trigger: picker } = fontPicker(control);
		await act(async () => picker.click());
		expect(host.hasAttribute('open')).toBeTruthy();

		await render(false);
		expect(picker.disabled).toBeTruthy();
		expect(host.hasAttribute('open')).toBeFalsy();
		expect(picker.getAttribute('aria-expanded')).toBe('false');
		expect(props.onUpdateTextStyle).not.toHaveBeenCalled();

		await render(true);
		expect(picker.disabled).toBeFalsy();
		expect(host.hasAttribute('open')).toBeFalsy();
		await act(async () => picker.click());
		expect(host.hasAttribute('open')).toBeTruthy();
	});

	it('converts a selected point size to model pixels', async () => {
		const onUpdateTextStyle = vi.fn();
		await act(async () => {
			root.render(
				<TextSection
					canEdit
					onToggleBullets={() => {}}
					onTransformTextCase={() => {}}
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

		const picker = fontPicker('fontSize');
		await act(async () => picker.trigger.click());

		const tenPointOption = [
			...picker.popup.querySelectorAll<HTMLButtonElement>('[role="option"]'),
		].find((button) => button.textContent?.trim() === '10');
		expect(tenPointOption).toBeDefined();
		await act(async () => tenPointOption!.click());

		const patch = onUpdateTextStyle.mock.lastCall?.[0] as { fontSize?: number } | undefined;
		expect(patch?.fontSize).toBeCloseTo(10 * (96 / 72));
	});

	it('keeps point units when the shared callback targets a table cell', async () => {
		const onUpdateTextStyle = vi.fn();
		await act(async () => {
			root.render(
				<TextSection
					canEdit
					onToggleBullets={() => {}}
					onTransformTextCase={() => {}}
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
					tableEditorState={{ rowIndex: 0, columnIndex: 0 }}
					onUpdateTextStyle={onUpdateTextStyle}
				/>,
			);
		});

		const picker = fontPicker('fontSize');
		await act(async () => picker.trigger.click());
		const tenPointOption = [
			...picker.popup.querySelectorAll<HTMLButtonElement>('[role="option"]'),
		].find((button) => button.textContent?.trim() === '10');
		await act(async () => tenPointOption?.click());
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
					onToggleBullets={() => {}}
				/>,
			);
		});
		act(() =>
			container
				.querySelector<HTMLButtonElement>('[data-ribbon-control="home.font.increaseFontSize"]')
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
					onToggleBullets={() => {}}
				/>,
			);
		});
		act(() =>
			container
				.querySelector<HTMLButtonElement>('[data-ribbon-control="home.font.increaseFontSize"]')
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

		click('Preview transition');

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		expect(onTransitionChange).not.toHaveBeenCalled();
		stage.remove();
	});
});
