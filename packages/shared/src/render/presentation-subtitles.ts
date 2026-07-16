export interface SpeechAlternative {
	readonly transcript: string;
	readonly confidence: number;
}

export interface SpeechResult {
	readonly isFinal: boolean;
	readonly length: number;
	readonly [index: number]: SpeechAlternative;
}

export interface SpeechResultList {
	readonly length: number;
	readonly [index: number]: SpeechResult;
}

export interface SpeechRecognitionEventLite {
	readonly resultIndex: number;
	readonly results: SpeechResultList;
}

export interface SpeechRecognitionLite extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEventLite) => void) | null;
	onerror: ((event: Event) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLite;
export type SpeechSupportState = 'unknown' | 'supported' | 'unsupported';

export function mergeCaptionResults(resultIndex: number, results: SpeechResultList): string {
	let finalText = '';
	let interimText = '';
	for (let index = resultIndex; index < results.length; index++) {
		const result = results[index];
		const fragment = result?.[0]?.transcript ?? '';
		if (result?.isFinal) {
			finalText += fragment;
		} else {
			interimText += fragment;
		}
	}
	return `${finalText} ${interimText}`.trim();
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
	const source = globalThis as Record<string, unknown>;
	return (source['SpeechRecognition'] ??
		source['webkitSpeechRecognition'] ??
		null) as SpeechRecognitionCtor | null;
}

export function captionDisplayText(
	supportState: SpeechSupportState,
	captionText: string,
	fallbackNotSupported: string,
	fallbackListening: string,
): string {
	if (supportState === 'unsupported') {
		return fallbackNotSupported;
	}
	return captionText.length > 0 ? captionText : fallbackListening;
}
