import {
	RIBBON_TRANSITION_PRESETS,
	TRANSITION_DURATION_MAX_SEC,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionSoundOptions,
	transitionSoundSelectedValue,
	transitionStockSoundId,
	transitionsLabel,
} from '../render';
import type { RibbonTransitionsIntent, RibbonTransitionsViewState } from '../render';
import { RIBBON_ICON_PATHS } from './ribbon-icons';

type Request = (intent: RibbonTransitionsIntent) => void;

/** All Transitions markup lives here. The host only reflects state and routes native intents. */
export function createRibbonTransitionsView(doc: Document, request: Request) {
	const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => {
		const el = doc.createElement(tag);
		if (className) {
			el.className = className;
		}
		return el;
	};
	const group = (id: string, ...children: HTMLElement[]) => {
		const el = doc.createElement('pptx-ui-ribbon-group');
		el.dataset.ribbonGroup = id;
		el.append(...children);
		return el;
	};
	const stack = (...children: HTMLElement[]) => {
		const el = make('div', 'stack');
		el.append(...children);
		return el;
	};
	const command = (id: string | undefined, icon: string, intent: RibbonTransitionsIntent) => {
		const el = doc.createElement('pptx-ui-ribbon-command');
		el.setAttribute('compact', '');
		el.setAttribute('icon', icon);
		if (id) {
			el.dataset.ribbonControl = id;
			el.addEventListener('command-request', (event) => {
				event.stopPropagation();
				request(intent);
			});
		} else {
			el.addEventListener('click', () => request(intent));
		}
		return el;
	};
	const field = (id: string, className = 'field') => {
		const el = make('label', className);
		el.dataset.ribbonControl = id;
		return el;
	};
	const preview = command('transitions.preview.preview', 'play', { kind: 'preview' });
	const gallery = make('div', 'gallery');
	gallery.dataset.ribbonControl = 'transitions.transitionToThisSlide.gallery';
	const presets = RIBBON_TRANSITION_PRESETS.map((preset) => {
		const button = make('button', 'preset');
		button.type = 'button';
		// Sized by the shared styles (28px, 44px on touch), not the host's generic button floor.
		button.dataset.pptxCompact = '';
		button.addEventListener('click', () => request({ kind: 'preset', value: preset.type }));
		gallery.append(button);
		return { preset, button };
	});

	let last: RibbonTransitionsViewState | undefined;
	const soundFile = make('input', 'sound-file');
	soundFile.type = 'file';
	soundFile.accept = 'audio/*';
	soundFile.addEventListener('change', () => {
		const file = soundFile.files?.[0];
		soundFile.value = '';
		if (file) {
			request({ kind: 'soundFile', file });
		}
	});
	const soundField = field('transitions.timing.sound');
	const soundText = make('span');
	const sound = make('select');
	sound.addEventListener('change', () => {
		if (sound.value === TRANSITION_SOUND_OTHER_VALUE) {
			soundFile.click();
			// The file input decides what happens next; show what the slide really has.
			sound.value = transitionSoundSelectedValue(last?.transition);
		} else {
			request({ kind: 'sound', value: sound.value });
		}
	});
	const soundPreview = make('button', 'sound-preview');
	soundPreview.type = 'button';
	soundPreview.dataset.pptxCompact = '';
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 20 20');
	svg.setAttribute('aria-hidden', 'true');
	const play = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
	play.setAttribute('d', RIBBON_ICON_PATHS.play);
	svg.append(play);
	soundPreview.append(svg);
	soundPreview.addEventListener('click', () => request({ kind: 'soundPreview' }));
	soundField.append(soundText, sound, soundPreview);

	const durationField = field('transitions.timing.duration');
	const durationText = make('span');
	const duration = make('input');
	duration.type = 'number';
	duration.min = '0';
	duration.max = String(TRANSITION_DURATION_MAX_SEC);
	duration.step = '0.25';
	duration.addEventListener('input', () => {
		const value = Number(duration.value);
		if (duration.value !== '' && Number.isFinite(value)) {
			request({
				kind: 'duration',
				value: Math.min(TRANSITION_DURATION_MAX_SEC, Math.max(0, value)),
			});
		}
	});
	durationField.append(durationText, duration);

	const applyToAll = command('transitions.timing.applyToAll', 'copy', { kind: 'applyToAll' });
	const caption = make('span', 'caption');
	const checkbox = (id: string, intent: (checked: boolean) => RibbonTransitionsIntent) => {
		const row = field(id, 'field check');
		const box = make('input');
		box.type = 'checkbox';
		const text = make('span');
		box.addEventListener('change', () => request(intent(box.checked)));
		row.append(box, text);
		return { row, box, text };
	};
	const onClick = checkbox('transitions.timing.advanceOnClick', (value) => ({
		kind: 'advanceOnClick',
		value,
	}));
	const after = checkbox('transitions.timing.advanceAfter', (value) => ({
		kind: 'advanceAfter',
		value,
	}));
	const afterText = make('input');
	afterText.type = 'text';
	// Half-typed `mm:ss.hh` text must not become a history step per keystroke.
	afterText.addEventListener('change', () =>
		request({ kind: 'advanceAfterText', value: afterText.value }),
	);
	after.row.append(afterText);
	const inspector = command(undefined, 'panelRight', { kind: 'inspector' });
	inspector.classList.add('inspector');

	const groups = {
		preview: group('transitions.preview', preview),
		gallery: group('transitions.transitionToThisSlide', gallery),
		timing: group(
			'transitions.timing',
			stack(soundField, durationField),
			applyToAll,
			stack(caption, onClick.row, after.row),
			soundFile,
		),
	};
	const layout = [groups.preview, groups.gallery, groups.timing, inspector];
	let soundKey = '';
	const sync = (state: RibbonTransitionsViewState) => {
		const text = (key: string, fallback: string, params?: Record<string, string>) =>
			transitionsLabel(state, key, fallback, params);
		last = state;
		const { draft, editable } = state;
		groups.preview.setAttribute('label', text('pptx.ribbon.preview', 'Preview'));
		groups.gallery.setAttribute(
			'label',
			text('pptx.ribbon.transitionToThisSlide', 'Transition to This Slide'),
		);
		groups.timing.setAttribute('label', text('pptx.animations.timing', 'Timing'));
		preview.setAttribute('label', text('pptx.ribbon.preview', 'Preview'));
		preview.setAttribute('title', text('pptx.ribbon.previewTransition', 'Preview transition'));
		for (const { preset, button } of presets) {
			const name = text(preset.labelKey, preset.type[0].toUpperCase() + preset.type.slice(1));
			button.textContent = name;
			button.title = text('pptx.ribbon.transitionTitle', '{{name}} transition', { name });
			button.setAttribute('aria-pressed', String(draft.type === preset.type));
			button.disabled = !editable;
		}
		soundText.textContent = text('pptx.ribbon.sound', 'Sound:');
		sound.setAttribute('aria-label', soundText.textContent);
		const options = transitionSoundOptions(state.transition).map((option) => ({
			value: option.value,
			label: option.i18nKey ? text(option.i18nKey, option.i18nKey) : (option.label ?? option.value),
		}));
		const nextKey = JSON.stringify(options);
		if (nextKey !== soundKey) {
			soundKey = nextKey;
			sound.replaceChildren(
				...options.map((option) => {
					const el = make('option');
					el.value = option.value;
					el.textContent = option.label;
					return el;
				}),
			);
		}
		sound.value = transitionSoundSelectedValue(state.transition);
		sound.disabled = !editable;
		const previewLabel = text('pptx.animation.sound.preview', 'Preview sound');
		soundPreview.setAttribute('aria-label', previewLabel);
		soundPreview.title = previewLabel;
		soundPreview.disabled = !transitionStockSoundId(state.transition);
		durationText.textContent = text('pptx.ribbon.duration', 'Duration:');
		duration.title = text('pptx.ribbon.transitionDurationTitle', 'Transition duration in seconds');
		if (!duration.matches(':focus')) {
			duration.value = String(draft.durationSec);
		}
		duration.disabled = !editable;
		applyToAll.setAttribute('label', text('pptx.headerFooter.applyToAll', 'Apply to All'));
		applyToAll.setAttribute(
			'title',
			text('pptx.ribbon.applyTransitionToAll', 'Apply transition to all slides'),
		);
		applyToAll.toggleAttribute('disabled', !editable);
		caption.textContent = text('pptx.ribbon.advanceSlide', 'Advance Slide');
		onClick.text.textContent = text('pptx.ribbon.onMouseClick', 'On Mouse Click');
		onClick.box.setAttribute('aria-label', onClick.text.textContent);
		onClick.box.checked = draft.advanceOnClick;
		onClick.box.disabled = !editable;
		after.text.textContent = text('pptx.ribbon.afterDuration', 'After:');
		after.box.setAttribute('aria-label', after.text.textContent);
		after.box.checked = draft.advanceAfter;
		after.box.disabled = !editable;
		const secondsLabel = text(
			'pptx.ribbon.advanceAfterSeconds',
			'Advance after specified duration',
		);
		afterText.setAttribute('aria-label', secondsLabel);
		afterText.title = secondsLabel;
		if (!afterText.matches(':focus')) {
			afterText.value = draft.advanceAfterText;
		}
		afterText.disabled = !editable || !draft.advanceAfter;
		inspector.setAttribute('label', text('pptx.ribbon.inspector', 'Inspector'));
		inspector.setAttribute(
			'title',
			text('pptx.ribbon.openInspectorTransitions', 'Open Inspector for full transition options'),
		);
		inspector.setAttribute('pressed', String(Boolean(state.inspectorOpen)));
		inspector.toggleAttribute('active', Boolean(state.inspectorOpen));
	};
	return { layout, sync };
}
