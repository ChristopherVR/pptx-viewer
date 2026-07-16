import type { Translator } from '../../i18n';
import { makeNumberField } from '../controls';
import { makeCheckboxField, makeRangeField, makeSelectField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

export function createMediaSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
) {
	const el = section(t('pptx.media.title'));
	const autoPlay = makeCheckboxField(doc, {
		label: t('pptx.media.autoPlay'),
		onChange: (enabled) => handlers.setMediaProperties({ autoPlay: enabled }),
	});
	const loop = makeCheckboxField(doc, {
		label: t('pptx.media.loop'),
		onChange: (enabled) => handlers.setMediaProperties({ loop: enabled }),
	});
	const across = makeCheckboxField(doc, {
		label: t('pptx.media.playAcrossSlides'),
		onChange: (playAcrossSlides) => handlers.setMediaProperties({ playAcrossSlides }),
	});
	const fullScreen = makeCheckboxField(doc, {
		label: t('pptx.media.fullScreen'),
		onChange: (enabled) => handlers.setMediaProperties({ fullScreen: enabled }),
	});
	const hide = makeCheckboxField(doc, {
		label: t('pptx.media.hideWhenNotPlaying'),
		onChange: (hideWhenNotPlaying) => handlers.setMediaProperties({ hideWhenNotPlaying }),
	});
	const volume = makeRangeField(doc, {
		label: t('pptx.media.volume'),
		min: 0,
		max: 100,
		formatValue: (value) => `${Math.round(value)}%`,
		onCommit: (value) => handlers.setMediaProperties({ volume: value / 100 }),
	});
	const speed = makeSelectField(doc, {
		label: t('pptx.media.playbackSpeed'),
		options: [0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({
			value: String(value),
			label: `${value}x`,
		})),
		onChange: (value) => handlers.setMediaProperties({ playbackSpeed: Number(value) }),
	});
	const trimStart = makeNumberField(doc, {
		label: t('pptx.media.trimStart'),
		min: 0,
		onCommit: (trimStartMs) => handlers.setMediaProperties({ trimStartMs }),
	});
	const trimEnd = makeNumberField(doc, {
		label: t('pptx.media.trimEnd'),
		min: 0,
		onCommit: (trimEndMs) => handlers.setMediaProperties({ trimEndMs }),
	});
	const toggles = [autoPlay, loop, across, fullScreen, hide];
	el.append(...toggles.map(({ el: node }) => node), volume.el, speed.el, trimStart.el, trimEnd.el);
	return {
		el,
		update(state: InspectorState) {
			el.hidden = !state.isMedia;
			const media = state.media;
			autoPlay.setValue(media?.autoPlay ?? false);
			loop.setValue(media?.loop ?? false);
			across.setValue(media?.playAcrossSlides ?? false);
			fullScreen.setValue(media?.fullScreen ?? false);
			hide.setValue(media?.hideWhenNotPlaying ?? false);
			volume.setValue((media?.volume ?? 1) * 100);
			speed.setValue(String(media?.playbackSpeed ?? 1));
			trimStart.setValue(media?.trimStartMs ?? 0);
			trimEnd.setValue(media?.trimEndMs ?? 0);
			for (const control of [...toggles, volume, speed, trimStart, trimEnd]) {
				control.setDisabled(!state.isMedia);
			}
		},
	};
}
