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
	const preview = doc.createElement('video');
	preview.controls = true;
	preview.preload = 'metadata';
	preview.className = 'pptxv-media-preview';
	preview.addEventListener('loadedmetadata', () => {
		handlers.setMediaProperties({
			metadata: {
				duration: Number.isFinite(preview.duration) ? preview.duration : undefined,
				videoWidth: preview.videoWidth || undefined,
				videoHeight: preview.videoHeight || undefined,
			},
		});
	});
	const poster = doc.createElement('img');
	poster.className = 'pptxv-media-poster';
	poster.alt = t('pptx.media.posterFrame');
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
	const bookmarks = textArea(doc, t('pptx.media.bookmarks'));
	bookmarks.control.placeholder = '12.5 | Intro';
	bookmarks.control.addEventListener('change', () =>
		handlers.setMediaProperties({
			bookmarks: rows(bookmarks.control.value)
				.map((row, index) => {
					const [time, label = ''] = row.split('|').map((value) => value.trim());
					return { id: `bookmark-${index + 1}`, time: Number(time), label };
				})
				.filter(({ time }) => Number.isFinite(time)),
		}),
	);
	const captions = textArea(doc, t('pptx.media.captions'));
	captions.control.placeholder = 'en | English | captions | captions.vtt';
	captions.control.addEventListener('change', () =>
		handlers.setMediaProperties({
			captionTracks: rows(captions.control.value).map((row, index) => {
				const [language = '', label = '', kind = 'captions', src = ''] = row
					.split('|')
					.map((value) => value.trim());
				return {
					id: `caption-${index + 1}`,
					language,
					label,
					kind: kind as 'subtitles' | 'captions' | 'descriptions',
					src: src || undefined,
				};
			}),
		}),
	);
	const metadata = doc.createElement('output');
	metadata.className = 'pptxv-media-metadata';
	const toggles = [autoPlay, loop, across, fullScreen, hide];
	el.append(
		preview,
		poster,
		...toggles.map(({ el: node }) => node),
		volume.el,
		speed.el,
		trimStart.el,
		trimEnd.el,
		bookmarks.label,
		captions.label,
		metadata,
	);
	return {
		el,
		update(state: InspectorState) {
			el.hidden = !state.isMedia;
			const media = state.media;
			const source = media?.mediaData ?? '';
			if (preview.src !== source) {
				preview.src = source;
			}
			preview.hidden = !source;
			preview.poster = media?.posterFrameData ?? '';
			poster.src = media?.posterFrameData ?? '';
			poster.hidden = !media?.posterFrameData;
			autoPlay.setValue(media?.autoPlay ?? false);
			loop.setValue(media?.loop ?? false);
			across.setValue(media?.playAcrossSlides ?? false);
			fullScreen.setValue(media?.fullScreen ?? false);
			hide.setValue(media?.hideWhenNotPlaying ?? false);
			volume.setValue((media?.volume ?? 1) * 100);
			speed.setValue(String(media?.playbackSpeed ?? 1));
			trimStart.setValue(media?.trimStartMs ?? 0);
			trimEnd.setValue(media?.trimEndMs ?? 0);
			bookmarks.control.value = (media?.bookmarks ?? [])
				.map(({ time, label }) => `${time} | ${label}`)
				.join('\n');
			captions.control.value = (media?.captionTracks ?? [])
				.map(({ language, label, kind, src }) => `${language} | ${label} | ${kind} | ${src ?? ''}`)
				.join('\n');
			metadata.textContent = media?.metadata
				? `${media.metadata.duration ?? 0}s, ${media.metadata.videoWidth ?? 0} x ${media.metadata.videoHeight ?? 0}, ${media.metadata.codecInfo ?? media.mediaMimeType ?? ''}`
				: (media?.mediaMimeType ?? '');
			for (const control of [...toggles, volume, speed, trimStart, trimEnd]) {
				control.setDisabled(!state.isMedia);
			}
			bookmarks.control.disabled = !state.isMedia;
			captions.control.disabled = !state.isMedia;
		},
	};
}

function textArea(doc: Document, text: string) {
	const label = doc.createElement('label');
	label.textContent = text;
	const control = doc.createElement('textarea');
	control.rows = 3;
	label.appendChild(control);
	return { label, control };
}

function rows(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((row) => row.trim())
		.filter(Boolean);
}
