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

type Wrapper = ReturnType<typeof mountStrip>;

/** The strip renders inside the shared element's open shadow root. */
const shadow = (wrapper: Wrapper): ShadowRoot => (wrapper.element as HTMLElement).shadowRoot!;
const control = (wrapper: Wrapper, id: string): HTMLButtonElement | null =>
	shadow(wrapper).querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`);
const buttons = (wrapper: Wrapper): HTMLButtonElement[] => [
	...shadow(wrapper).querySelectorAll<HTMLButtonElement>('button[data-pptx-presenter-control]'),
];

describe('presenterControlStrip', () => {
	it('renders every shared control, in order', () => {
		const ids = buttons(mountStrip()).map((button) => button.dataset.pptxPresenterControl);
		expect(ids).toStrictEqual(CONTROL_IDS);
		// The shared order puts zoom-in before zoom-out; Vue had them reversed.
		expect(ids.indexOf('zoom-in')).toBeLessThan(ids.indexOf('zoom-out'));
	});

	it('labels every control from the dictionary, never hard-coded English', () => {
		const wrapper = mountStrip();
		expect(wrapper.element.hasAttribute('data-pptx-presenter-toolbar')).toBeTruthy();
		const names = buttons(wrapper).map((button) => button.getAttribute('aria-label'));
		expect(names).toStrictEqual(PRESENTER_CONSOLE_LABEL_KEYS.map((key) => translationsEn[key]));
		// Titles mirror the accessible names (hover parity with PowerPoint).
		expect(control(wrapper, 'zoom-reset')?.title).toBe('Reset Zoom');
	});

	it('marks toggles pressed from the snapshot and leaves buttons unpressed', () => {
		const wrapper = mountStrip({
			blackout: 'black',
			pointer: { tool: 'pen', x: 0.5, y: 0.5, color: '#ef4444' },
			subtitlesVisible: true,
		});
		const pressed = (id: string): string | null | undefined =>
			control(wrapper, id)?.getAttribute('aria-pressed');
		expect(pressed('pen')).toBe('true');
		expect(pressed('laser')).toBe('false');
		expect(pressed('blackout-black')).toBe('true');
		expect(pressed('captions')).toBe('true');
		expect(pressed('timer-reset')).toBeNull();
	});

	it('renders the blackout glyphs as text without leaking them into the name', () => {
		const black = control(mountStrip(), 'blackout-black');
		expect(black?.textContent).toBe('B');
		expect(black?.getAttribute('aria-label')).toBe('Black Screen');
	});

	it('emits the intent behind each control', () => {
		const wrapper = mountStrip();
		for (const id of [
			'timer-toggle',
			'zoom-in',
			'zoom-out',
			'all-slides',
			'blackout-white',
			'pen',
			'end',
		]) {
			control(wrapper, id)?.click();
		}
		// Swap displays stays disabled while the audience window is closed.
		control(wrapper, 'swap-displays')?.click();

		expect(wrapper.emitted('timer')).toHaveLength(1);
		expect(wrapper.emitted('zoom')).toStrictEqual([[1], [-1]]);
		expect(wrapper.emitted('slides')).toHaveLength(1);
		expect(wrapper.emitted('blackout')?.[0]).toStrictEqual(['white']);
		expect(wrapper.emitted('tool')?.[0]).toStrictEqual(['pen']);
		expect(wrapper.emitted('swap-displays')).toBeUndefined();
		expect(wrapper.emitted('exit')).toHaveLength(1);
		const open = mountStrip({}, true);
		control(open, 'swap-displays')?.click();
		expect(open.emitted('swap-displays')).toHaveLength(1);
	});

	it('toggles an engaged tool or blackout back off', () => {
		const wrapper = mountStrip({
			blackout: 'black',
			pointer: { tool: 'laser', x: 0.5, y: 0.5, color: '#ef4444' },
		});
		control(wrapper, 'laser')?.click();
		control(wrapper, 'blackout-black')?.click();
		expect(wrapper.emitted('tool')?.[0]).toStrictEqual(['none']);
		expect(wrapper.emitted('blackout')?.[0]).toStrictEqual(['none']);
	});

	it('renames the audience control while the audience display is open', () => {
		expect(control(mountStrip({}, false), 'audience')?.getAttribute('aria-label')).toBe(
			'Open Audience Window',
		);
		expect(control(mountStrip({}, true), 'audience')?.getAttribute('aria-label')).toBe(
			'Close Audience Window',
		);
	});
});
