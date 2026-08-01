import { mount } from '@vue/test-utils';
import {
	createInitialPresentationSnapshot,
	PRESENTER_CONSOLE_CONTROLS,
	PRESENTER_CONSOLE_LABEL_KEYS,
} from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../i18n';
import PresenterControlStrip from './PresenterControlStrip.vue';

/** Control ids in shared order, minus the dividers/spacer that render no button. */
const CONTROL_IDS = PRESENTER_CONSOLE_CONTROLS.filter(
	(control) => control.kind === 'button' || control.kind === 'toggle',
).map((control) => control.id);

function mountStrip(snapshot: Partial<PresentationSnapshot> = {}, audienceOpen = false) {
	return mount(PresenterControlStrip, {
		props: {
			snapshot: { ...createInitialPresentationSnapshot(), ...snapshot },
			audienceOpen,
		},
	});
}

describe('presenterControlStrip', () => {
	it('renders every shared control, in order', () => {
		const wrapper = mountStrip();
		const ids = wrapper
			.findAll('[data-pptx-presenter-control]')
			.map((button) => button.attributes('data-pptx-presenter-control'));
		expect(ids).toStrictEqual(CONTROL_IDS);
		// The shared order puts zoom-in before zoom-out; Vue had them reversed.
		expect(ids.indexOf('zoom-in')).toBeLessThan(ids.indexOf('zoom-out'));
	});

	it('labels every control from the dictionary, never hard-coded English', () => {
		const wrapper = mountStrip();
		const names = wrapper
			.findAll('[data-pptx-presenter-control]')
			.map((button) => button.attributes('aria-label'));
		expect(names).toStrictEqual(PRESENTER_CONSOLE_LABEL_KEYS.map((key) => translationsEn[key]));
		// Titles mirror the accessible names (hover parity with PowerPoint).
		expect(wrapper.find('[data-pptx-presenter-control="zoom-reset"]').attributes('title')).toBe(
			'Reset Zoom',
		);
	});

	it('marks toggles pressed from the snapshot and leaves buttons unpressed', () => {
		const wrapper = mountStrip({
			blackout: 'black',
			pointer: { tool: 'pen', x: 0.5, y: 0.5, color: '#ef4444' },
			subtitlesVisible: true,
		});
		const pressed = (id: string): string | undefined =>
			wrapper.find(`[data-pptx-presenter-control="${id}"]`).attributes('aria-pressed');
		expect(pressed('pen')).toBe('true');
		expect(pressed('laser')).toBe('false');
		expect(pressed('blackout-black')).toBe('true');
		expect(pressed('captions')).toBe('true');
		expect(pressed('timer-reset')).toBeUndefined();
	});

	it('renders the blackout glyphs as text without leaking them into the name', () => {
		const wrapper = mountStrip();
		const black = wrapper.find('[data-pptx-presenter-control="blackout-black"]');
		expect(black.text()).toBe('B');
		expect(black.attributes('aria-label')).toBe('Black Screen');
	});

	it('emits the intent behind each control', async () => {
		const wrapper = mountStrip();
		await wrapper.find('[data-pptx-presenter-control="timer-toggle"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="zoom-in"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="zoom-out"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="all-slides"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="blackout-white"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="pen"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="swap-displays"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="end"]').trigger('click');

		expect(wrapper.emitted('timer')).toHaveLength(1);
		expect(wrapper.emitted('zoom')).toStrictEqual([[1], [-1]]);
		expect(wrapper.emitted('slides')).toHaveLength(1);
		expect(wrapper.emitted('blackout')?.[0]).toStrictEqual(['white']);
		expect(wrapper.emitted('tool')?.[0]).toStrictEqual(['pen']);
		expect(wrapper.emitted('swap-displays')).toHaveLength(1);
		expect(wrapper.emitted('exit')).toHaveLength(1);
	});

	it('toggles an engaged tool or blackout back off', async () => {
		const wrapper = mountStrip({
			blackout: 'black',
			pointer: { tool: 'laser', x: 0.5, y: 0.5, color: '#ef4444' },
		});
		await wrapper.find('[data-pptx-presenter-control="laser"]').trigger('click');
		await wrapper.find('[data-pptx-presenter-control="blackout-black"]').trigger('click');
		expect(wrapper.emitted('tool')?.[0]).toStrictEqual(['none']);
		expect(wrapper.emitted('blackout')?.[0]).toStrictEqual(['none']);
	});

	it('renames the audience control while the audience display is open', () => {
		const closed = mountStrip({}, false);
		const open = mountStrip({}, true);
		expect(closed.find('[data-pptx-presenter-control="audience"]').attributes('aria-label')).toBe(
			'Open Audience Window',
		);
		expect(open.find('[data-pptx-presenter-control="audience"]').attributes('aria-label')).toBe(
			'Close Audience Window',
		);
	});
});
