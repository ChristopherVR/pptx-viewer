import { getSpeechRecognitionCtor, mergeCaptionResults } from 'pptx-viewer-shared';
import type { SpeechRecognitionLite } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';

/**
 * Live captions for the presenter console, over the Web Speech API.
 *
 * Lifted out of the old `mountPresenterConsole` so the console itself is pure
 * view: the recogniser outlives individual console mounts (a chrome remount on
 * a locale change must not silence a running caption stream), and its two user
 * messages were the last hard-coded English strings in the presenter path.
 *
 * @module viewer/presenter/presenter-captions
 */

/** A running caption session. */
export interface PresenterCaptions {
	/** Whether captions are currently on. */
	isActive: () => boolean;
	/** Turn captions on or off; returns the new state. */
	toggle: () => boolean;
	/** Stop and release the recogniser. */
	dispose: () => void;
}

export interface PresenterCaptionsOptions {
	doc: Document;
	t: Translator;
	/** Publish caption text (or `undefined` to clear) onto the shared snapshot. */
	emit: (patch: { subtitlesVisible: boolean; caption?: string }) => void;
}

export function createPresenterCaptions(options: PresenterCaptionsOptions): PresenterCaptions {
	let recognition: SpeechRecognitionLite | null = null;
	let active = false;

	const stop = (): void => {
		active = false;
		recognition?.stop();
		recognition = null;
	};

	const start = (): void => {
		const Ctor = getSpeechRecognitionCtor();
		if (!Ctor) {
			// Not an error state: the console stays usable, it just says so.
			options.emit({ subtitlesVisible: true, caption: options.t('pptx.subtitles.notSupported') });
			return;
		}
		recognition = new Ctor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = options.doc.documentElement.lang || 'en-US';
		recognition.onresult = (event) =>
			options.emit({
				subtitlesVisible: true,
				caption: mergeCaptionResults(event.resultIndex, event.results),
			});
		recognition.onerror = () =>
			options.emit({ subtitlesVisible: true, caption: options.t('pptx.subtitles.notSupported') });
		recognition.onend = () => {
			// The browser stops the stream on its own schedule (silence, tab
			// focus); restart while the presenter still wants captions.
			if (!active) {
				return;
			}
			try {
				recognition?.start();
			} catch {
				/* browser controls restart timing */
			}
		};
		recognition.start();
	};

	return {
		isActive: () => active,
		toggle: () => {
			if (active) {
				stop();
				options.emit({ subtitlesVisible: false, caption: undefined });
				return false;
			}
			active = true;
			options.emit({ subtitlesVisible: true, caption: '' });
			start();
			return true;
		},
		dispose: stop,
	};
}
