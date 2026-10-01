import type { PptxSlideTransition } from 'pptx-viewer-core';
import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import {
	EFFECT_SOUND_CATALOGUE,
	EMPTY_RIBBON_TRANSITION_DRAFT,
	TRANSITION_PREVIEW_ATTR,
} from 'pptx-viewer-shared';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonTransitionHandlers } from '../ribbon-types';
import { createTransitionsTab } from './transitions-tab';

const STOCK_IDS = EFFECT_SOUND_CATALOGUE.map((entry) => entry.id);

/** The tab's handler bag: a (mutable) draft source plus a spy on the commit. */
function makeHandlers(
	initial: RibbonTransitionDraft = { ...EMPTY_RIBBON_TRANSITION_DRAFT },
	initialTransition?: PptxSlideTransition,
): RibbonTransitionHandlers & {
	applyDraft: Mock<(draft: RibbonTransitionDraft, applyToAll: boolean) => void>;
	applyChange: Mock<(changes: Partial<PptxSlideTransition>) => void>;
	/** Stand in for the user navigating to a slide with another transition. */
	setDraft(next: RibbonTransitionDraft): void;
	/** Stand in for the deck's active-slide transition changing (sound fields). */
	setTransition(next: PptxSlideTransition | undefined): void;
} {
	let draft = initial;
	let transition = initialTransition;
	return {
		readDraft: () => draft,
		applyDraft: vi.fn<(draft: RibbonTransitionDraft, applyToAll: boolean) => void>(),
		readTransition: () => transition,
		applyChange: vi.fn<(changes: Partial<PptxSlideTransition>) => void>(),
		setDraft(next) {
			draft = next;
		},
		setTransition(next) {
			transition = next;
		},
	};
}

/** Poll until `predicate` is true, rather than hoping a fixed delay covers
 * the FileReader read (its completion time is not guaranteed under load). */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met before deadline');
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

function mount(handlers = makeHandlers(), onToggleInspector = vi.fn<() => void>()) {
	const t = createTranslator();
	const tab = createTransitionsTab(document, t, handlers, onToggleInspector);
	const q = <E extends HTMLElement>(selector: string) => tab.el.querySelector<E>(selector)!;
	const command = (id: string) =>
		tab.el.querySelector(`[data-ribbon-control="${id}"]`)!.shadowRoot!.querySelector('button')!;
	const preset = (type: string) =>
		[...tab.el.querySelectorAll<HTMLButtonElement>('.preset')].find(
			(button) => button.textContent === t(`pptx.ribbon.transition.${type}`),
		)!;
	const checkbox = (id: string) =>
		q<HTMLInputElement>(`[data-ribbon-control="transitions.timing.${id}"] input[type=checkbox]`);
	return { t, tab, handlers, q, command, preset, checkbox, onToggleInspector };
}

