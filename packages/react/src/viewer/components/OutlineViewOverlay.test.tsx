// @vitest-environment happy-dom
/**
 * Outline view, React binding.
 *
 * The outline's rules are proved once in `pptx-viewer-shared/render/outline-view`
 * and `.../outline-view-edit`. What is worth proving here is the glue: that the
 * ribbon control is live, that the pane carries the neutral DOM contract `e2e/`
 * addresses all five viewers through, and above all that a keystroke in a row
 * actually reaches the deck. Every one of those has been the thing that broke in
 * a past parity wave, never the shared maths.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { OUTLINE_LEVEL_ATTR, OUTLINE_ROW_ATTR, OUTLINE_VIEW_ATTR } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => translationsEn[key] ?? key }),
}));

const { OutlineViewOverlay } = await import('./OutlineViewOverlay');
const { ViewSection } = await import('./toolbar/ViewSection');
type ViewSectionProps = import('./toolbar/ViewSection').ViewSectionProps;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function textElement(id: string, partial: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id,
		name: 'Text Box',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: '',
		...partial,
	} as PptxElement;
}

const placeholder = (phType: string): Record<string, unknown> => ({
	'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': phType } } },
});

function deck(): PptxSlide[] {
	return [
		{
			id: 's1',
			rId: '',
			slideNumber: 1,
			elements: [
				textElement('t', { text: 'Agenda', rawXml: placeholder('title') }),
				textElement('b', {
					rawXml: placeholder('body'),
					text: 'First\nSecond',
					textSegments: [
						{ text: 'First', style: {} },
						{ text: '\n', style: {}, isParagraphBreak: true },
						{ text: 'Second', style: {} },
					],
				}),
			],
		},
		// A slide with no text at all: it must still appear, or the outline hides it.
		{ id: 's2', rId: '', slideNumber: 2, elements: [] },
	];
}

// ---------------------------------------------------------------------------
// Ribbon control
// ---------------------------------------------------------------------------

function viewProps(overrides: Partial<ViewSectionProps> = {}): ViewSectionProps {
	return {
		canEdit: true,
		editTemplateMode: false,
		onSetEditTemplateMode: vi.fn(),
		spellCheckEnabled: true,
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
		onOpenOutlineView: vi.fn(),
		...overrides,
	};
}

describe('view tab Outline View control', () => {
	it('renders enabled, next to the other presentation views', () => {
		const html = renderToStaticMarkup(<ViewSection {...viewProps()} />);
		expect(html).toContain('Outline View');
		expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*Outline View/u);
	});
});

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;
let slides: PptxSlide[];
let bumped: number;

function mount(canEdit = true): void {
	const setSlides = (next: PptxSlide[]): void => {
		slides = next;
		render(canEdit);
	};
	function render(edit: boolean): void {
		act(() =>
			root.render(
				<OutlineViewOverlay
					slides={slides}
					canvasSize={{ width: 960, height: 540 }}
					canEdit={edit}
					setSlides={setSlides}
					setActiveSlideIndex={vi.fn()}
					bumpHistory={() => {
						bumped += 1;
					}}
					onClose={vi.fn()}
				/>,
			),
		);
	}
	render(canEdit);
}

function rowInputs(): HTMLInputElement[] {
	return Array.from(container.querySelectorAll<HTMLInputElement>(`[${OUTLINE_ROW_ATTR}]`));
}

function type(input: HTMLInputElement, value: string): void {
	act(() => {
		const setter = Object.getOwnPropertyDescriptor(
			globalThis.HTMLInputElement.prototype,
			'value',
		)?.set;
		setter?.call(input, value);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
}

function press(input: HTMLInputElement, init: KeyboardEventInit): void {
	act(() => {
		input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
	});
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	slides = deck();
	bumped = 0;
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('outline view overlay', () => {
	it('exposes the neutral outline DOM contract', () => {
		mount();
		expect(container.querySelector(`[${OUTLINE_VIEW_ATTR}]`)).toBeTruthy();
		expect(container.innerHTML).toContain('aria-label="Outline View"');
	});

	it('reflects the deck: title, body lines, and the titleless slide', () => {
		mount();
		expect(rowInputs().map((input) => input.value)).toStrictEqual([
			'Agenda',
			'First',
			'Second',
			'',
		]);
		expect(rowInputs().map((input) => input.getAttribute(OUTLINE_LEVEL_ATTR))).toStrictEqual([
			'0',
			'1',
			'1',
			'0',
		]);
	});

	it('an edit reaches the slide', () => {
		mount();
		type(rowInputs()[1], 'Rewritten');
		const body = slides[0].elements.find((element) => element.id === 'b');
		expect((body as { text?: string }).text).toBe('Rewritten\nSecond');
		expect(rowInputs()[1].value).toBe('Rewritten');
		// Undo depends on this: React's history hook skips its deep comparison
		// unless something bumps past the cheap structural hash.
		expect(bumped).toBeGreaterThan(0);
	});

	it('demotes with Tab and promotes with Shift+Tab', () => {
		mount();
		press(rowInputs()[1], { key: 'Tab' });
		expect(rowInputs()[1].getAttribute(OUTLINE_LEVEL_ATTR)).toBe('2');
		press(rowInputs()[1], { key: 'Tab', shiftKey: true });
		expect(rowInputs()[1].getAttribute(OUTLINE_LEVEL_ATTR)).toBe('1');
	});

	it('adds a slide when Enter lands on a title row', () => {
		mount();
		press(rowInputs()[0], { key: 'Enter' });
		expect(slides).toHaveLength(3);
		expect(rowInputs()).toHaveLength(5);
	});

	it('typing into a titleless slide creates its title', () => {
		mount();
		type(rowInputs()[3], 'Brand new');
		expect(slides[1].elements).toHaveLength(1);
		expect(rowInputs()[3].value).toBe('Brand new');
	});

	it('is read-only when the viewer cannot edit', () => {
		mount(false);
		expect(rowInputs().every((input) => input.readOnly)).toBeTruthy();
		press(rowInputs()[1], { key: 'Tab' });
		expect(rowInputs()[1].getAttribute(OUTLINE_LEVEL_ATTR)).toBe('1');
	});
});
