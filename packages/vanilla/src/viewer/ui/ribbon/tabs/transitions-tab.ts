import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import {
	applyRibbonTransitionDraft,
	applyTransitionSoundFile,
	clearTransitionSound,
	EMPTY_RIBBON_TRANSITION_DRAFT,
	playSlideTransitionPreview,
	readSoundFileAsDataUrl,
	RIBBON_TRANSITION_PRESETS,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionSoundOptions,
	transitionSoundSelectedValue,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton, makeNumberField } from '../../controls';
import type { RibbonTransitionHandlers } from '../ribbon-types';
import { createAdvanceGroup } from './transitions-advance';

export interface TransitionsTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	/** Re-seed every control from the ACTIVE slide's transition. */
	sync(): void;
}

/** Whether two drafts say the same thing (so a sync can skip repainting). */
function sameDraft(a: RibbonTransitionDraft, b: RibbonTransitionDraft): boolean {
	return (
		a.type === b.type &&
		a.durationSec === b.durationSec &&
		a.advanceOnClick === b.advanceOnClick &&
		a.advanceAfter === b.advanceAfter &&
		a.advanceAfterText === b.advanceAfterText
	);
}

/**
 * The Transitions ribbon tab: Preview, the shared preset gallery, a duration
 * input (seconds), a sound picker, Apply to All, the Advance Slide group and an
 * Inspector toggle - React's `TransitionsSection` control for control.
 *
 * The tab is one {@link RibbonTransitionDraft} seeded from the active slide
 * (shared `readRibbonTransitionDraft`, pulled in by {@link TransitionsTab.sync}
 * on every store change). EVERY control commits that draft immediately through
 * `applyDraft`, which writes the exact `PptxSlide.transition` field
 * the presentation-mode playback state machine consumes (see
 * `animation/presentation-playback.ts`). Duration and the Advance Slide toggles
 * used to be modifiers that only took effect on the NEXT preset click, so
 * typing a duration or ticking "After" on its own reached nothing.
 *
 * The gallery itself is the shared `RIBBON_TRANSITION_PRESETS`, so the strip
 * cannot drift entry by entry from the other four bindings.
 */
