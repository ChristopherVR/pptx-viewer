import type { TransitionAdvance } from '../../../editor/editor-transition-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';

export interface AdvanceGroup {
	el: HTMLElement;
	/** How the current settings translate into `PptxSlideTransition` advance fields. */
	value(): TransitionAdvance;
	setDisabled(disabled: boolean): void;
}

/** Seconds-per-minute-free parse of the `mm:ss.hh` box PowerPoint shows. */
function parseSeconds(text: string): number {
	const [minutes, seconds] = text.includes(':') ? text.split(':') : ['0', text];
	const total = Number(minutes) * 60 + Number(seconds);
	return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/**
 * The Transitions tab's Advance Slide group: an "On Mouse Click" toggle and an
 * "After" toggle with its duration box, exactly the controls React renders.
 *
 * Unlike React's (which is local component state and reaches no model), these
 * write `PptxSlideTransition.advanceOnClick` / `advanceAfterMs` through the
 * next preset application, the same way the duration box already worked.
 *
 * Both the checkbox and its duration box are named "After" on purpose: React
 * derives both names from the one wrapping label, and the ribbon inventory
 * spec compares the two bindings name for name.
 */
export function createAdvanceGroup(doc: Document, t: Translator): AdvanceGroup {
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
	afterSeconds.value = '00:00.00';
	afterSeconds.disabled = true;
	afterSeconds.title = t('pptx.ribbon.advanceAfterSeconds');
	afterSeconds.setAttribute('aria-label', t('pptx.ribbon.afterDuration'));
	afterEnabled.addEventListener('change', () => {
		afterSeconds.disabled = !afterEnabled.checked;
	});
	afterLabel.append(afterEnabled, doc.createTextNode(t('pptx.ribbon.afterDuration')), afterSeconds);

	el.append(clickLabel, afterLabel);

	return {
		el,
		value: () => ({
			onClick: onClick.checked,
			afterMs: afterEnabled.checked
				? Math.round(parseSeconds(afterSeconds.value) * 1000)
				: undefined,
		}),
		setDisabled(disabled) {
			onClick.disabled = disabled;
			afterEnabled.disabled = disabled;
			afterSeconds.disabled = disabled || !afterEnabled.checked;
		},
	};
}
