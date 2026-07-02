<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { formatRehearseMs } from '../composables/useRehearseTimings';

const { t } = useI18n();

/**
 * RehearseTimingsHud - floating timing overlay shown during rehearsal mode.
 * Displays per-slide time, total elapsed time, and a pause/resume button. Vue
 * port of the React `RehearseTimingsHud`.
 *
 * The live ticking is owned by {@link useRehearseTimings}; this component is
 * presentational and renders the supplied elapsed values.
 */
defineProps<{
	/** Live elapsed time (ms) on the current slide. */
	slideElapsedMs: number;
	/** Live total elapsed time (ms) since the presentation started. */
	totalElapsedMs: number;
	/** Whether the rehearsal timer is paused. */
	paused: boolean;
}>();

const emit = defineEmits<{
	(e: 'toggle-pause'): void;
}>();
</script>

<template>
	<div
		class="pptx-vue-rehearse-hud fixed bottom-4 left-4 z-[9999] flex items-center gap-3 rounded-lg bg-black/80 px-4 py-2 text-white shadow-xl backdrop-blur-sm select-none"
		data-testid="rehearse-hud"
	>
		<div class="pptx-vue-rehearse-col flex flex-col text-xs leading-tight">
			<span class="pptx-vue-rehearse-label text-white/60">{{ t('pptx.rehearse.slideTime') }}</span>
			<span
				class="pptx-vue-rehearse-value text-lg font-mono tabular-nums"
				data-testid="rehearse-slide-time"
			>
				{{ formatRehearseMs(slideElapsedMs) }}
			</span>
		</div>
		<div class="pptx-vue-rehearse-divider w-px h-8 bg-white/20" />
		<div class="pptx-vue-rehearse-col flex flex-col text-xs leading-tight">
			<span class="pptx-vue-rehearse-label text-white/60">{{ t('pptx.rehearse.totalTime') }}</span>
			<span
				class="pptx-vue-rehearse-value text-lg font-mono tabular-nums"
				data-testid="rehearse-total-time"
			>
				{{ formatRehearseMs(totalElapsedMs) }}
			</span>
		</div>
		<button
			type="button"
			class="pptx-vue-rehearse-pause ml-1 flex items-center justify-center rounded p-1.5 text-sm transition-colors hover:bg-white/20"
			:title="paused ? t('pptx.rehearse.resume') : t('pptx.rehearse.pause')"
			:aria-label="paused ? t('pptx.rehearse.resume') : t('pptx.rehearse.pause')"
			@click="emit('toggle-pause')"
		>
			{{ paused ? '▶' : '⏸' }}
		</button>
	</div>
</template>
