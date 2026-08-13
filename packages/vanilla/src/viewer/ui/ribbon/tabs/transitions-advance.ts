import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import { NO_ADVANCE_AFTER_TEXT } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';

/** The slice of the tab's draft this group owns. */
export type AdvanceDraft = Pick<
	RibbonTransitionDraft,
	'advanceOnClick' | 'advanceAfter' | 'advanceAfterText'
>;

export interface AdvanceGroup {
	el: HTMLElement;
	/** Reflect the active slide's advance settings on the controls. */
	setValue(value: AdvanceDraft): void;
	setDisabled(disabled: boolean): void;
}

/**
 * The Transitions tab's Advance Slide group: an "On Mouse Click" toggle and an
 * "After" toggle with its `mm:ss.hh` box, exactly the controls React renders.
 *
 * Every control reports through `onChange` the moment it changes, and the tab
 * commits that straight onto the slide (shared `applyRibbonTransitionDraft`).
 * They used to be modifiers that only reached the model on the NEXT preset
 * click, so ticking "After" on its own did nothing at all.
 *
 * The seconds box commits on change/blur/Enter rather than per keystroke: a
 * half-typed "00:0" parses as a real (wrong) time, and each commit is its own
 * undo step.
 *
 * Both the checkbox and its duration box are named "After" on purpose: React
 * derives both names from the one wrapping label, and the ribbon inventory
 * spec compares the two bindings name for name.
 */
export function createAdvanceGroup(
	doc: Document,
	t: Translator,
	onChange: (value: AdvanceDraft) => void,
): AdvanceGroup {
	const el = createEl(doc, 'div', 'pptxv-transition-advance');
	const caption = createEl(doc, 'span', 'pptxv-rgroup-label');
	caption.textContent = t('pptx.ribbon.advanceSlide');
	el.appendChild(caption);

	const clickLabel = createEl(doc, 'label', 'pptxv-transition-advance-row');
	const onClick = doc.createElement('input');
	onClick.type = 'checkbox';
	onClick.checked = true;
	onClick.setAttribute('aria-label', t('pptx.ribbon.onMouseClick'));
	clickLabel.append(onClick, doc.createTextNode(t('pptx.ribbon.onMouseClick')));

	const afterLabel = createEl(doc, 'label', 'pptxv-transition-advance-row');
	const afterEnabled = doc.createElement('input');
	afterEnabled.type = 'checkbox';
	afterEnabled.setAttribute('aria-label', t('pptx.ribbon.afterDuration'));
	const afterSeconds = doc.createElement('input');
	afterSeconds.type = 'text';
	afterSeconds.className = 'pptxv-transition-advance-seconds';
	afterSeconds.value = NO_ADVANCE_AFTER_TEXT;
	afterSeconds.disabled = true;
	afterSeconds.title = t('pptx.ribbon.advanceAfterSeconds');
	afterSeconds.setAttribute('aria-label', t('pptx.ribbon.afterDuration'));
	afterLabel.append(afterEnabled, doc.createTextNode(t('pptx.ribbon.afterDuration')), afterSeconds);

	const current = (): AdvanceDraft => ({
		advanceOnClick: onClick.checked,
		advanceAfter: afterEnabled.checked,
		advanceAfterText: afterSeconds.value,
	});
	let disabledByTab = false;
	const syncSecondsDisabled = (): void => {
		afterSeconds.disabled = disabledByTab || !afterEnabled.checked;
	};

	onClick.addEventListener('change', () => onChange(current()));
	afterEnabled.addEventListener('change', () => {
		syncSecondsDisabled();
		onChange(current());
	});
	afterSeconds.addEventListener('change', () => onChange(current()));
	// The ribbon sits inside the viewer's keyboard-shortcut root, which reads
	// bare letters as commands; the seconds box has to keep its own typing.
	afterSeconds.addEventListener('keydown', (event) => event.stopPropagation());

	el.append(clickLabel, afterLabel);

	return {
		el,
		setValue(value) {
			onClick.checked = value.advanceOnClick;
			afterEnabled.checked = value.advanceAfter;
			// Never clobber the box while the user is typing in it.
			if (doc.activeElement !== afterSeconds) {
				afterSeconds.value = value.advanceAfterText;
			}
			syncSecondsDisabled();
		},
		setDisabled(disabled) {
			disabledByTab = disabled;
			onClick.disabled = disabled;
			afterEnabled.disabled = disabled;
			syncSecondsDisabled();
		},
	};
}
