// @vitest-environment happy-dom
/**
 * Reachability coverage for the inspector panels.
 *
 * WHY this file renders `InspectorPane` rather than the panels themselves:
 * `SlideTransitionSection` and `Text3DProperties` both had passing unit tests
 * while being reachable from NOTHING in the live tree, because those tests
 * rendered the component in isolation. An isolated render proves a component
 * works; only mounting the real inspector root proves a user can get to it.
 * Every assertion here therefore starts from `InspectorPane` and walks down.
 */
import type { PptxElement, PptxSlide, ShapeStyle, TextStyle } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InspectorPaneProps } from './inspector/inspector-pane-types';
import { InspectorPane } from './InspectorPane';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
	}),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const textElement: PptxElement = {
	id: 'text-1',
	type: 'text',
	x: 10,
	y: 20,
	width: 200,
	height: 80,
	text: 'Hello',
	textStyle: { fontSize: 18, color: '#000000' },
} as PptxElement;

const slide: PptxSlide = {
	id: 'slide-1',
	elements: [textElement],
} as PptxSlide;

interface Handlers {
	onUpdateSlide: (updates: Partial<PptxSlide>) => void;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

function props(selectedElement: PptxElement | null, handlers: Handlers): InspectorPaneProps {
	return {
		isOpen: true,
		canEdit: true,
		mode: 'edit',
		activeSlide: slide,
		slides: [slide],
		canvasSize: { width: 1280, height: 720 },
		selectedElement,
		selectedElementIds: selectedElement ? [selectedElement.id] : [],
		activeTab: 'properties',
		onSetActiveTab: vi.fn(),
		onClose: vi.fn(),
		onUpdateElementStyle: handlers.onUpdateElementStyle,
		onUpdateTextStyle: handlers.onUpdateTextStyle,
		onUpdateElement: handlers.onUpdateElement,
		onUpdateSlide: handlers.onUpdateSlide,
		onSelectElement: vi.fn(),
		onMoveLayer: vi.fn(),
		onMoveLayerToEdge: vi.fn(),
		onDeleteElement: vi.fn(),
		presentationProperties: {},
		onUpdatePresentationProperties: vi.fn(),
		customProperties: [],
		themeOptions: [],
		onUpdateCoreProperties: vi.fn(),
		onUpdateAppProperties: vi.fn(),
		onUpdateCustomProperties: vi.fn(),
		onApplyTheme: vi.fn(),
		comments: [],
		commentDraft: '',
		editingCommentId: null,
		commentEditDraft: '',
		onSetCommentDraft: vi.fn(),
		onAddComment: vi.fn(),
		onDeleteComment: vi.fn(),
		onStartEditComment: vi.fn(),
		onSaveEditComment: vi.fn(),
		onCancelEditComment: vi.fn(),
		onSetCommentEditDraft: vi.fn(),
		onUpdateCanvasSize: vi.fn(),
	};
}

function noopHandlers(): Handlers {
	return {
		onUpdateSlide: vi.fn(),
		onUpdateTextStyle: vi.fn(),
		onUpdateElementStyle: vi.fn(),
		onUpdateElement: vi.fn(),
	};
}

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

function render(
	selectedElement: PptxElement | null,
	handlers: Handlers,
	overrides: Partial<InspectorPaneProps> = {},
): void {
	act(() => {
		root.render(<InspectorPane {...props(selectedElement, handlers)} {...overrides} />);
	});
}

/**
 * React tracks the DOM value of a controlled input, so a plain assignment is
 * swallowed: go through the prototype setter and fire the native event.
 */
function typeInto(input: HTMLInputElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
	act(() => {
		setter?.call(input, value);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
}

function pick(select: HTMLSelectElement, value: string): void {
	act(() => {
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	});
}

// ---------------------------------------------------------------------------
// Slide transition
// ---------------------------------------------------------------------------

describe('slide transition is reachable from the live inspector', () => {
	it('renders the transition card in the no-selection properties pane', () => {
		render(null, noopHandlers());

		expect(container.querySelector('[data-pptx-slide-transition]')).not.toBeNull();
	});

	it('commits a chosen transition type onto the active slide', () => {
		const handlers = noopHandlers();
		render(null, handlers);
		const card = container.querySelector('[data-pptx-slide-transition]') as HTMLElement;
		const typeSelect = card.querySelector('select') as HTMLSelectElement;

		act(() => {
			typeSelect.value = 'fade';
			typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
		});

		expect(handlers.onUpdateSlide).toHaveBeenCalledWith({ transition: { type: 'fade' } });
	});

	it('merges a duration change onto an already authored transition', () => {
		const handlers = noopHandlers();
		act(() => {
			root.render(
				<InspectorPane
					{...props(null, handlers)}
					activeSlide={
						{
							...slide,
							transition: { type: 'wipe', direction: 'l', durationMs: 500 },
						} as PptxSlide
					}
				/>,
			);
		});
		const card = container.querySelector('[data-pptx-slide-transition]') as HTMLElement;
		const duration = card.querySelector('input[type="number"]') as HTMLInputElement;

		// React tracks the DOM value, so a plain assignment is swallowed: go
		// through the prototype setter and fire the native `input` event.
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		act(() => {
			setter?.call(duration, '900');
			duration.dispatchEvent(new Event('input', { bubbles: true }));
		});

		// The authored direction survives: the edit is a merge, not a replace.
		expect(handlers.onUpdateSlide).toHaveBeenCalledWith({
			transition: { type: 'wipe', direction: 'l', durationMs: 900 },
		});
	});

	it('is hidden while an element is selected (that pane shows the element)', () => {
		render(textElement, noopHandlers());

		expect(container.querySelector('[data-pptx-slide-transition]')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 3D text
// ---------------------------------------------------------------------------

describe('3D text panel is reachable from the live inspector', () => {
	it('renders for a text-capable selection', () => {
		render(textElement, noopHandlers());

		expect(container.querySelector('[data-pptx-text-3d]')).not.toBeNull();
	});

	it('seeds a visible extrusion depth when the checkbox is ticked', () => {
		const handlers = noopHandlers();
		render(textElement, handlers);
		const panel = container.querySelector('[data-pptx-text-3d]') as HTMLElement;
		const toggle = panel.querySelector('input[type="checkbox"]') as HTMLInputElement;

		act(() => {
			toggle.click();
		});

		// 6pt seeded by the shared `toggleText3dExtrusion`, stored in EMU.
		expect(handlers.onUpdateTextStyle).toHaveBeenCalledWith({
			text3d: { extrusionHeight: 6 * 12700 },
		});
	});

	it('is absent for a selection with no text body', () => {
		render(
			{
				id: 'pic-1',
				type: 'image',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			} as PptxElement,
			noopHandlers(),
		);

		expect(container.querySelector('[data-pptx-text-3d]')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Fill & stroke
// ---------------------------------------------------------------------------

describe('image crop is reachable from the live inspector', () => {
	it('renders the crop sliders inside the image properties card', () => {
		render(
			{
				id: 'img-1',
				type: 'image',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				imageData: 'data:image/png;base64,AAAA',
			} as PptxElement,
			noopHandlers(),
		);
		const crop = container.querySelector('[data-pptx-image-crop]');

		expect(crop).not.toBeNull();
		expect(crop?.querySelectorAll('input[type="range"]')).toHaveLength(4);
	});
});

// ---------------------------------------------------------------------------
// Connector arrows
// ---------------------------------------------------------------------------

describe('connector arrow sizing is reachable from the live inspector', () => {
	it('offers head style plus width and length for both ends', () => {
		const handlers = noopHandlers();
		render(
			{
				id: 'conn-1',
				type: 'connector',
				x: 0,
				y: 0,
				width: 100,
				height: 10,
				shapeStyle: {},
			} as PptxElement,
			handlers,
		);
		// 2 ends x (arrow, width, length) = 6 dropdowns.
		const selects = Array.from(container.querySelectorAll('select')).filter(
			(s) => s.closest('[data-pptx-fill-stroke]') === null,
		);

		expect(selects.length).toBeGreaterThanOrEqual(6);
	});
});

// ---------------------------------------------------------------------------
// Fill & stroke
// ---------------------------------------------------------------------------

describe('full fill/stroke panel is reachable from the live inspector', () => {
	it('offers the fill MODE selector for a shape selection', () => {
		render(
			{
				id: 'shape-1',
				type: 'shape',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
				shapeType: 'rect',
				shapeStyle: { fillColor: '#3b82f6' },
			} as PptxElement,
			noopHandlers(),
		);
		const card = container.querySelector('[data-pptx-fill-stroke]') as HTMLElement;
		const modes = Array.from(card.querySelectorAll('option')).map((o) => o.getAttribute('value'));

		expect(modes).toContain('gradient');
		expect(modes).toContain('pattern');
	});
});

// ---------------------------------------------------------------------------
// Action settings
// ---------------------------------------------------------------------------

const shapeA: PptxElement = {
	id: 'shape-a',
	type: 'shape',
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	shapeType: 'rect',
} as PptxElement;

const shapeB: PptxElement = { ...shapeA, id: 'shape-b' } as PptxElement;

function clickTrigger(): HTMLElement {
	const card = container.querySelector('[data-pptx-action-settings]') as HTMLElement;
	return card.querySelector('[data-pptx-action-trigger="click"]') as HTMLElement;
}

describe('action settings is reachable from the live inspector', () => {
	it('reveals the URL field as soon as "Go to URL" is picked', () => {
		const handlers = noopHandlers();
		render(shapeA, handlers);
		pick(clickTrigger().querySelector('select') as HTMLSelectElement, 'url');

		expect(clickTrigger().querySelector('input[type="text"]')).not.toBeNull();
	});

	it('writes no empty action for a target-less pick', () => {
		const handlers = noopHandlers();
		render(shapeA, handlers);
		pick(clickTrigger().querySelector('select') as HTMLSelectElement, 'url');

		// `url` with no URL serialises to `{}`, which parses straight back as
		// "no action": committing it would dirty the deck for nothing.
		expect(handlers.onUpdateElement).not.toHaveBeenCalled();
	});

	it('commits the typed URL onto the element', () => {
		const handlers = noopHandlers();
		render(shapeA, handlers);
		pick(clickTrigger().querySelector('select') as HTMLSelectElement, 'url');
		typeInto(
			clickTrigger().querySelector('input[type="text"]') as HTMLInputElement,
			'https://a.io',
		);

		expect(handlers.onUpdateElement).toHaveBeenCalledWith({
			actionClick: { url: 'https://a.io' },
		});
	});

	it('commits a target-free type immediately', () => {
		const handlers = noopHandlers();
		render(shapeA, handlers);
		pick(clickTrigger().querySelector('select') as HTMLSelectElement, 'nextSlide');

		expect(handlers.onUpdateElement).toHaveBeenCalledWith({
			actionClick: { action: 'ppaction://hlinkshowjump?jump=nextslide' },
		});
	});

	it('does not carry a half-made pick across to another element', () => {
		const handlers = noopHandlers();
		render(shapeA, handlers);
		pick(clickTrigger().querySelector('select') as HTMLSelectElement, 'url');
		render(shapeB, handlers, { selectedElementIds: [shapeB.id] });
		const select = clickTrigger().querySelector('select') as HTMLSelectElement;

		expect(select.value).toBe('none');
		expect(clickTrigger().querySelector('input[type="text"]')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Elements tab
// ---------------------------------------------------------------------------

// The live shell (`ViewerInspector`) renders nothing for this tab unless
// something is selected, so every case here selects first, the way a user
// reaches the tab.
describe('the elements tab is reachable from the live inspector', () => {
	it('lists the active slide layers with a visibility toggle', () => {
		render(textElement, noopHandlers(), { activeTab: 'elements' });
		const tab = container.querySelector('[data-pptx-elements-tab]');

		expect(tab).not.toBeNull();
		expect(tab?.querySelectorAll('[data-pptx-element-visibility]')).toHaveLength(1);
	});

	it('hides an element through the slide patch channel without selecting it', () => {
		const handlers = noopHandlers();
		const onSelectElement = vi.fn();
		render(textElement, handlers, { activeTab: 'elements', onSelectElement });
		const eye = container.querySelector(
			'[data-pptx-element-visibility="text-1"]',
		) as HTMLButtonElement;

		act(() => {
			eye.click();
		});

		expect(handlers.onUpdateSlide).toHaveBeenCalledWith({
			elements: [{ ...textElement, hidden: true }],
		});
		// The eye stops propagation: toggling visibility is not a selection.
		expect(onSelectElement).not.toHaveBeenCalled();
	});

	it('leaves the toggle disabled when editing is off', () => {
		render(textElement, noopHandlers(), { activeTab: 'elements', canEdit: false });
		const eye = container.querySelector(
			'[data-pptx-element-visibility="text-1"]',
		) as HTMLButtonElement;

		expect(eye.disabled).toBeTruthy();
	});
});
