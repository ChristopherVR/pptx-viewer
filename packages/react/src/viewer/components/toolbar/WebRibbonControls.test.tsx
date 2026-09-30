// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { WebRibbonCommand, WebRibbonGroup, WebRibbonToggle } from './WebRibbonControls';

describe('react shared ribbon adapters', () => {
	it('reflects host state and replaces native listeners without duplicate command requests', () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		const container = document.createElement('div');
		document.body.append(container);
		const root = createRoot(container);
		const old = vi.fn();
		const next = vi.fn();
		const toggle = vi.fn();
		const render = (callback: typeof old, checked: boolean) =>
			act(() =>
				root.render(
					<WebRibbonGroup label='Options'>
						<WebRibbonCommand
							controlId='slideShow.setUp.hideSlide'
							label='Hide Slide'
							icon='eye-off'
							pressed={checked}
							onCommand={callback}
						/>
						<WebRibbonToggle
							controlId='slideShow.captions.subtitles'
							label='Subtitles'
							checked={checked}
							onToggle={toggle}
						/>
					</WebRibbonGroup>,
				),
			);
		try {
			render(old, false);
			render(next, true);
			const button = container
				.querySelector('pptx-ui-ribbon-command')!
				.shadowRoot!.querySelector('button')!;
			expect(button.getAttribute('aria-pressed')).toBe('true');
			act(() => button.click());
			expect(old).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledExactlyOnceWith('slideShow.setUp.hideSlide');
			const caption = container.querySelector('pptx-ui-ribbon-toggle')!;
			act(() => caption.shadowRoot!.querySelector('label')!.click());
			expect(toggle).toHaveBeenCalledExactlyOnceWith(false);
		} finally {
			act(() => root.unmount());
			container.remove();
			globalThis.IS_REACT_ACT_ENVIRONMENT = false;
		}
	});

	it('isolates StrictMode mounts and removes native listeners on unmount/remount', () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		const firstTarget = document.createElement('div');
		const secondTarget = document.createElement('div');
		document.body.append(firstTarget, secondTarget);
		const firstRoot = createRoot(firstTarget);
		const secondRoot = createRoot(secondTarget);
		const old = vi.fn();
		const next = vi.fn();
		const other = vi.fn();
		const command = (callback: typeof old) => (
			<React.StrictMode>
				<WebRibbonCommand
					controlId='slideShow.setUp.hideSlide'
					label='Hide Slide'
					icon='eye-off'
					onCommand={callback}
				/>
			</React.StrictMode>
		);
		const button = (target: HTMLElement) =>
			target.querySelector('pptx-ui-ribbon-command')!.shadowRoot!.querySelector('button')!;
		try {
			act(() => {
				firstRoot.render(command(old));
				secondRoot.render(command(other));
			});
			const detachedButton = button(firstTarget);
			act(() => firstRoot.render(null));
			act(() => detachedButton.click());
			expect(old).not.toHaveBeenCalled();
			act(() => firstRoot.render(command(next)));
			act(() => button(firstTarget).click());
			expect(next).toHaveBeenCalledOnce();
			expect(other).not.toHaveBeenCalled();
			act(() => button(secondTarget).click());
			expect(other).toHaveBeenCalledOnce();
		} finally {
			act(() => {
				firstRoot.unmount();
				secondRoot.unmount();
			});
			firstTarget.remove();
			secondTarget.remove();
			globalThis.IS_REACT_ACT_ENVIRONMENT = false;
		}
	});
});
