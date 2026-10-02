import type { PptxCustomShow, PptxPresentationProperties } from 'pptx-viewer-core';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendDialogActions } from './dialog-footer';
import { createInspectorRadio, createInspectorSelect } from './inspector/controls-extra';
import { appendCheckRow, appendRadioControl, createParityDialogShell } from './parity-dialog-shell';

/**
 * PowerPoint's Set Up Show dialog.
 *
 * "Show slides" offers three radios, not two: All, From/To, and Custom show.
 * The third was missing here entirely (the other four bindings all had it), so
 * a deck authored to open into a named show could neither be created nor
 * corrected from this binding.
 */
export function openSlideShowDialog(
	doc: Document,
	t: Translator,
	properties: PptxPresentationProperties,
	slideCount: number,
	onSave: (next: PptxPresentationProperties) => void,
	customShows: readonly PptxCustomShow[] = [],
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.slideShow.setUpTitle'));
	const draft = { ...properties };
	const group = (legend: string): HTMLFieldSetElement => {
		const fieldset = createEl(doc, 'fieldset');
		const title = createEl(doc, 'legend');
		title.textContent = legend;
		fieldset.appendChild(title);
		shell.body.appendChild(fieldset);
		return fieldset;
	};
	const showType = group(t('pptx.slideShow.showType'));
	for (const [value, key] of [
		['presented', 'pptx.slideShow.presentedBySpeaker'],
		['browsed', 'pptx.slideShow.browsedByIndividual'],
		['kiosk', 'pptx.slideShow.browsedAtKiosk'],
	] as const) {
		const input = appendRadioControl(
			doc,
			showType,
			t(key),
			'showType',
			(draft.showType ?? 'presented') === value,
		);
		input.addEventListener('change', () => {
			draft.showType = value;
			if (value === 'kiosk') {
				draft.loopContinuously = true;
			}
		});
	}
	const range = group(t('pptx.slideShow.showSlides'));
	const all = appendRadioControl(
		doc,
		range,
		t('pptx.slideShow.allSlides'),
		'range',
		(draft.showSlidesMode ?? 'all') === 'all',
	);
	all.addEventListener('change', () => {
		draft.showSlidesMode = 'all';
	});
	const from = doc.createElement('input');
	from.type = 'number';
	from.min = '1';
	from.max = String(slideCount);
	from.value = String(draft.showSlidesFrom ?? 1);
	const to = doc.createElement('input');
	to.type = 'number';
	to.min = '1';
	to.max = String(slideCount);
	to.value = String(draft.showSlidesTo ?? slideCount);
	const rangeRow = createEl(doc, 'label', 'pptxv-parity-range');
	const selected = createInspectorRadio(doc, 'range');
	selected.setAttribute('aria-label', t('pptx.slideShow.fromTo'));
	selected.checked = draft.showSlidesMode === 'range';
	rangeRow.append(
		selected,
		doc.createTextNode(t('pptx.slideShow.from')),
		from,
		doc.createTextNode(t('pptx.slideShow.to')),
		to,
	);
	range.appendChild(rangeRow);
	selected.addEventListener('change', () => {
		draft.showSlidesMode = 'range';
	});
	// `p:showPr/p:custShow/@id`. Offered only when the deck defines a show,
	// exactly like the other four bindings, so the radio can never name nothing.
	if (customShows.length > 0) {
		const showRow = createEl(doc, 'label', 'pptxv-parity-range');
		const showRadio = createInspectorRadio(doc, 'range');
		showRadio.setAttribute('aria-label', t('pptx.slideShow.customShow'));
		showRadio.dataset.pptxShowSlidesCustom = 'true';
		showRadio.checked = draft.showSlidesMode === 'customShow';
		const picker = createInspectorSelect(doc);
		picker.setAttribute('aria-label', t('pptx.slideShow.customShow'));
		for (const show of customShows) {
			const option = doc.createElement('option');
			option.value = show.id;
			option.textContent = show.name;
			picker.appendChild(option);
		}
		picker.value = draft.showSlidesCustomShowId ?? customShows[0].id;
		const selectShow = (): void => {
			draft.showSlidesMode = 'customShow';
			draft.showSlidesCustomShowId = picker.value;
		};
		showRadio.addEventListener('change', selectShow);
		picker.addEventListener('change', () => {
			if (showRadio.checked) {
				selectShow();
			}
		});
		showRow.append(showRadio, doc.createTextNode(t('pptx.slideShow.customShow')), picker);
		range.appendChild(showRow);
	}
	const advance = group(t('pptx.slideShow.advanceSlides'));
	for (const [value, key] of [
		['manual', 'pptx.slideShow.manually'],
		['useTimings', 'pptx.slideShow.useTimings'],
	] as const) {
		const input = appendRadioControl(
			doc,
			advance,
			t(key),
			'advance',
			(draft.advanceMode ?? 'useTimings') === value,
		);
		input.addEventListener('change', () => {
			draft.advanceMode = value;
		});
	}
	const options = group(t('pptx.slideShow.showOptions'));
	for (const [key, label, inverse] of [
		['loopContinuously', 'pptx.slideShow.loopContinuously', false],
		['showWithNarration', 'pptx.slideShow.showWithoutNarration', true],
		['showWithAnimation', 'pptx.slideShow.showWithoutAnimation', true],
		['showSubtitles', 'pptx.slideShow.showSubtitles', false],
	] as const) {
		const input = appendCheckRow(
			doc,
			options,
			t(label),
			inverse ? draft[key] === false : Boolean(draft[key]),
		);
		input.addEventListener('change', () => {
			(draft as Record<string, unknown>)[key] = inverse ? !input.checked : input.checked;
		});
	}
	appendDialogActions(doc, shell.footer, [
		{ id: 'cancel', label: t('pptx.common.cancel'), run: shell.close },
		{
			id: 'ok',
			label: t('pptx.common.ok'),
			variant: 'primary',
			run: () => {
				draft.showSlidesFrom = Number(from.value);
				draft.showSlidesTo = Number(to.value);
				onSave(draft);
				shell.close();
			},
		},
	]);
}
