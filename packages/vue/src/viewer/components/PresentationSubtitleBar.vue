<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

/**
 * PresentationSubtitleBar — live subtitle/caption bar shown during presentation
 * mode. Uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
 * when available and falls back to a "not supported" message otherwise. Vue port
 * of the React `PresentationSubtitleBar`.
 *
 * Recognition runs only while `visible` is true; toggling `visible` off stops
 * the recogniser and clears the caption.
 */

interface SpeechRecognitionAlternativeLite {
	transcript: string;
	confidence: number;
}

interface SpeechRecognitionResultLite {
	readonly isFinal: boolean;
	readonly length: number;
	item(index: number): SpeechRecognitionAlternativeLite;
	[index: number]: SpeechRecognitionAlternativeLite;
}

interface SpeechRecognitionResultListLite {
	readonly length: number;
	item(index: number): SpeechRecognitionResultLite;
	[index: number]: SpeechRecognitionResultLite;
}

interface SpeechRecognitionEventLite extends Event {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultListLite;
}

interface SpeechRecognitionLite extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEventLite) => void) | null;
	onerror: ((event: Event) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLite;

interface WindowWithSpeechRecognition {
	SpeechRecognition?: SpeechRecognitionCtor;
	webkitSpeechRecognition?: SpeechRecognitionCtor;
}

const props = defineProps<{
	visible: boolean;
}>();

const captionText = ref('');
const supportState = ref<'unknown' | 'supported' | 'unsupported'>('unknown');

let recognition: SpeechRecognitionLite | null = null;
let shouldRun = false;

function stopRecognition(): void {
	shouldRun = false;
	recognition?.stop();
	recognition = null;
}

function startRecognition(): void {
	if (typeof window === 'undefined') {
		supportState.value = 'unsupported';
		return;
	}
	shouldRun = true;
	const speechWindow = window as unknown as WindowWithSpeechRecognition;
	const RecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
	if (!RecognitionCtor) {
		supportState.value = 'unsupported';
		return;
	}
	supportState.value = 'supported';

	const recog = new RecognitionCtor();
	recog.continuous = true;
	recog.interimResults = true;
	recog.lang = navigator.language || 'en-US';

	recog.onresult = (event: SpeechRecognitionEventLite): void => {
		let finalText = '';
		let interimText = '';
		for (let index = event.resultIndex; index < event.results.length; index += 1) {
			const result = event.results[index];
			const fragment = result?.[0]?.transcript ?? '';
			if (result?.isFinal) {
				finalText += fragment;
			} else {
				interimText += fragment;
			}
		}
		const merged = `${finalText} ${interimText}`.trim();
		if (merged.length > 0) {
			captionText.value = merged;
		}
	};

	recog.onerror = (): void => {
		// Keep the bar active; `onend` attempts a restart while visible.
	};
	recog.onend = (): void => {
		if (!shouldRun) {
			return;
		}
		try {
			recog.start();
		} catch {
			// Browser may throttle rapid restarts; next visibility toggle retries.
		}
	};

	recognition = recog;
	try {
		recog.start();
	} catch {
		supportState.value = 'unsupported';
	}
}

watch(
	() => props.visible,
	(visible) => {
		if (!visible) {
			stopRecognition();
			captionText.value = '';
			return;
		}
		startRecognition();
	},
	{ immediate: true },
);

onBeforeUnmount(stopRecognition);

const renderedText = computed<string>(() => {
	if (supportState.value === 'unsupported') {
		return 'Live captions are not supported in this browser.';
	}
	return captionText.value.length > 0 ? captionText.value : 'Listening…';
});
</script>

<template>
	<div
		v-if="visible"
		class="pptx-vue-subtitle-bar absolute bottom-14 left-1/2 z-[70] max-w-[80%] min-w-[300px] -translate-x-1/2"
	>
		<div
			class="pptx-vue-subtitle-inner rounded-lg border border-white/10 bg-black/75 px-6 py-3 backdrop-blur-sm"
		>
			<p class="pptx-vue-subtitle-text m-0 text-center text-[15px] italic text-white/70">
				{{ renderedText }}
			</p>
		</div>
	</div>
</template>
