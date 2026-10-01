/**
 * Home > Clipboard is the shared `pptx-ui-ribbon-home-clipboard` strip: the Vue
 * adapter reflects state into it and maps its single intent onto the handlers.
 */
import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import ClipboardGroup from './ClipboardGroup.vue';

registerPptxWebControls();

function mountGroup(overrides: Record<string, unknown> = {}) {
	const handlers = {
		onCopy: vi.fn<() => void>(),
		onCut: vi.fn<() => void>(),
		onPaste: vi.fn<() => void>(),
		onToggleFormatPainter: vi.fn<() => void>(),
	};
	const wrapper = mount(ClipboardGroup, {
		props: {
			canEdit: true,
			hasSelection: true,
			canActivateFormatPainter: true,
			clipboardPayload: { elements: [] } as never,
			...handlers,
			...overrides,
		},
	});
	const button = (id: string) =>
		wrapper.element.querySelector<HTMLButtonElement>(
			`[data-ribbon-control="home.clipboard.${id}"]`,
		)!;
	return { wrapper, handlers, button };
}

describe('clipboardGroup', () => {
	it('routes each button to its native handler once', () => {
		const { wrapper, handlers, button } = mountGroup();
		for (const id of ['paste', 'cut', 'copy', 'formatPainter']) {
			button(id).click();
		}
		expect(handlers.onPaste).toHaveBeenCalledOnce();
		expect(handlers.onCut).toHaveBeenCalledOnce();
		expect(handlers.onCopy).toHaveBeenCalledOnce();
		expect(handlers.onToggleFormatPainter).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('gates actions on selection, clipboard, edit rights and painter availability', async () => {
		const { wrapper, handlers, button } = mountGroup({
			hasSelection: false,
			clipboardPayload: null,
		});
		const disabled = () => ['paste', 'cut', 'copy'].map((id) => button(id).disabled);
		expect(disabled()).toStrictEqual([true, true, true]);
		button('copy').click();
		expect(handlers.onCopy).not.toHaveBeenCalled();
		await wrapper.setProps({
			hasSelection: true,
			canEdit: false,
			clipboardPayload: { elements: [] },
		});
		expect(disabled()).toStrictEqual([true, true, false]);
		await wrapper.setProps({ canEdit: true, canActivateFormatPainter: false });
		expect(button('formatPainter').disabled).toBeTruthy();
		await wrapper.setProps({ formatPainterActive: true });
		expect(button('formatPainter').disabled).toBeFalsy();
		expect(button('formatPainter').dataset.active).toBe('true');
		await wrapper.setProps({ onToggleFormatPainter: undefined });
		expect(button('formatPainter').hidden).toBeTruthy();
		wrapper.unmount();
	});
});
