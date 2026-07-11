import type { PptxTransitionType } from 'pptx-viewer-core';

import type { TransitionActions } from '../../../editor/editor-transition-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton, makeNumberField } from '../../controls';

/** Transition presets surfaced in the gallery (matches the `pptx.ribbon.transition.*` i18n keys). */
const TRANSITION_PRESETS: readonly { type: PptxTransitionType; labelKey: string }[] = [
	{ type: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ type: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ type: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ type: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ type: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ type: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ type: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ type: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ type: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
];

const DEFAULT_DURATION_SEC = 0.7;

export interface TransitionsTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
}

/**
 * The Transitions ribbon tab: a preset gallery that assigns a slide
 * transition, a duration input (seconds), and an "Apply to All Slides"
 * checkbox. Every preset click routes through
 * {@link TransitionActions.applyTransition}, which reads/writes the exact
 * `PptxSlide.transition` field the presentation-mode playback state machine
 * already consumes (see `animation/presentation-playback.ts`), so a picked
 * transition plays back immediately in Present mode. The duration field and
 * checkbox are modifiers applied on the *next* preset click, not
 * independently committed, so typing a duration never spawns its own history
 * entry.
 */
export function createTransitionsTab(
	doc: Document,
	t: Translator,
	handlers: Pick<TransitionActions, 'applyTransition'>,
): TransitionsTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	let durationSec = DEFAULT_DURATION_SEC;

	const applyToAllLabel = createEl(doc, 'label', 'pptxv-transition-apply-all');
	const applyToAll = doc.createElement('input');
	applyToAll.type = 'checkbox';
	applyToAll.setAttribute('aria-label', t('pptx.ribbon.applyTransitionToAll'));
	applyToAllLabel.append(applyToAll, doc.createTextNode(t('pptx.ribbon.applyTransitionToAll')));

	const applyPreset = (type: PptxTransitionType): void =>
		handlers.applyTransition(type, Math.round(durationSec * 1000), applyToAll.checked);

	const gallery = createEl(doc, 'div', 'pptxv-transition-gallery');
	const buttons = TRANSITION_PRESETS.map((preset) => {
		const btn = makeButton(doc, {
			label: t(preset.labelKey),
			text: t(preset.labelKey),
			onClick: () => applyPreset(preset.type),
		});
		gallery.appendChild(btn.btn);
		return btn;
	});
	el.appendChild(gallery);

	const durationField = makeNumberField(doc, {
		label: t('pptx.ribbon.duration'),
		min: 0,
		max: 20,
		step: 0.25,
		onCommit: (value) => {
			durationSec = Math.max(0, value);
		},
	});
	durationField.setValue(DEFAULT_DURATION_SEC);
	el.appendChild(durationField.el);
	el.appendChild(applyToAllLabel);

	return {
		el,
		setEditable(editable) {
			for (const b of buttons) {
				b.setDisabled(!editable);
			}
			durationField.setDisabled(!editable);
			applyToAll.disabled = !editable;
		},
	};
}
