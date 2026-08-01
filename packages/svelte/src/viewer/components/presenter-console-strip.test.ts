/**
 * Guards the presenter console's control strip against the drift it shipped
 * with: every label was a hard-coded English string ("Pause", "All slides",
 * "Zoom -", "Captions", "End"), so the console was untranslatable in every
 * locale, and two slots the shared inventory defines (reset-zoom and
 * swap-displays) were missing outright while the rest sat in a different order.
 *
 * The expectations are read from `pptx-viewer-shared`'s canonical inventory
 * rather than hard-coded here, so a control renamed or reordered in the spec
 * fails this test instead of silently diverging from the other four bindings.
 */
import {
	createInitialPresentationSnapshot,
	PRESENTER_CONSOLE_CONTROLS,
	PRESENTER_CONSOLE_LABEL_KEYS,
	PRESENTER_CONSOLE_ORDER,
} from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { translate } from '../../i18n/translator';
import PresenterConsoleStrip from './PresenterConsoleStrip.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountStrip(snapshot: Partial<PresentationSnapshot> = {}, audienceOpen = false) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const onselect = vi.fn();
	const instance = mount(PresenterConsoleStrip, {
		target,
		props: {
			snapshot: { ...createInitialPresentationSnapshot(0), ...snapshot },
			audienceOpen,
			onselect,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onselect };
}

/**
 * Every query here is scoped to `[data-pptx-presenter-strip]`, never to the
 * document: the console's RAIL emits the same `data-pptx-presenter-control`
 * attribute (all five bindings share one attribute so a framework-neutral spec
 * can use a single selector), so an unscoped sweep would fold `prev` / `next` /
 * the notes font stepper into the strip's inventory and its order.
 */
function strip(target: HTMLElement): HTMLElement {
	const root = target.querySelector<HTMLElement>('[data-pptx-presenter-strip]');
	if (!root) {
		throw new Error('missing presenter console strip root');
	}
	return root;
}

function stripControls(
	target: HTMLElement,
	selector = '[data-pptx-presenter-control]',
): HTMLElement[] {
	return [...strip(target).querySelectorAll<HTMLElement>(selector)];
}

function control(target: HTMLElement, id: string): HTMLElement {
	const el = strip(target).querySelector<HTMLElement>(`[data-pptx-presenter-control="${id}"]`);
	if (!el) {
		throw new Error(`missing presenter control ${id}`);
	}
	return el;
}

describe('presenterConsoleStrip', () => {
	it('renders every inventory slot, in the shared order', () => {
		const { target } = mountStrip();
		const ids = stripControls(target).map((el) => el.getAttribute('data-pptx-presenter-control'));
		expect(ids).toStrictEqual([...PRESENTER_CONSOLE_ORDER]);
		// The two slots the old strip simply did not have.
		expect(ids).toContain('zoom-reset');
		expect(ids).toContain('swap-displays');
	});

	it('labels every control from the dictionary, in order', () => {
		const { target } = mountStrip();
		const labelled = stripControls(target, 'button[data-pptx-presenter-control]');
		const expected = PRESENTER_CONSOLE_LABEL_KEYS.map((key) => translate('en', key));

		expect(labelled.map((el) => el.getAttribute('aria-label'))).toStrictEqual(expected);
		expect(labelled.map((el) => el.getAttribute('title'))).toStrictEqual(expected);

		// The regression: these were the strip's old hard-coded accessible names.
		const raw = labelled.map((el) => el.textContent?.trim());
		expect(raw).not.toContain('Pause');
		expect(raw).not.toContain('All slides');
		expect(raw).not.toContain('Zoom -');
	});

	it('marks toggles with aria-pressed and leaves plain buttons alone', () => {
		const { target } = mountStrip();
		for (const spec of PRESENTER_CONSOLE_CONTROLS) {
			if (spec.kind === 'divider' || spec.kind === 'spacer') {
				continue;
			}
			const pressed = control(target, spec.id).getAttribute('aria-pressed');
			expect(pressed === null).toBe(spec.kind !== 'toggle');
		}
	});

	it('reflects the live snapshot on the stateful toggles', () => {
		const { target } = mountStrip({
			blackout: 'white',
			subtitlesVisible: true,
			pointer: { tool: 'highlighter', x: 0.5, y: 0.5, color: '#ef4444' },
		});
		expect(control(target, 'blackout-white').getAttribute('aria-pressed')).toBe('true');
		expect(control(target, 'blackout-black').getAttribute('aria-pressed')).toBe('false');
		expect(control(target, 'captions').getAttribute('aria-pressed')).toBe('true');
		expect(control(target, 'highlighter').getAttribute('aria-pressed')).toBe('true');
		expect(control(target, 'laser').getAttribute('aria-pressed')).toBe('false');
	});

	it('renders the blackout glyphs as decoration, never as the accessible name', () => {
		const { target } = mountStrip();
		expect(control(target, 'blackout-black').textContent?.trim()).toBe('B');
		expect(control(target, 'blackout-black').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.blackScreen'),
		);
		expect(control(target, 'blackout-white').textContent?.trim()).toBe('W');
		expect(control(target, 'blackout-white').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.whiteScreen'),
		);
	});

	it('renames the audience toggle and enables swap once a display is open', () => {
		const closed = mountStrip();
		expect(control(closed.target, 'audience').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.openAudienceWindow'),
		);
		expect((control(closed.target, 'swap-displays') as HTMLButtonElement).disabled).toBeTruthy();
		cleanup?.();
		cleanup = undefined;

		const open = mountStrip({}, true);
		expect(control(open.target, 'audience').getAttribute('aria-label')).toBe(
			translate('en', 'pptx.presenter.closeAudienceWindow'),
		);
		expect(control(open.target, 'audience').getAttribute('aria-pressed')).toBe('true');
		expect((control(open.target, 'swap-displays') as HTMLButtonElement).disabled).toBeFalsy();
	});

	it('reports the pressed control id to the console', () => {
		const { target, onselect } = mountStrip();
		control(target, 'zoom-reset').click();
		control(target, 'timer-reset').click();
		control(target, 'end').click();
		expect(onselect.mock.calls).toStrictEqual([['zoom-reset'], ['timer-reset'], ['end']]);
	});
});
