// @vitest-environment happy-dom
/**
 * React is the binding the show-chrome parity specs diff the other four
 * against, so its bottom bar IS the contract.
 *
 * Two things had gone wrong here and neither was visible to any existing test:
 * the colour carets were named by concatenating an em-dash into the title
 * ("Pen - color"), which is untranslatable and violates the repo's punctuation
 * rule, and nothing pinned the control inventory at all, which is how the other
 * four bindings each ended up with a different bar (Angular six tools and no
 * navigation, Vanilla and Svelte no bar at all). This asserts the rendered
 * order and the accessible names against the shared spec.
 */
import { PRESENT_TOOLBAR_ORDER, toggleBlackboard } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) => {
			const raw = translationsEn[key] ?? key;
			return options
				? raw.replaceAll(/\{\{(?<name>\w+)\}\}/gu, (_, name: string) => options[name] ?? '')
				: raw;
		},
	}),
}));

const { PresentationToolbar } = await import('./PresentationToolbar');

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

/** The toolbar renders inside the shared element's open shadow root. */
const bar = (): ParentNode =>
	container.querySelector('pptx-ui-present-toolbar')?.shadowRoot ?? container;

function renderToolbar(overrides: Record<string, unknown> = {}): void {
	act(() => {
		root.render(
			<PresentationToolbar
				presentationTool='none'
				penColor='#ff0000'
				highlighterColor='#ffff00'
				hasAnnotations={false}
				onSetTool={() => undefined}
				onSetPenColor={() => undefined}
				onSetHighlighterColor={() => undefined}
				onClearAnnotations={() => undefined}
				blackout='none'
				onToggleBlackboard={() => undefined}
				currentSlideIndex={1}
				totalSlides={5}
				onMovePresentationSlide={() => undefined}
				presentationStartTime={null}
				onEndPresentation={() => undefined}
				onTogglePresenterView={() => undefined}
				{...overrides}
			/>,
		);
	});
}

function controlIds(): (string | null)[] {
	return [...bar().querySelectorAll('[data-pptx-present-control]')].map((node) =>
		node.getAttribute('data-pptx-present-control'),
	);
}

function nameOf(id: string): string | null {
	return (
		bar().querySelector(`[data-pptx-present-control="${id}"]`)?.getAttribute('aria-label') ?? null
	);
}

