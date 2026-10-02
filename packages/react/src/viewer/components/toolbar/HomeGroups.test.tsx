// @vitest-environment happy-dom
/**
 * Home > Slides, Drawing triggers and Arrange: the shared `pptx-ui-ribbon-home-*`
 * elements render the buttons; this adapter keeps the native popovers, gating
 * and document edits.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArrangeSection } from './ArrangeSection';
import type { ArrangeSectionProps } from './ArrangeSection';
import { DrawingGroup } from './DrawingGroup';
import { SlidesGroup } from './SlidesGroup';

registerPptxWebControls();

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const control = (id: string) =>
	container.querySelector<HTMLElement>(`[data-ribbon-control="${id}"]`)!;
const button = (id: string) =>
	control(id).tagName === 'BUTTON' ? control(id) : control(id).querySelector('button')!;
const part = (name: string) =>
	control('home.arrange.align').querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const shape = { type: 'shape', id: 's', x: 0, y: 0, width: 10, height: 10 } as PptxElement;

function mountArrange(overrides: Partial<ArrangeSectionProps> = {}) {
	const props: ArrangeSectionProps = {
		canEdit: true,
		selectedElement: shape,
		selectedCount: 1,
		selectionGroupable: true,
		onAlignElements: vi.fn<(align: string) => void>(),
		onDistributeElements: vi.fn<(axis: string) => void>(),
		canDistribute: true,
		onFlip: vi.fn<(direction: 'horizontal' | 'vertical') => void>(),
		onMoveLayer: vi.fn<(direction: string) => void>(),
		onMoveLayerToEdge: vi.fn<(direction: string) => void>(),
		onGroupElements: vi.fn<() => void>(),
		onUngroupElement: vi.fn<() => void>(),
		onUpdateElementStyle: vi.fn<() => void>(),
		onDuplicate: vi.fn<() => void>(),
		onDelete: vi.fn<() => void>(),
		...overrides,
	};
	act(() => root.render(<ArrangeSection {...props} />));
	return props;
}

describe('home arrange group', () => {
	it('routes align, distribute, flip, order, duplicate and delete intents', () => {
		const props = mountArrange();
		act(() => part('centerH').click());
		act(() => part('distribute-vertical').click());
		act(() => button('home.arrange.flipVertical').click());
		act(() => button('home.arrange.sendBackward').click());
		act(() => button('home.arrange.bringToFront').click());
		act(() => button('home.arrange.duplicate').click());
		act(() => button('home.arrange.delete').click());
		expect(props.onAlignElements).toHaveBeenCalledWith('center');
		expect(props.onDistributeElements).toHaveBeenCalledWith('vertical');
		expect(props.onFlip).toHaveBeenCalledWith('vertical');
		expect(props.onMoveLayer).toHaveBeenCalledWith('backward');
		expect(props.onMoveLayerToEdge).toHaveBeenCalledWith('front');
		expect(props.onDuplicate).toHaveBeenCalledOnce();
		expect(props.onDelete).toHaveBeenCalledOnce();
	});

	it('disables the strips without a selection and gates Distribute', () => {
		const props = mountArrange({ selectedElement: null, canDistribute: false });
		expect(button('home.arrange.delete').hasAttribute('disabled')).toBeTruthy();
		expect(part('left').hasAttribute('disabled')).toBeTruthy();
		act(() => button('home.arrange.delete').click());
		expect(props.onDelete).not.toHaveBeenCalled();
		mountArrange({ canDistribute: false });
		expect(part('left').hasAttribute('disabled')).toBeFalsy();
		expect(part('distribute-horizontal').hasAttribute('disabled')).toBeTruthy();
	});
});

describe('home slides group', () => {
	const layouts = [
		{ path: '/l1', name: 'Title' },
		{ path: '/l2', name: 'Content' },
	];
	const gallery = (id: string) =>
		control(id).querySelector<HTMLElement>('[data-testid="layout-gallery-menu"]');
	const mountSlides = (canEdit = true, layoutOptions = layouts) => {
		const props = {
			canEdit,
			layoutOptions,
			onInsertSlideFromLayout: vi.fn<(path: string, name?: string) => void>(),
			onInsertSlideFromTemplate: vi.fn<() => void>(),
			onApplyLayout: vi.fn<(path: string) => void>(),
			onResetSlide: vi.fn<() => void>(),
			onAddSection: vi.fn<() => void>(),
		};
		act(() => root.render(<SlidesGroup {...props} />));
		return props;
	};

	it('inserts the first layout from New Slide and runs Reset and Section', () => {
		const props = mountSlides();
		expect(container.querySelectorAll('[data-ribbon-group="home.slides"]')).toHaveLength(1);
		act(() => button('home.slides.newSlide').click());
		expect(props.onInsertSlideFromLayout).toHaveBeenCalledWith('/l1', 'Title');
		act(() => button('home.slides.reset').click());
		act(() => button('home.slides.section').click());
		expect(props.onResetSlide).toHaveBeenCalledOnce();
		expect(props.onAddSection).toHaveBeenCalledOnce();
	});

	it('opens the layout gallery inside the control wrapper and applies a layout', () => {
		const props = mountSlides();
		act(() => button('home.slides.layout').click());
		const menu = gallery('home.slides.layout');
		expect(menu).not.toBeNull();
		expect(button('home.slides.layout').getAttribute('aria-expanded')).toBe('true');
		act(() => menu!.querySelectorAll<HTMLElement>('button')[1].click());
		expect(props.onApplyLayout).toHaveBeenCalledWith('/l2');
		expect(gallery('home.slides.layout')!.hidden).toBeTruthy();
	});

	it('opens the New Slide gallery from the caret and hides it without layouts', () => {
		const props = mountSlides();
		const caret = () =>
			control('home.slides.newSlide').querySelector<HTMLElement>(
				'[data-pptx-chrome="split-caret"]',
			)!;
		act(() => caret().click());
		act(() => gallery('home.slides.newSlide')!.querySelectorAll<HTMLElement>('button')[0].click());
		expect(props.onInsertSlideFromLayout).toHaveBeenCalledWith('/l1', 'Title');
		mountSlides(true, []);
		expect(caret().hidden).toBeTruthy();
		expect(button('home.slides.newSlide').hasAttribute('disabled')).toBeTruthy();
	});

	it('loads previews on open and portals the host artwork into the tiles', async () => {
		const loadLayoutPreviews = vi.fn(() =>
			Promise.resolve([{ path: '/l1', width: 960, height: 540, elements: [], placeholders: [] }]),
		);
		act(() =>
			root.render(
				<SlidesGroup
					canEdit
					layoutOptions={layouts}
					loadLayoutPreviews={loadLayoutPreviews as never}
					onInsertSlideFromLayout={vi.fn()}
				/>,
			),
		);
		expect(loadLayoutPreviews).not.toHaveBeenCalled();
		await act(async () => button('home.slides.layout').click());
		expect(loadLayoutPreviews).toHaveBeenCalledOnce();
		expect(gallery('home.slides.layout')!.querySelectorAll('.thumb .surface')).toHaveLength(2);
	});

	it('hides Slide Templates until a template handler is wired', () => {
		const props = mountSlides();
		expect(control('home.slides.slideTemplates').hidden).toBeFalsy();
		act(() =>
			root.render(
				<SlidesGroup canEdit layoutOptions={layouts} onInsertSlideFromLayout={vi.fn()} />,
			),
		);
		expect(control('home.slides.slideTemplates').hidden).toBeTruthy();
		expect(props.onInsertSlideFromTemplate).not.toHaveBeenCalled();
	});

	it('locks every action in a read-only viewer', () => {
		const props = mountSlides(false);
		for (const id of ['newSlide', 'layout', 'reset', 'section', 'slideTemplates']) {
			expect(button(`home.slides.${id}`).hasAttribute('disabled')).toBeTruthy();
		}
		act(() => button('home.slides.reset').click());
		expect(props.onResetSlide).not.toHaveBeenCalled();
	});
});

describe('home drawing triggers', () => {
	const mountDrawing = (selectedElement: PptxElement | null = shape) => {
		const props = {
			canEdit: true,
			selectedElement,
			newShapeType: 'rect' as never,
			onSetNewShapeType: vi.fn<() => void>(),
			onAddShape: vi.fn<() => void>(),
			onMoveLayer: vi.fn<(direction: string) => void>(),
			onMoveLayerToEdge: vi.fn<(direction: string) => void>(),
			onUpdateElementStyle: vi.fn<(style: object) => void>(),
		};
		act(() => root.render(<DrawingGroup {...props} />));
		return props;
	};

	it('gates Arrange, Fill and Outline on a selection but not Shapes', () => {
		mountDrawing(null);
		expect(button('home.drawing.shapes').hasAttribute('disabled')).toBeFalsy();
		for (const id of ['arrange', 'shapeFill', 'shapeOutline']) {
			expect(button(`home.drawing.${id}`).hasAttribute('disabled')).toBeTruthy();
		}
	});

	it('opens the Arrange menu in its wrapper and moves the layer', () => {
		const props = mountDrawing();
		act(() => button('home.drawing.arrange').click());
		const items =
			control('home.drawing.arrange').querySelectorAll<HTMLElement>('[role="menuitem"]');
		expect(items).toHaveLength(4);
		act(() => items[0].click());
		expect(props.onMoveLayer).toHaveBeenCalledWith('forward');
		act(() => items[3].click());
		expect(props.onMoveLayerToEdge).toHaveBeenCalledWith('back');
		expect(
			control('home.drawing.arrange').querySelector<HTMLElement>('.popup')!.hidden,
		).toBeTruthy();
	});

	it('picks a shape from the shared Shapes menu and adds it', () => {
		const props = mountDrawing();
		act(() => button('home.drawing.shapes').click());
		const rows = control('home.drawing.shapes').querySelectorAll<HTMLElement>('button.item');
		expect(rows).toHaveLength(12);
		act(() => rows[2].click());
		expect(props.onSetNewShapeType).toHaveBeenCalledWith('ellipse');
		expect(props.onAddShape).toHaveBeenCalledOnce();
	});

	it('applies a standard fill colour from the shared swatch popover', () => {
		const props = mountDrawing();
		act(() => button('home.drawing.shapeFill').click());
		const swatch = control('home.drawing.shapeFill').querySelector<HTMLElement>(
			'button[aria-label="Fill colour #c00000"]',
		)!;
		act(() => swatch.click());
		expect(props.onUpdateElementStyle).toHaveBeenCalledWith(
			expect.objectContaining({ fillColor: '#c00000' }),
		);
	});
});
