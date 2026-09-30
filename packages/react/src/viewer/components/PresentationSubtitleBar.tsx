/**
 * PresentationSubtitleBar
 *
 * Shows a live subtitle/caption bar during presentation mode.
 * Uses Web Speech API when available and falls back to a
 * localized "not supported" message otherwise.
 */
import {
	getSpeechRecognitionCtor,
	mergeCaptionResults,
	subtitleRecognitionLanguage,
	subtitleSettingsFromOptions,
} from 'pptx-viewer-shared';
import type { SpeechRecognitionLite, SpeechRecognitionEventLite } from 'pptx-viewer-shared';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useViewerOptionsContext } from './viewer-options-context';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationSubtitleBarProps {
	visible: boolean;
	onCaptionChange?: (caption: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationSubtitleBar({
	visible,
	onCaptionChange,
}: PresentationSubtitleBarProps): React.ReactElement | null {
	const { t } = useTranslation();
	const language = subtitleRecognitionLanguage(
		subtitleSettingsFromOptions(useViewerOptionsContext()),
		typeof navigator === 'undefined' ? 'en-US' : navigator.language,
	);
	const [captionText, setCaptionText] = useState<string>('');
	const [supportState, setSupportState] = useState<'unknown' | 'supported' | 'unsupported'>(
		'unknown',
	);
	const recognitionRef = useRef<SpeechRecognitionLite | null>(null);
	const shouldRunRef = useRef<boolean>(false);

	useEffect(() => {
		if (!visible) {
			shouldRunRef.current = false;
			recognitionRef.current?.stop();
			recognitionRef.current = null;
			setCaptionText('');
			return;
		}

		shouldRunRef.current = true;
		const RecognitionCtor = getSpeechRecognitionCtor();
		if (!RecognitionCtor) {
			setSupportState('unsupported');
			return;
		}
		setSupportState('supported');

		const recognition = new RecognitionCtor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = language;

		recognition.onresult = (event: SpeechRecognitionEventLite) => {
			const merged = mergeCaptionResults(event.resultIndex, event.results);
			if (merged.length > 0) {
				setCaptionText(merged);
				onCaptionChange?.(merged);
			}
		};

		recognition.onerror = () => {
			// Keep the bar active and let `onend` attempt restart while visible.
		};
		recognition.onend = () => {
			if (!shouldRunRef.current) {
				return;
			}
			try {
				recognition.start();
			} catch {
				// Browser may throttle rapid restarts; next visibility toggle retries.
			}
		};

		recognitionRef.current = recognition;
		try {
			recognition.start();
		} catch {
			setSupportState('unsupported');
		}

		return () => {
			shouldRunRef.current = false;
			recognition.stop();
			recognitionRef.current = null;
		};
	}, [visible, onCaptionChange, language]);

	if (!visible) {
		return null;
	}

	const renderedText =
		supportState === 'unsupported'
			? t('pptx.subtitles.notSupported')
			: captionText.length > 0
				? captionText
				: t('pptx.subtitles.listening');

	return (
		<div className='absolute bottom-14 left-1/2 -translate-x-1/2 z-[70] max-w-[80%] min-w-[300px]'>
			<div className='px-6 py-3 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10'>
				<p className='text-center text-[15px] text-white/70 italic'>{renderedText}</p>
			</div>
		</div>
	);
}
