import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';

/** Distinguishes the Start select of a second viewer mounted on the same page. */
let timingInstance = 0;

export interface TimingGroup {
	el: HTMLElement;
}

/**
 * The Animations tab's Timing group: a Start mode select and a duration box.
 *
 * Both ship disabled in every binding: per-animation timing is edited in the
 * inspector's Animation panel, and these are the PowerPoint-shaped placeholders
 * the ribbon shows for it.
 */
export function createTimingGroup(doc: Document, t: Translator): TimingGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row pptxv-animation-timing-grid');
	el.appendChild(row);
	const caption = createEl(doc, 'span', 'pptxv-rgroup-label');
	caption.textContent = t('pptx.animations.timing');
	el.appendChild(caption);

	timingInstance += 1;
	const startId = `pptx-animation-start-${timingInstance}`;
	const startLabel = createEl(doc, 'label', 'pptxv-field-label');
	startLabel.htmlFor = startId;
	startLabel.textContent = t('pptx.animations.start');
	const start = doc.createElement('select');
	start.id = startId;
	start.disabled = true;
	for (const key of ['onClick', 'withPrevious', 'afterPrevious']) {
		const option = doc.createElement('option');
		option.value = key;
		option.textContent = t(`pptx.animations.${key}`);
		start.appendChild(option);
	}

	const durationCaption = createEl(doc, 'span', 'pptxv-field-label');
	durationCaption.textContent = t('pptx.animations.duration');
	const duration = doc.createElement('input');
	duration.type = 'number';
	duration.min = '0';
	duration.step = '0.1';
	duration.value = '0.5';
	duration.disabled = true;
	// The caption beside it is a plain <span>, not a <label>, so without this the
	// box reads as an anonymous number field.
	duration.setAttribute('aria-label', t('pptx.animations.duration'));

	row.append(startLabel, start, durationCaption, duration);
	return { el };
}
