// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PasteOptionsToolbar } from './PasteOptionsToolbar';

let container: HTMLDivElement;
let root: Root;
let pasted: HTMLElement;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	const viewport = document.createElement('div');
	viewport.setAttribute('data-pptx-viewport', '');
	pasted = document.createElement('div');
	pasted.setAttribute('data-element-id', 'pasted-1');
	pasted.getBoundingClientRect = () => ({ right: 300, bottom: 200 }) as DOMRect;
	viewport.append(pasted);
	document.body.append(viewport);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	document.body.replaceChildren();
});

const strip = () =>
	container.querySelector('pptx-ui-paste-options')?.shadowRoot?.querySelector('[role="toolbar"]');

describe('pasteOptionsToolbar adapter', () => {
	it('renders nothing without a pasted element', () => {
		act(() =>
			root.render(<PasteOptionsToolbar elementId={null} onChoose={vi.fn()} onDismiss={vi.fn()} />),
		);
		expect(container.querySelector('pptx-ui-paste-options')).toBeNull();
	});

	it('anchors the shared strip to the pasted element and routes the chosen format', () => {
		const onChoose = vi.fn();
		act(() =>
			root.render(
				<PasteOptionsToolbar elementId='pasted-1' onChoose={onChoose} onDismiss={vi.fn()} />,
			),
		);
		const host = container.querySelector('pptx-ui-paste-options')!;
		expect(host.hasAttribute('data-pptx-paste-options')).toBeTruthy();
		expect((host as HTMLElement).style.left).toBe('304px');
		expect((host as HTMLElement).style.top).toBe('204px');
		expect(strip()).not.toBeNull();
		const buttons = host.shadowRoot!.querySelectorAll('button');
		expect(buttons).toHaveLength(4);
		act(() => buttons[3].click());
		expect(onChoose).toHaveBeenCalledWith('keep-text-only');
	});

	it('forwards the strip dismissal intent', () => {
		const onDismiss = vi.fn();
		act(() =>
			root.render(
				<PasteOptionsToolbar elementId='pasted-1' onChoose={vi.fn()} onDismiss={onDismiss} />,
			),
		);
		container
			.querySelector('pptx-ui-paste-options')!
			.dispatchEvent(new CustomEvent('paste-options-dismiss'));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
