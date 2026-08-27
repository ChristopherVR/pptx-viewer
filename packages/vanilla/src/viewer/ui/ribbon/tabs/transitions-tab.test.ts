import type { PptxSlideTransition } from 'pptx-viewer-core';
import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import { EMPTY_RIBBON_TRANSITION_DRAFT, TRANSITION_PREVIEW_ATTR } from 'pptx-viewer-shared';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonTransitionHandlers } from '../ribbon-types';
import { createTransitionsTab } from './transitions-tab';

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

function named(tab: { el: HTMLElement }, label: string): HTMLElement[] {
	return [...tab.el.querySelectorAll<HTMLElement>('button, input, select')].filter(
		(node) => node.getAttribute('aria-label') === label,
	);
}

describe('createTransitionsTab', () => {
	it('offers Preview, Sound, Apply to All and the Inspector toggle', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		expect(named(tab, t('pptx.ribbon.preview'))).toHaveLength(1);
		expect(named(tab, t('pptx.ribbon.sound'))).toHaveLength(1);
		expect(named(tab, t('pptx.headerFooter.applyToAll'))).toHaveLength(1);
		expect(named(tab, t('pptx.ribbon.inspector'))).toHaveLength(1);
	});

	it('offers None and Other Sound for a slide with no sound', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		const select = named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement;
		expect(select.disabled).toBeFalsy();
		expect([...select.options].map((o) => o.value)).toStrictEqual(['none', 'other']);
	});

	it('offers the Advance Slide group, with both After controls React renders', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		expect(named(tab, t('pptx.ribbon.onMouseClick'))).toHaveLength(1);
		expect(named(tab, t('pptx.ribbon.afterDuration'))).toHaveLength(1);
		expect(named(tab, t('pptx.ribbon.advanceAfterSeconds'))).toHaveLength(1);
	});

	it('names the After checkbox and its duration box apart, as the other four bindings do', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		// Both controls live under one `<label>`, which names only its FIRST
		// labelable descendant, so each carries its own aria-label. This binding
		// used to give the seconds box the checkbox's name, which published the
		// ribbon as offering "After:" twice and never offering "Advance after
		// specified duration" at all (caught by e2e/ribbon-control-inventory).
		const afterCheckbox = named(tab, t('pptx.ribbon.afterDuration'))[0] as HTMLInputElement;
		const afterSeconds = named(tab, t('pptx.ribbon.advanceAfterSeconds'))[0] as HTMLInputElement;
		expect(afterCheckbox?.type).toBe('checkbox');
		expect(afterSeconds?.type).toBe('text');
		expect(afterSeconds.title).toBe(t('pptx.ribbon.advanceAfterSeconds'));
	});

	it('opens the inspector from the Inspector button', () => {
		const t = createTranslator();
		const onToggleInspector = vi.fn();
		const tab = createTransitionsTab(document, t, makeHandlers(), onToggleInspector);
		(named(tab, t('pptx.ribbon.inspector'))[0] as HTMLButtonElement).click();
		expect(onToggleInspector).toHaveBeenCalledOnce();
	});

	it('commits the picked preset the moment the gallery is clicked', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		tab.el
			.querySelector<HTMLButtonElement>(
				`.pptxv-transition-gallery button[aria-label="${t('pptx.ribbon.transition.fade')}"]`,
			)
			?.click();
		expect(handlers.applyDraft).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'fade', durationSec: 0.7 }),
			false,
		);
	});

	it('commits the duration on its own, without waiting for another preset click', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const duration = named(tab, t('pptx.ribbon.duration'))[0] as HTMLInputElement;
		duration.value = '1.5';
		duration.dispatchEvent(new Event('change'));
		expect(handlers.applyDraft).toHaveBeenCalledWith(
			expect.objectContaining({ durationSec: 1.5 }),
			false,
		);
	});

	it('commits an Advance After time as soon as the box is filled in', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const afterCheckbox = named(tab, t('pptx.ribbon.afterDuration'))[0] as HTMLInputElement;
		const afterSeconds = named(tab, t('pptx.ribbon.advanceAfterSeconds'))[0] as HTMLInputElement;
		afterCheckbox.checked = true;
		afterCheckbox.dispatchEvent(new Event('change'));
		afterSeconds.value = '00:03.00';
		afterSeconds.dispatchEvent(new Event('change'));

		expect(handlers.applyDraft).toHaveBeenLastCalledWith(
			expect.objectContaining({ advanceAfter: true, advanceAfterText: '00:03.00' }),
			false,
		);
	});

	it('commits the Advance on Mouse Click toggle on its own', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const onClick = named(tab, t('pptx.ribbon.onMouseClick'))[0] as HTMLInputElement;
		onClick.checked = false;
		onClick.dispatchEvent(new Event('change'));
		expect(handlers.applyDraft).toHaveBeenCalledWith(
			expect.objectContaining({ advanceOnClick: false }),
			false,
		);
	});

	it('apply to All is a BUTTON that commits to every slide at once', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const applyToAll = named(tab, t('pptx.headerFooter.applyToAll'))[0];
		// PowerPoint's control is a button, not the arming checkbox this binding
		// used to render (which made a picked preset reach one slide or all of
		// them depending on a toggle no other binding had).
		expect(applyToAll.tagName).toBe('BUTTON');

		tab.el.querySelector<HTMLButtonElement>('.pptxv-transition-gallery button')?.click();
		expect(handlers.applyDraft).toHaveBeenLastCalledWith(expect.anything(), false);

		(applyToAll as HTMLButtonElement).click();
		expect(handlers.applyDraft).toHaveBeenLastCalledWith(expect.anything(), true);
	});

	it('preview replays the transition on the stage instead of doing nothing', () => {
		const t = createTranslator();
		const handlers = makeHandlers({
			...EMPTY_RIBBON_TRANSITION_DRAFT,
			type: 'push',
			durationSec: 0.8,
		});
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const stage = document.createElement('div');
		stage.setAttribute('aria-roledescription', 'slide');
		document.body.appendChild(stage);

		(named(tab, t('pptx.ribbon.preview'))[0] as HTMLButtonElement).click();

		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		// A preview must never write to the deck.
		expect(handlers.applyDraft).not.toHaveBeenCalled();
		stage.remove();
	});

	it('re-seeds every control from the active slide on sync', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		handlers.setDraft({
			type: 'wipe',
			durationSec: 2,
			advanceOnClick: false,
			advanceAfter: true,
			advanceAfterText: '00:05.00',
		});
		tab.sync();

		const duration = named(tab, t('pptx.ribbon.duration'))[0] as HTMLInputElement;
		const afterCheckbox = named(tab, t('pptx.ribbon.afterDuration'))[0] as HTMLInputElement;
		const afterSeconds = named(tab, t('pptx.ribbon.advanceAfterSeconds'))[0] as HTMLInputElement;
		expect(duration.value).toBe('2');
		expect(afterCheckbox.checked).toBeTruthy();
		expect(afterSeconds.value).toBe('00:05.00');
		expect((named(tab, t('pptx.ribbon.onMouseClick'))[0] as HTMLInputElement).checked).toBeFalsy();
		const wipe = tab.el.querySelector<HTMLButtonElement>(
			`.pptxv-transition-gallery button[aria-label="${t('pptx.ribbon.transition.wipe')}"]`,
		);
		expect(wipe?.classList.contains('is-active')).toBeTruthy();
		// Reading the deck must never write back to it.
		expect(handlers.applyDraft).not.toHaveBeenCalled();
	});

	it('setEditable gates the gallery and the advance controls together', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		tab.setEditable(false);
		const preset = tab.el.querySelector<HTMLButtonElement>('.pptxv-transition-gallery button');
		expect(preset?.disabled).toBeTruthy();
		expect(
			(named(tab, t('pptx.ribbon.onMouseClick'))[0] as HTMLInputElement).disabled,
		).toBeTruthy();

		tab.setEditable(true);
		expect(preset?.disabled).toBeFalsy();
		expect((named(tab, t('pptx.ribbon.onMouseClick'))[0] as HTMLInputElement).disabled).toBeFalsy();
	});

	it('setEditable gates the Sound select too', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		tab.setEditable(false);
		expect((named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement).disabled).toBeTruthy();
		tab.setEditable(true);
		expect((named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement).disabled).toBeFalsy();
	});
});