describe('createTransitionsTab', () => {
	it('is the shared Transitions view with every public control id', () => {
		const { tab, q } = mount();
		expect(tab.el.tagName.toLowerCase()).toBe('pptx-ui-ribbon-transitions');
		for (const id of ['preview.preview', 'timing.sound', 'timing.duration', 'timing.applyToAll']) {
			expect(tab.el.querySelectorAll(`[data-ribbon-control="transitions.${id}"]`)).toHaveLength(1);
		}
		expect(q('[data-ribbon-control="transitions.transitionToThisSlide.gallery"]')).toBeTruthy();
		expect(tab.el.querySelectorAll('.preset')).toHaveLength(9);
	});

	it('offers None, all 19 stock sounds, and Other Sound for a slide with no sound', () => {
		const { q } = mount();
		const select = q<HTMLSelectElement>('select');
		expect(select.disabled).toBeFalsy();
		expect([...select.options].map((o) => o.value)).toStrictEqual(['none', ...STOCK_IDS, 'other']);
	});

	it('names the After checkbox and its duration box apart', () => {
		const { q, checkbox } = mount();
		// Both controls live under one `<label>`, which names only its FIRST
		// labelable descendant, so each carries its own aria-label.
		expect(checkbox('advanceAfter').getAttribute('aria-label')).toBe('After:');
		const seconds = q<HTMLInputElement>('input[type=text]');
		expect(seconds.getAttribute('aria-label')).toBe('Advance after specified duration');
		expect(seconds.title).toBe('Advance after specified duration');
		expect(checkbox('advanceOnClick').getAttribute('aria-label')).toBe('On Mouse Click');
	});

	it('opens the inspector from the Inspector button', () => {
		const { q, onToggleInspector } = mount();
		q('.inspector').shadowRoot!.querySelector('button')!.click();
		expect(onToggleInspector).toHaveBeenCalledOnce();
	});

	it('commits the picked preset the moment the gallery is clicked', () => {
		const { handlers, preset } = mount();
		preset('fade').click();
		expect(handlers.applyDraft).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'fade', durationSec: 0.7 }),
			false,
		);
	});

	it('commits the duration on its own, without waiting for another preset click', () => {
		const { handlers, q } = mount();
		const duration = q<HTMLInputElement>('input[type=number]');
		duration.value = '1.5';
		duration.dispatchEvent(new Event('input'));
		expect(handlers.applyDraft).toHaveBeenCalledWith(
			expect.objectContaining({ durationSec: 1.5 }),
			false,
		);
	});

	it('commits an Advance After time on change, once After is ticked', () => {
		const { handlers, q, checkbox } = mount();
		const after = checkbox('advanceAfter');
		after.checked = true;
		after.dispatchEvent(new Event('change'));
		// The draft source is the deck: the host re-seeds after the commit.
		handlers.setDraft({ ...EMPTY_RIBBON_TRANSITION_DRAFT, advanceAfter: true });
		const seconds = q<HTMLInputElement>('input[type=text]');
		seconds.value = '00:03.00';
		seconds.dispatchEvent(new Event('change'));
		expect(handlers.applyDraft).toHaveBeenLastCalledWith(
			expect.objectContaining({ advanceAfter: true, advanceAfterText: '00:03.00' }),
			false,
		);
	});

	it('commits the Advance on Mouse Click toggle on its own', () => {
		const { handlers, checkbox } = mount();
		const onClick = checkbox('advanceOnClick');
		onClick.checked = false;
		onClick.dispatchEvent(new Event('change'));
		expect(handlers.applyDraft).toHaveBeenCalledWith(
			expect.objectContaining({ advanceOnClick: false }),
			false,
		);
	});

	it('apply to All is a command that commits to every slide at once', () => {
		const { handlers, preset, command } = mount();
		preset('wipe').click();
		expect(handlers.applyDraft).toHaveBeenLastCalledWith(expect.anything(), false);
		command('transitions.timing.applyToAll').click();
		expect(handlers.applyDraft).toHaveBeenLastCalledWith(expect.anything(), true);
	});

	it('preview replays the transition on the stage instead of doing nothing', () => {
		const handlers = makeHandlers({
			...EMPTY_RIBBON_TRANSITION_DRAFT,
			type: 'push',
			durationSec: 0.8,
		});
		const { command } = mount(handlers);
		const stage = document.createElement('div');
		stage.setAttribute('aria-roledescription', 'slide');
		document.body.appendChild(stage);

		command('transitions.preview.preview').click();

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		// A preview must never write to the deck.
		expect(handlers.applyDraft).not.toHaveBeenCalled();
		stage.remove();
	});

	it('re-seeds every control from the active slide on sync', () => {
		const { handlers, tab, q, checkbox, preset } = mount();
		handlers.setDraft({
			type: 'wipe',
			durationSec: 2,
			advanceOnClick: false,
			advanceAfter: true,
			advanceAfterText: '00:05.00',
		});
		tab.sync();
		expect(q<HTMLInputElement>('input[type=number]').value).toBe('2');
		expect(checkbox('advanceAfter').checked).toBeTruthy();
		expect(q<HTMLInputElement>('input[type=text]').value).toBe('00:05.00');
		expect(checkbox('advanceOnClick').checked).toBeFalsy();
		expect(preset('wipe').getAttribute('aria-pressed')).toBe('true');
		// Reading the deck must never write back to it.
		expect(handlers.applyDraft).not.toHaveBeenCalled();
	});

	it('setEditable gates the gallery, advance controls and Sound select together', () => {
		const { tab, q, checkbox, preset, handlers } = mount();
		tab.setEditable(false);
		expect(preset('fade').disabled).toBeTruthy();
		expect(checkbox('advanceOnClick').disabled).toBeTruthy();
		expect(q<HTMLSelectElement>('select').disabled).toBeTruthy();
		preset('fade').click();
		expect(handlers.applyDraft).not.toHaveBeenCalled();
		tab.setEditable(true);
		expect(preset('fade').disabled).toBeFalsy();
		expect(checkbox('advanceOnClick').disabled).toBeFalsy();
		expect(q<HTMLSelectElement>('select').disabled).toBeFalsy();
	});
});

