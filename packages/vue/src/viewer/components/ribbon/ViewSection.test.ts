import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ViewSection from './ViewSection.vue';

vi.mock(import('vue-i18n'), () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

function mountViewSection(overrides: Record<string, unknown> = {}) {
	return mount(ViewSection, {
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

describe('view section', () => {
	it('shows and runs zoom to fit when wired by the ribbon host', async () => {
		const onZoomToFit = vi.fn();
		const wrapper = mountViewSection({ onZoomToFit });

		await wrapper.get('[title="pptx.view.zoomToFitTooltip"]').trigger('click');

		expect(onZoomToFit).toHaveBeenCalledOnce();
	});

	it('offers the master, zoom and window commands the reference offers', () => {
		const wrapper = mountViewSection();
		const labels = wrapper.findAll('button').map((b) => b.text());
		for (const key of [
			'pptx.master.handoutMasterTitle',
			'pptx.master.notesMasterTitle',
			'pptx.slideSorter.zoom',
			'pptx.view.macros',
		]) {
			expect(labels).toContain(key);
		}
	});

	/**
	 * Reading View stays inert because no binding has a reading-view mode; that
	 * one is copied from the reference deliberately. Snap to shape is NOT in
	 * that category any more: it used to be a permanently disabled placeholder
	 * next to a Guides checkbox that secretly drove shape snapping, so the tab
	 * carried a label naming a feature that lived on a different control.
	 */
	it('renders Reading View inert, as the reference does', () => {
		const wrapper = mountViewSection();
		const inert = wrapper
			.findAll('button')
			.filter((b) => b.attributes('disabled') !== undefined)
			.map((b) => b.text());
		expect(inert).toContain('pptx.view.readingView');
	});

	it('offers Snap to shape as a live toggle bound to the snapping flag', async () => {
		const onSetSnapToShape = vi.fn();
		const wrapper = mountViewSection({ onSetSnapToShape });
		const snap = wrapper.findAll('button').find((b) => b.text() === 'pptx.view.snapToShape');

		expect(snap?.attributes('disabled')).toBeUndefined();
		expect(snap?.attributes('aria-pressed')).toBe('false');
		await snap?.trigger('click');
		expect(onSetSnapToShape).toHaveBeenCalledWith(true);
	});

	it('reflects the snapping flag on the Snap to shape control', () => {
		const wrapper = mountViewSection({ snapToShape: true });
		const snap = wrapper.findAll('button').find((b) => b.text() === 'pptx.view.snapToShape');
		expect(snap?.attributes('aria-pressed')).toBe('true');
	});

	/**
	 * Guides now controls guide VISIBILITY, nothing else. The regression this
	 * guards is the old cross-wiring, where ticking Guides silently turned on
	 * shape snapping instead.
	 */
	it('drives guide visibility, not snapping, from the Guides toggle', async () => {
		const onSetShowGuides = vi.fn();
		const onSetSnapToShape = vi.fn();
		const wrapper = mountViewSection({ showGuides: false, onSetShowGuides, onSetSnapToShape });
		const guides = wrapper.findAll('label').find((l) => l.text() === 'pptx.view.guides');

		await guides?.find('input').setValue(true);

		expect(onSetShowGuides).toHaveBeenCalledWith(true);
		expect(onSetSnapToShape).not.toHaveBeenCalled();
	});
});
