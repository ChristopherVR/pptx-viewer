import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import MobileMenuSheet from './MobileMenuSheet.vue';
import MobileToolbar from './MobileToolbar.vue';
import { createRibbonPropsFixture } from './ribbon/ribbon-props-fixture';

/**
 * MobileToolbar: the compact mobile top bar (menu / undo / redo / save /
 * present / share), rendered by the shared `pptx-ui-mobile-toolbar`. Covers the
 * `hiddenActions` gating added for issue #64: Share/Undo/Redo each map to their
 * own `ToolbarActionId` and hide independently, mirroring desktop's `TitleBar` +
 * `TabRowActions`. Also covers the mobile AI entry point: with `aiEnabled` the
 * Sparkles toggle must sit directly in the top bar (not buried inside the menu
 * sheet) so the assistant is reachable on a phone in one tap.
 */
const AI_TOGGLE = 'Toggle AI assistant';

type Wrapper = ReturnType<typeof mount>;

/** A control by accessible name inside the element's open shadow root; null when hidden. */
function control(wrapper: Wrapper, name: string): HTMLButtonElement | null {
	const host = wrapper.element.querySelector('pptx-ui-mobile-toolbar') as HTMLElement;
	const button = host.shadowRoot?.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
	return button && !button.hidden ? button : null;
}

describe('mobileToolbar', () => {
	it('renders Undo, Redo, and Share by default (hiddenActions omitted)', () => {
		const wrapper = mount(MobileToolbar, { props: createRibbonPropsFixture() });
		expect(control(wrapper, 'Undo')).not.toBeNull();
		expect(control(wrapper, 'Redo')).not.toBeNull();
		expect(control(wrapper, 'Share')).not.toBeNull();
	});

	it('hides Share when "share" is in hiddenActions', () => {
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['share'] }),
		});
		expect(control(wrapper, 'Share')).toBeNull();
		expect(control(wrapper, 'Undo')).not.toBeNull();
	});

	it('hides Undo and Redo independently via hiddenActions', () => {
		const undoHidden = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['undo'] }),
		});
		expect(control(undoHidden, 'Undo')).toBeNull();
		expect(control(undoHidden, 'Redo')).not.toBeNull();

		const redoHidden = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ hiddenActions: ['redo'] }),
		});
		expect(control(redoHidden, 'Undo')).not.toBeNull();
		expect(control(redoHidden, 'Redo')).toBeNull();
	});

	it('renders the AI toggle directly in the top bar (outside the menu sheet) when aiEnabled', () => {
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ aiEnabled: true, mode: 'edit' }),
		});
		expect(control(wrapper, AI_TOGGLE)).not.toBeNull();
		// One tap must reach it: it must NOT live inside the collapsed menu sheet.
		expect(
			wrapper.findComponent(MobileMenuSheet).find(`button[aria-label="${AI_TOGGLE}"]`).exists(),
		).toBeFalsy();
	});

	it('omits the AI toggle when the host has not enabled AI', () => {
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ aiEnabled: false }),
		});
		expect(control(wrapper, AI_TOGGLE)).toBeNull();
	});

	it('routes an AI toggle tap to onToggleAiPanel', () => {
		const onToggleAiPanel = vi.fn();
		const wrapper = mount(MobileToolbar, {
			props: createRibbonPropsFixture({ aiEnabled: true, onToggleAiPanel }),
		});
		control(wrapper, AI_TOGGLE)!.click();
		expect(onToggleAiPanel).toHaveBeenCalledOnce();
	});

	it('routes Undo, Redo, Save, Present and Share to their handlers', () => {
		const props = createRibbonPropsFixture({
			onUndo: vi.fn(),
			onRedo: vi.fn(),
			onSaveAsPptx: vi.fn(),
			onSetMode: vi.fn(),
			onOpenShareDialog: vi.fn(),
			canUndo: true,
			canRedo: true,
		});
		const wrapper = mount(MobileToolbar, { props });
		for (const name of ['Undo', 'Redo', 'Save', 'Present', 'Share']) {
			control(wrapper, name)!.click();
		}
		expect(props.onUndo).toHaveBeenCalledOnce();
		expect(props.onRedo).toHaveBeenCalledOnce();
		expect(props.onSaveAsPptx).toHaveBeenCalledOnce();
		expect(props.onSetMode).toHaveBeenCalledWith('present');
		expect(props.onOpenShareDialog).toHaveBeenCalledOnce();
	});
});