describe('createTransitionsTab > Sound picker', () => {
	it('leads with the current file name once the slide carries a non-stock sound', () => {
		const { q } = mount(makeHandlers(undefined, { type: 'fade', soundFileName: 'chime.wav' }));
		const select = q<HTMLSelectElement>('select');
		expect([...select.options].map((o) => o.value)).toStrictEqual([
			'current',
			'none',
			...STOCK_IDS,
			'other',
		]);
		expect(select.value).toBe('current');
	});

	it('picks a stock sound directly, with no file dialog', async () => {
		const { handlers, q } = mount();
		const select = q<HTMLSelectElement>('select');
		select.value = 'chime';
		select.dispatchEvent(new Event('change'));
		await waitFor(() => handlers.applyChange.mock.calls.length > 0);

		expect(handlers.applyChange).toHaveBeenCalledWith(
			expect.objectContaining({ soundName: 'CHIMES.WAV', soundFileName: 'CHIMES.WAV' }),
		);
		const call = handlers.applyChange.mock.calls[0][0] as Partial<PptxSlideTransition>;
		expect(call.soundData).toMatch(/^data:audio\/wav;base64,/);
	});

	it('clears the sound when "None" is chosen', async () => {
		const { handlers, q } = mount(
			makeHandlers(undefined, { type: 'fade', soundFileName: 'chime.wav', soundRId: 'rId2' }),
		);
		const select = q<HTMLSelectElement>('select');
		select.value = 'none';
		select.dispatchEvent(new Event('change'));
		await waitFor(() => handlers.applyChange.mock.calls.length > 0);
		expect(handlers.applyChange).toHaveBeenCalledWith(
			expect.objectContaining({ soundRId: undefined, soundFileName: undefined }),
		);
	});

	it('opens the file picker instead of committing when "Other Sound..." is chosen', () => {
		const { handlers, q } = mount();
		const clickSpy = vi.spyOn(q<HTMLInputElement>('input[type=file]'), 'click');
		const select = q<HTMLSelectElement>('select');
		select.value = 'other';
		select.dispatchEvent(new Event('change'));
		expect(clickSpy).toHaveBeenCalledOnce();
		expect(handlers.applyChange).not.toHaveBeenCalled();
		expect(select.value).toBe('none');
	});

	it('commits the picked file as pending sound data', async () => {
		const { handlers, q } = mount();
		const input = q<HTMLInputElement>('input[type=file]');
		const file = new File(['fake wav bytes'], 'applause.wav', { type: 'audio/wav' });
		Object.defineProperty(input, 'files', { value: [file], configurable: true });

		input.dispatchEvent(new Event('change'));
		// FileReader resolves asynchronously even for an in-memory Blob; poll
		// rather than hope a fixed delay covers it under load.
		await waitFor(() => handlers.applyChange.mock.calls.length > 0);

		expect(handlers.applyChange).toHaveBeenCalledWith(
			expect.objectContaining({
				soundFileName: 'applause.wav',
				soundName: 'applause',
				soundRId: undefined,
				soundPath: undefined,
			}),
		);
		const call = handlers.applyChange.mock.calls[0][0] as Partial<PptxSlideTransition>;
		expect(call.soundData).toMatch(/^data:/);
	});

	it('repaints the Sound select on sync even when the ribbon draft is unchanged', () => {
		const { handlers, tab, q } = mount();
		handlers.setTransition({ type: 'none', soundFileName: 'chime.wav' });
		tab.sync();
		expect(q<HTMLSelectElement>('select').value).toBe('current');
	});
});