describe('createTransitionsTab > Sound picker', () => {
	function soundFileInput(tab: { el: HTMLElement }): HTMLInputElement {
		return tab.el.querySelector('input[type="file"]') as HTMLInputElement;
	}

	it('leads with the current file name once the slide carries a sound', () => {
		const t = createTranslator();
		const handlers = makeHandlers(undefined, { type: 'fade', soundFileName: 'chime.wav' });
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const select = named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement;
		expect([...select.options].map((o) => o.value)).toStrictEqual(['current', 'none', 'other']);
		expect(select.value).toBe('current');
	});

	it('clears the sound when "None" is chosen', () => {
		const t = createTranslator();
		const handlers = makeHandlers(undefined, {
			type: 'fade',
			soundFileName: 'chime.wav',
			soundRId: 'rId2',
		});
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const select = named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement;

		select.value = 'none';
		select.dispatchEvent(new Event('change'));

		expect(handlers.applyChange).toHaveBeenCalledWith(
			expect.objectContaining({ soundRId: undefined, soundFileName: undefined }),
		);
	});

	it('opens the file picker instead of committing when "Other Sound..." is chosen', () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const select = named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement;
		const input = soundFileInput(tab);
		const clickSpy = vi.spyOn(input, 'click');

		select.value = 'other';
		select.dispatchEvent(new Event('change'));

		expect(clickSpy).toHaveBeenCalledOnce();
		expect(handlers.applyChange).not.toHaveBeenCalled();
	});

	it('commits the picked file as pending sound data', async () => {
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		const input = soundFileInput(tab);
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
		const t = createTranslator();
		const handlers = makeHandlers();
		const tab = createTransitionsTab(document, t, handlers, vi.fn());
		handlers.setTransition({ type: 'none', soundFileName: 'chime.wav' });

		tab.sync();

		const select = named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement;
		expect(select.value).toBe('current');
	});
});