describe('the slide-show toolbar', () => {
	it('renders the shared control inventory in order', () => {
		renderToolbar();
		expect(controlIds()).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
	});

	it('announces itself as a toolbar', () => {
		renderToolbar();
		// The host is the toolbar: it carries the role and the accessible name.
		const toolbar = container.querySelector('[data-pptx-present-toolbar]');
		expect(toolbar?.getAttribute('role')).toBe('toolbar');
		expect(toolbar?.getAttribute('aria-label')).toBe('Presentation toolbar');
	});

	it('names every control from the dictionary, with no punctuation smuggled in', () => {
		renderToolbar();
		expect(nameOf('previous')).toBe('Previous Slide');
		expect(nameOf('next')).toBe('Next Slide');
		expect(nameOf('laser')).toBe('Laser Pointer');
		expect(nameOf('pen')).toBe('Pen');
		expect(nameOf('pen-color')).toBe('Pen colour');
		expect(nameOf('highlighter-color')).toBe('Highlighter colour');
		expect(nameOf('blackboard')).toBe('Blackboard');
		expect(nameOf('clear')).toBe('Clear Annotations');
		expect(nameOf('presenter-view')).toBe('Presenter View');
		expect(nameOf('end')).toBe('End Presentation');
		for (const id of PRESENT_TOOLBAR_ORDER) {
			expect(nameOf(id) ?? '').not.toContain('—');
		}
	});

	it('drops the presenter-view slot when the host cannot open one', () => {
		renderToolbar({ onTogglePresenterView: undefined });
		expect(controlIds()).not.toContain('presenter-view');
	});

	it('disables navigation at the ends of the deck', () => {
		renderToolbar({ currentSlideIndex: 0, totalSlides: 3 });
		expect(
			bar().querySelector<HTMLButtonElement>('[data-pptx-present-control="previous"]')?.disabled,
		).toBeTruthy();

		renderToolbar({ currentSlideIndex: 2, totalSlides: 3 });
		expect(
			bar().querySelector<HTMLButtonElement>('[data-pptx-present-control="next"]')?.disabled,
		).toBeTruthy();
	});

	it('arms the black screen and the pen together from the blackboard toggle', () => {
		const setBlackout = vi.fn<(value: string) => void>();
		const setTool = vi.fn<(tool: string) => void>();
		// Same wiring as ViewerCanvasArea: the click routes through the shared
		// toggle so one press arms both halves of blackboard mode.
		renderToolbar({
			onToggleBlackboard: () => {
				const next = toggleBlackboard('none', 'none');
				setBlackout(next.blackout);
				setTool(next.tool);
			},
		});
		act(() => {
			bar().querySelector<HTMLButtonElement>('[data-pptx-present-control="blackboard"]')?.click();
		});
		expect(setBlackout).toHaveBeenCalledWith('black');
		expect(setTool).toHaveBeenCalledWith('pen');
	});

	it('reads the blackboard toggle as active only when blackout and pen are both armed', () => {
		renderToolbar({ blackout: 'black', presentationTool: 'pen' });
		const active = bar().querySelector('[data-pptx-present-control="blackboard"]');
		expect(active?.getAttribute('aria-pressed')).toBe('true');

		renderToolbar({ blackout: 'black', presentationTool: 'none' });
		const inactive = bar().querySelector('[data-pptx-present-control="blackboard"]');
		expect(inactive?.getAttribute('aria-pressed')).toBe('false');
	});

	it('names each colour swatch with its value', () => {
		renderToolbar();
		act(() => {
			container
				.querySelector<HTMLButtonElement>('[data-pptx-present-control="pen-color"]')
				?.click();
		});
		const swatches = [...bar().querySelectorAll('button[aria-label^="Pen colour #"]')];
		expect(swatches).toHaveLength(8);
	});
});

describe('the slide-show toolbar adapter', () => {
	const click = (id: string): void => {
		act(() => {
			bar().querySelector<HTMLButtonElement>(`[data-pptx-present-control="${id}"]`)?.click();
		});
	};

	it('routes every control to its callback', () => {
		const calls: string[] = [];
		renderToolbar({
			onMovePresentationSlide: (direction: number) => calls.push(`move:${direction}`),
			onSetTool: (tool: string) => calls.push(`tool:${tool}`),
			onClearAnnotations: () => calls.push('clear'),
			onToggleBlackboard: () => calls.push('blackboard'),
			onTogglePresenterView: () => calls.push('presenter-view'),
			onEndPresentation: () => calls.push('end'),
			hasAnnotations: true,
		});
		for (const id of [
			'previous',
			'next',
			'laser',
			'pen',
			'highlighter',
			'eraser',
			'blackboard',
			'clear',
			'presenter-view',
			'end',
		]) {
			click(id);
		}
		expect(calls).toStrictEqual([
			'move:-1',
			'move:1',
			'tool:laser',
			'tool:pen',
			'tool:highlighter',
			'tool:eraser',
			'blackboard',
			'clear',
			'presenter-view',
			'end',
		]);
	});

	it('a swatch pick sets the colour and arms that tool when another is active', () => {
		const calls: string[] = [];
		renderToolbar({
			presentationTool: 'eraser',
			onSetPenColor: (color: string) => calls.push(`pen:${color}`),
			onSetTool: (tool: string) => calls.push(`tool:${tool}`),
		});
		click('pen-color');
		act(() => {
			bar().querySelector<HTMLButtonElement>('button[aria-label="Pen colour #0000ff"]')?.click();
		});
		expect(calls).toStrictEqual(['pen:#0000ff', 'tool:pen']);
	});

	it('shows the elapsed time from the show start time', () => {
		renderToolbar({ presentationStartTime: Date.now() - 125_000 });
		expect(bar().querySelector('[data-pptx-present-control="timer"] span')?.textContent).toBe(
			'02:05',
		);
	});
});
