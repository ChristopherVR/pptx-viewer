import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MobileChrome from './MobileChrome.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function renderMobileChrome(props: Record<string, unknown> = {}) {
	const handlers = {
		onmenu: vi.fn(),
		onundo: vi.fn(),
		onredo: vi.fn(),
		onsave: vi.fn(),
		onpresent: vi.fn(),
		onshare: vi.fn(),
	};
	const target = document.createElement('div');
	const instance = mount(MobileChrome, {
		target,
		props: { editable: true, canUndo: true, canRedo: true, ...handlers, ...props },
	});
	flushSync();
	cleanup = () => unmount(instance);
	const root = target.querySelector('pptx-ui-mobile-toolbar')!.shadowRoot!;
	/** A control by accessible name; null when the shared element hides it. */
	const control = (name: string): HTMLButtonElement | null => {
		const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
		return button && !button.hidden ? button : null;
	};
	return { control, handlers };
}

describe('mobileChrome hiddenActions', () => {
	it('renders Undo, Redo, Present, and Share when hiddenActions is omitted (backward compatible default)', () => {
		const { control } = renderMobileChrome();

		expect(control('Undo')).not.toBeNull();
		expect(control('Redo')).not.toBeNull();
		expect(control('Present')).not.toBeNull();
		expect(control('Share')).not.toBeNull();
	});

	it('hides Share when "share" is in hiddenActions', () => {
		const { control } = renderMobileChrome({ hiddenActions: ['share'] });

		expect(control('Share')).toBeNull();
	});

	it('hides Undo/Redo individually when listed in hiddenActions', () => {
		const { control } = renderMobileChrome({ hiddenActions: ['undo', 'redo'] });

		expect(control('Undo')).toBeNull();
		expect(control('Redo')).toBeNull();
	});

	it('hides the Present (fullscreen) button when "fullscreen" is in hiddenActions', () => {
		const { control } = renderMobileChrome({ hiddenActions: ['fullscreen'] });

		expect(control('Present')).toBeNull();
	});
});

describe('mobileChrome adapter', () => {
	it('routes each control to its callback', () => {
		const { control, handlers } = renderMobileChrome();
		for (const name of ['Menu', 'Undo', 'Redo', 'Save', 'Present', 'Share']) {
			control(name)!.click();
		}
		for (const handler of Object.values(handlers)) {
			expect(handler).toHaveBeenCalledOnce();
		}
	});

	it('shows the AI toggle only when the host opts in and reflects its pressed state', () => {
		expect(renderMobileChrome().control('Toggle AI assistant')).toBeNull();
		cleanup?.();
		const { control } = renderMobileChrome({ onai: vi.fn(), aiActive: true });
		expect(control('Toggle AI assistant')!.getAttribute('aria-pressed')).toBe('true');
	});

	it('keeps Save and Present but drops the editing controls when not editable', () => {
		const { control } = renderMobileChrome({ editable: false });
		expect(control('Menu')).toBeNull();
		expect(control('Share')).toBeNull();
		expect(control('Save')).not.toBeNull();
		expect(control('Present')).not.toBeNull();
	});
});
