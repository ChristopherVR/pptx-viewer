// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AfterAnimationRow } from './AfterAnimationRow';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

describe('afterAnimationRow', () => {
	it('defaults to "none" and hides the colour swatch', () => {
		act(() => {
			root.render(
				<AfterAnimationRow
					action='none'
					color={undefined}
					canEdit
					onActionChange={() => undefined}
					onColorChange={() => undefined}
				/>,
			);
		});
		expect(container.querySelector('select')!.value).toBe('none');
		expect(container.querySelector('input[type="color"]')).toBeNull();
	});

	it('shows the colour swatch only when dimToColor is selected', () => {
		act(() => {
			root.render(
				<AfterAnimationRow
					action='dimToColor'
					color='#ff0000'
					canEdit
					onActionChange={() => undefined}
					onColorChange={() => undefined}
				/>,
			);
		});
		const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
		expect(colorInput).not.toBeNull();
		expect(colorInput.value.toLowerCase()).toBe('#ff0000');
	});

	it('calls onActionChange with the selected value', () => {
		const onActionChange = vi.fn();
		act(() => {
			root.render(
				<AfterAnimationRow
					action='none'
					color={undefined}
					canEdit
					onActionChange={onActionChange}
					onColorChange={() => undefined}
				/>,
			);
		});
		const select = container.querySelector('select')!;
		act(() => {
			select.value = 'hideOnNextClick';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onActionChange).toHaveBeenCalledWith('hideOnNextClick');
	});

	it('calls onColorChange when the swatch changes', () => {
		const onColorChange = vi.fn();
		act(() => {
			root.render(
				<AfterAnimationRow
					action='dimToColor'
					color='#000000'
					canEdit
					onActionChange={() => undefined}
					onColorChange={onColorChange}
				/>,
			);
		});
		const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
		act(() => {
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set as (
				v: string,
			) => void;
			setter.call(colorInput, '#00ff00');
			colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onColorChange).toHaveBeenCalledWith('#00ff00');
	});

	it('disables both controls when canEdit is false', () => {
		act(() => {
			root.render(
				<AfterAnimationRow
					action='dimToColor'
					color='#000000'
					canEdit={false}
					onActionChange={() => undefined}
					onColorChange={() => undefined}
				/>,
			);
		});
		expect(container.querySelector('select')!.hasAttribute('disabled')).toBeTruthy();
		expect(
			(container.querySelector('input[type="color"]') as HTMLInputElement).disabled,
		).toBeTruthy();
	});
});