export function createTransitionsTab(
	doc: Document,
	t: Translator,
	handlers: RibbonTransitionHandlers,
	onToggleInspector: () => void,
): TransitionsTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	let draft: RibbonTransitionDraft = handlers.readDraft() ?? { ...EMPTY_RIBBON_TRANSITION_DRAFT };

	// Preview REPLAYS the transition on the editing stage through the shared
	// `playSlideTransitionPreview`, which is now what the button means in every
	// binding. It used to carry an empty handler here (and a re-commit of the
	// values the slide already had elsewhere), so no binding's Preview showed
	// the user anything at all.
	const preview = makeButton(doc, {
		label: t('pptx.ribbon.preview'),
		icon: 'play',
		textLabel: t('pptx.ribbon.preview'),
		onClick: () => playSlideTransitionPreview(applyRibbonTransitionDraft(undefined, draft), doc),
	});
	preview.btn.title = t('pptx.ribbon.previewTransition');
	el.appendChild(preview.btn);

	// PowerPoint's "Apply To All" is a BUTTON: it pushes the current timing onto
	// every slide the moment it is pressed. This binding (and Svelte) shipped it
	// as a checkbox, an arming toggle with no counterpart in the product being
	// copied, so the same control meant two different things depending on which
	// binding you happened to be running.
	const applyToAll = makeButton(doc, {
		label: t('pptx.headerFooter.applyToAll'),
		icon: 'copy',
		textLabel: t('pptx.headerFooter.applyToAll'),
		onClick: () => handlers.applyDraft(draft, true),
	});
	applyToAll.btn.title = t('pptx.ribbon.applyTransitionToAll');

	/** Highlight the gallery entry the draft names (React's active pill). */
	function paintGallery(): void {
		for (const button of buttons) {
			button.handle.setActive(button.type === draft.type);
		}
	}

	/** Fold a control's change into the draft and commit the whole draft. */
	const commit = (changes: Partial<RibbonTransitionDraft>): void => {
		draft = { ...draft, ...changes };
		paintGallery();
		handlers.applyDraft(draft, false);
	};

	const advance = createAdvanceGroup(doc, t, (value) => commit(value));

	const gallery = createEl(doc, 'div', 'pptxv-transition-gallery');
	const buttons = RIBBON_TRANSITION_PRESETS.map((preset) => {
		const btn = makeButton(doc, {
			label: t(preset.labelKey),
			text: t(preset.labelKey),
			onClick: () => commit({ type: preset.type }),
		});
		gallery.appendChild(btn.btn);
		return { type: preset.type, handle: btn };
	});
	el.appendChild(gallery);

	const durationField = makeNumberField(doc, {
		label: t('pptx.ribbon.duration'),
		min: 0,
		max: 20,
		step: 0.25,
		onCommit: (value) => commit({ durationSec: Math.max(0, value) }),
	});
	durationField.setValue(draft.durationSec);
	durationField.input.title = t('pptx.ribbon.transitionDurationTitle');
	el.appendChild(durationField.el);

	// "Other Sound..." opens a native file picker and the chosen file is
	// embedded into the package on save (core's `embedTransitionSound`).
	// "None" clears any sound the slide carries.
	const soundLabel = createEl(doc, 'label', 'pptxv-transition-sound');
	const sound = doc.createElement('select');
	sound.setAttribute('aria-label', t('pptx.ribbon.sound'));
	const soundFile = doc.createElement('input');
	soundFile.type = 'file';
	soundFile.accept = 'audio/*';
	soundFile.style.display = 'none';
	soundLabel.append(doc.createTextNode(t('pptx.ribbon.sound')), sound, soundFile);
	el.appendChild(soundLabel);

	/** Repaint the Sound select's options and selection from the active slide. */
	function paintSound(): void {
		const transition = handlers.readTransition();
		sound.replaceChildren();
		for (const option of transitionSoundOptions(transition)) {
			const optionEl = doc.createElement('option');
			optionEl.value = option.value;
			optionEl.textContent = option.i18nKey ? t(option.i18nKey) : (option.label ?? '');
			sound.appendChild(optionEl);
		}
		sound.value = transitionSoundSelectedValue(transition);
	}
	paintSound();

	sound.addEventListener('change', () => {
		if (sound.value === TRANSITION_SOUND_OTHER_VALUE) {
			soundFile.click();
			// The file input's own change (or a cancelled dialog) decides what
			// happens next; put the select back to what the slide actually has.
			sound.value = transitionSoundSelectedValue(handlers.readTransition());
			return;
		}
		if (sound.value === TRANSITION_SOUND_NONE_VALUE) {
			handlers.applyChange(clearTransitionSound());
		}
	});
	soundFile.addEventListener('change', () => {
		const file = soundFile.files?.[0];
		soundFile.value = '';
		if (!file) {
			return;
		}
		void readSoundFileAsDataUrl(file).then((dataUrl) => {
			if (dataUrl) {
				handlers.applyChange(applyTransitionSoundFile({ name: file.name, dataUrl }));
			}
			return undefined;
		});
	});

	el.appendChild(applyToAll.btn);
	el.appendChild(advance.el);

	const inspector = makeButton(doc, {
		label: t('pptx.ribbon.inspector'),
		icon: 'panel-right',
		textLabel: t('pptx.ribbon.inspector'),
		onClick: onToggleInspector,
	});
	inspector.btn.title = t('pptx.ribbon.openInspectorTransitions');
	el.appendChild(inspector.btn);

	const paint = (): void => {
		paintGallery();
		durationField.setValue(draft.durationSec);
		advance.setValue(draft);
	};
	paint();

	return {
		el,
		sync() {
			// Sound fields (soundFileName/soundRId) live outside `RibbonTransitionDraft`,
			// so a sound-only change would never be seen by `sameDraft` below; repaint
			// it unconditionally rather than gating it on the draft comparison.
			paintSound();
			const next = handlers.readDraft() ?? EMPTY_RIBBON_TRANSITION_DRAFT;
			if (sameDraft(next, draft)) {
				return;
			}
			draft = next;
			paint();
		},
		setEditable(editable) {
			for (const button of buttons) {
				button.handle.setDisabled(!editable);
			}
			durationField.setDisabled(!editable);
			sound.disabled = !editable;
			applyToAll.setDisabled(!editable);
			advance.setDisabled(!editable);
		},
	};
}
