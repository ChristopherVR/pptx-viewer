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
): RibbonTransitionHandlers & {
	applyDraft: Mock<(draft: RibbonTransitionDraft, applyToAll: boolean) => void>;
	/** Stand in for the user navigating to a slide with another transition. */
	setDraft(next: RibbonTransitionDraft): void;
} {
	let draft = initial;
	return {
		readDraft: () => draft,
		applyDraft: vi.fn<(draft: RibbonTransitionDraft, applyToAll: boolean) => void>(),
		setDraft(next) {
			draft = next;
		},
	};
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

	it('disables the Sound select, because no binding can author a transition sound', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		expect((named(tab, t('pptx.ribbon.sound'))[0] as HTMLSelectElement).disabled).toBeTruthy();
	});

	it('offers the Advance Slide group, with both After controls React renders', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, makeHandlers(), vi.fn());
		expect(named(tab, t('pptx.ribbon.onMouseClick'))).toHaveLength(1);
		// The checkbox and its duration box share one name in React, which derives
		// both from the single wrapping label.
		expect(named(tab, t('pptx.ribbon.afterDuration'))).toHaveLength(2);
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
		const [afterCheckbox, afterSeconds] = named(
			tab,
			t('pptx.ribbon.afterDuration'),
		) as HTMLInputElement[];
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
		const [afterCheckbox, afterSeconds] = named(
			tab,
			t('pptx.ribbon.afterDuration'),
		) as HTMLInputElement[];
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
});
