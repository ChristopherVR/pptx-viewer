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
	<div v-if="visible" class="pptx-vue-subtitle-bar">
		<div class="pptx-vue-subtitle-inner">
			<p class="pptx-vue-subtitle-text">{{ renderedText }}</p>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-subtitle-bar {
	position: absolute;
	bottom: 56px;
	left: 50%;
	transform: translateX(-50%);
	z-index: 70;
	max-width: 80%;
	min-width: 300px;
}

.pptx-vue-subtitle-inner {
	padding: 12px 24px;
	border-radius: 8px;
	background: rgba(0, 0, 0, 0.75);
	backdrop-filter: blur(4px);
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.pptx-vue-subtitle-text {
	margin: 0;
	text-align: center;
	font-size: 15px;
	font-style: italic;
	color: rgba(255, 255, 255, 0.7);
}
</style>
