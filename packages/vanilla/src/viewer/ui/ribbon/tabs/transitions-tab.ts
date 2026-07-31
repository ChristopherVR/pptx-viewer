import type { PptxTransitionType } from 'pptx-viewer-core';

import type { TransitionActions } from '../../../editor/editor-transition-actions';
import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton, makeNumberField } from '../../controls';
import { createAdvanceGroup } from './transitions-advance';

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
 * The Transitions ribbon tab: Preview, a preset gallery that assigns a slide
 * transition, a duration input (seconds), a sound picker, Apply to All, the
 * Advance Slide group and an Inspector toggle - React's `TransitionsSection`
 * control for control.
 *
 * Every preset click routes through {@link TransitionActions.applyTransition},
 * which reads/writes the exact `PptxSlide.transition` field the
 * presentation-mode playback state machine already consumes (see
 * `animation/presentation-playback.ts`), so a picked transition plays back
 * immediately in Present mode. The duration field, the Apply to All checkbox
 * and the Advance Slide toggles are modifiers applied on the *next* preset
 * click rather than independently committed, so typing a duration never spawns
 * its own history entry.
 *
 * Preview carries no handler, matching React: replaying a transition needs the
 * presentation overlay, which no binding wires to this button yet.
 */
export function createTransitionsTab(
	doc: Document,
	t: Translator,
	handlers: Pick<TransitionActions, 'applyTransition'>,
	onToggleInspector: () => void,
): TransitionsTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	let durationSec = DEFAULT_DURATION_SEC;

	const preview = makeButton(doc, {
		label: t('pptx.ribbon.preview'),
		icon: 'play',
		textLabel: t('pptx.ribbon.preview'),
		onClick: () => {},
	});
	preview.btn.title = t('pptx.ribbon.previewTransition');
	el.appendChild(preview.btn);

	const advance = createAdvanceGroup(doc, t);

	const applyToAllLabel = createEl(doc, 'label', 'pptxv-transition-apply-all');
	const applyToAll = doc.createElement('input');
	applyToAll.type = 'checkbox';
	applyToAll.setAttribute('aria-label', t('pptx.headerFooter.applyToAll'));
	applyToAllLabel.title = t('pptx.ribbon.applyTransitionToAll');
	applyToAllLabel.append(applyToAll, doc.createTextNode(t('pptx.headerFooter.applyToAll')));

	const applyPreset = (type: PptxTransitionType): void =>
		handlers.applyTransition(
			type,
			Math.round(durationSec * 1000),
			applyToAll.checked,
			advance.value(),
		);

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
	durationField.input.title = t('pptx.ribbon.transitionDurationTitle');
	el.appendChild(durationField.el);

	// One "[No Sound]" entry, like React: no binding can pick a transition
	// sound yet, but the control has to exist or the tab reads as a different
	// product from every other binding's.
	const soundLabel = createEl(doc, 'label', 'pptxv-transition-sound');
	const sound = doc.createElement('select');
	sound.setAttribute('aria-label', t('pptx.ribbon.sound'));
	const noSound = doc.createElement('option');
	noSound.value = 'none';
	noSound.textContent = t('pptx.ribbon.soundNone');
	sound.appendChild(noSound);
	soundLabel.append(doc.createTextNode(t('pptx.ribbon.sound')), sound);
	el.appendChild(soundLabel);

	el.appendChild(applyToAllLabel);
	el.appendChild(advance.el);

	const inspector = makeButton(doc, {
		label: t('pptx.ribbon.inspector'),
		icon: 'panel-right',
		textLabel: t('pptx.ribbon.inspector'),
		onClick: onToggleInspector,
	});
	inspector.btn.title = t('pptx.ribbon.openInspectorTransitions');
	el.appendChild(inspector.btn);

	return {
		el,
		setEditable(editable) {
			for (const b of buttons) {
				b.setDisabled(!editable);
			}
			durationField.setDisabled(!editable);
			applyToAll.disabled = !editable;
			sound.disabled = !editable;
			advance.setDisabled(!editable);
		},
	};
}
