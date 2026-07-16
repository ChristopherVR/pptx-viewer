<script setup lang="ts">
import {
	captionDisplayText,
	getSpeechRecognitionCtor,
	mergeCaptionResults,
} from 'pptx-viewer-shared';
import type {
	SpeechRecognitionEventLite,
	SpeechRecognitionLite,
	SpeechSupportState,
} from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * PresentationSubtitleBar - live subtitle/caption bar shown during presentation
 * mode. Uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
 * when available and falls back to a "not supported" message otherwise. Vue port
 * of the React `PresentationSubtitleBar`.
 *
 * Recognition runs only while `visible` is true; toggling `visible` off stops
 * the recogniser and clears the caption.
 */

const props = defineProps<{
	visible: boolean;
}>();

const { t } = useI18n();

const captionText = ref('');
const supportState = ref<SpeechSupportState>('unknown');

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
	const RecognitionCtor = getSpeechRecognitionCtor();
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
		const merged = mergeCaptionResults(event.resultIndex, event.results);
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

const renderedText = computed<string>(() =>
	captionDisplayText(
		supportState.value,
		captionText.value,
		t('pptx.subtitles.notSupported'),
		t('pptx.subtitles.listening'),
	),
);
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
