// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlideShowOptions } from './SlideShowOptions';

vi.mock(import('react-i18next'), () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
function render(element: React.ReactElement) {
	act(() => root.render(element));
	return { container, rerender: (next: React.ReactElement) => act(() => root.render(next)) };
}

describe('react Slide Show options adapter', () => {
	it('forwards one patch and reflects new host state without emitting another edit', () => {
		const onChange = vi.fn();
		const view = render(<SlideShowOptions onChange={onChange} />);
		const host = view.container.querySelector('pptx-ui-slide-show-options')!;
		const timings = host.shadowRoot!.querySelectorAll<HTMLElement & { checked: boolean }>(
			'pptx-ui-checkbox',
		)[1];
		act(() => timings.click());
		expect(onChange).toHaveBeenCalledExactlyOnceWith({ advanceMode: 'manual' });
		view.rerender(
			<SlideShowOptions presentationProperties={{ advanceMode: 'manual' }} onChange={onChange} />,
		);
		expect(timings.checked).toBeFalsy();
		expect(onChange).toHaveBeenCalledOnce();
	});

	it('removes the old event listener when its callback changes', () => {
		const old = vi.fn();
		const next = vi.fn();
		const view = render(<SlideShowOptions onChange={old} />);
		view.rerender(<SlideShowOptions onChange={next} />);
		const host = view.container.querySelector('pptx-ui-slide-show-options')!;
		act(() => (host.shadowRoot!.querySelectorAll('pptx-ui-checkbox')[2] as HTMLElement).click());
		expect(old).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledExactlyOnceWith({ showWithNarration: false });
	});
});
