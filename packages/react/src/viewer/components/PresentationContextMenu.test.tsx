// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { PresentationContextMenu } = await import('./PresentationContextMenu');

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

function render(overrides: Partial<React.ComponentProps<typeof PresentationContextMenu>> = {}) {
	const props = {
		state: { x: 5, y: 6 },
		onNext: vi.fn(),
		onPrevious: vi.fn(),
		onEndShow: vi.fn(),
		onClose: vi.fn(),
		...overrides,
	};
	act(() => root.render(<PresentationContextMenu {...props} />));
	return props;
}

const surface = () => container.querySelector('pptx-ui-context-menu')!;
const buttons = () => Array.from(surface().shadowRoot!.querySelectorAll('button'));
const label = (name: string) => buttons().find((b) => b.textContent === name)!;

describe('presentationContextMenu', () => {
	it('carries the presentation marker above every binding overlay', () => {
		render();
		expect(surface().hasAttribute('data-pptx-presentation-menu')).toBeTruthy();
		expect(surface().hasAttribute('data-pptx-context-menu')).toBeFalsy();
		expect(Number(surface().style.zIndex)).toBeGreaterThan(2147483000);
	});

	it('offers only the commands the host wired, in the shared order', () => {
		render();
		expect(buttons().map((b) => b.textContent)).toStrictEqual([
			'pptx.presenter.nextSlide',
			'pptx.presenter.previousSlide',
			'pptx.presenter.endPresentation',
		]);
		act(() => root.unmount());
		root = createRoot(container);
		render({
			onSeeAllSlides: vi.fn(),
			onPointerTool: vi.fn(),
			onEraseInk: vi.fn(),
			onBlank: vi.fn(),
		});
		expect(buttons().map((b) => b.dataset.itemId)).toStrictEqual([
			'next',
			'previous',
			'seeAllSlides',
			'pointerArrow',
			'pointerPen',
			'pointerHighlighter',
			'pointerLaser',
			'eraseInk',
			'blankBlack',
			'blankWhite',
			'endShow',
		]);
	});

	it('runs the action then closes, mapping pointer tools and blank screens', () => {
		const onPointerTool = vi.fn();
		const onBlank = vi.fn();
		const props = render({ onPointerTool, onBlank });
		act(() => label('pptx.presenter.pointerPen').click());
		expect(onPointerTool).toHaveBeenCalledWith('pen');
		act(() => label('pptx.presenter.whiteScreen').click());
		expect(onBlank).toHaveBeenCalledWith('white');
		act(() => label('pptx.presenter.nextSlide').click());
		expect(props.onNext).toHaveBeenCalledOnce();
		expect(props.onClose).toHaveBeenCalledTimes(3);
	});

	it('closes on Escape without exiting the show', () => {
		const props = render();
		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(props.onClose).toHaveBeenCalledOnce();
		expect(props.onEndShow).not.toHaveBeenCalled();
	});
});
