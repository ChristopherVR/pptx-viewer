import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import ViewSection from './ViewSection.vue';

vi.mock(import('vue-i18n'), () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));
beforeAll(registerPptxWebControls);

function mountViewSection(overrides: Record<string, unknown> = {}) {
	return mount(ViewSection, {
		attachTo: document.body,
		props: {
			canEdit: true,
			editTemplateMode: false,
			onSetEditTemplateMode: vi.fn(),
			spellCheckEnabled: true,
			onSetSpellCheckEnabled: vi.fn(),
			showGrid: false,
			showRulers: false,
			showGuides: true,
			snapToGrid: false,
			snapToShape: false,
			onSetShowGrid: vi.fn(),
			onSetShowRulers: vi.fn(),
			onSetShowGuides: vi.fn(),
			onSetSnapToGrid: vi.fn(),
			onSetSnapToShape: vi.fn(),
			onAddGuide: vi.fn(),
			onEnterMasterView: vi.fn(),
			...overrides,
		},
	});
}
function button(wrapper: ReturnType<typeof mountViewSection>, id: string): HTMLButtonElement {
	return wrapper.element
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector('button')!;
}

describe('view section', () => {
	it('offers live Outline, Reading and Zoom to Fit commands', () => {
		const onOpenOutlineView = vi.fn();
		const onOpenReadingView = vi.fn();
		const onZoomToFit = vi.fn();
		const wrapper = mountViewSection({ onOpenOutlineView, onOpenReadingView, onZoomToFit });
		for (const id of [
			'view.presentationViews.outline',
			'view.presentationViews.readingView',
			'view.zoom.fitToWindow',
		]) {
			expect(button(wrapper, id).disabled).toBeFalsy();
			button(wrapper, id).click();
		}
		expect(onOpenOutlineView).toHaveBeenCalledOnce();
		expect(onOpenReadingView).toHaveBeenCalledOnce();
		expect(onZoomToFit).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('keeps the placeholder master, zoom and window commands disabled', () => {
		const wrapper = mountViewSection();
		for (const id of [
			'view.masterViews.handoutMaster',
			'view.masterViews.notesMaster',
			'view.zoom.zoom',
			'view.window.macros',
		]) {
			expect(button(wrapper, id).disabled).toBeTruthy();
		}
		wrapper.unmount();
	});

	it('binds Snap to shape to its own flag and reflects it as pressed', () => {
		const onSetSnapToShape = vi.fn();
		const wrapper = mountViewSection({ onSetSnapToShape, snapToShape: true });
		expect(button(wrapper, 'view.show.snapToShape').getAttribute('aria-pressed')).toBe('true');
		button(wrapper, 'view.show.snapToShape').click();
		expect(onSetSnapToShape).toHaveBeenCalledExactlyOnceWith(false);
		wrapper.unmount();
	});

	it('drives guide visibility, not snapping, from the Guides toggle', () => {
		const onSetShowGuides = vi.fn();
		const onSetSnapToShape = vi.fn();
		const wrapper = mountViewSection({ showGuides: false, onSetShowGuides, onSetSnapToShape });
		const row = wrapper.element.querySelector('[data-ribbon-control="view.show.guides"]')!;
		(row.shadowRoot!.querySelector('pptx-ui-checkbox') as HTMLElement).click();
		expect(onSetShowGuides).toHaveBeenCalledExactlyOnceWith(true);
		expect(onSetSnapToShape).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('hides Selection and Eyedropper when the host does not wire them and gates read-only edits', () => {
		const onEnterMasterView = vi.fn();
		const wrapper = mountViewSection({ canEdit: false, onEnterMasterView });
		expect(
			wrapper.element
				.querySelector('[data-ribbon-control="view.show.eyedropper"]')!
				.hasAttribute('hidden'),
		).toBeTruthy();
		button(wrapper, 'view.masterViews.slideMaster').click();
		expect(onEnterMasterView).not.toHaveBeenCalled();
		wrapper.unmount();
	});
});
