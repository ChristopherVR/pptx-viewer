<script setup lang="ts">
import { formatRehearseMs } from '../composables/useRehearseTimings';

/**
 * RehearseTimingsHud — floating timing overlay shown during rehearsal mode.
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
	<div class="pptx-vue-rehearse-hud" data-testid="rehearse-hud">
		<div class="pptx-vue-rehearse-col">
			<span class="pptx-vue-rehearse-label">Slide time</span>
			<span class="pptx-vue-rehearse-value" data-testid="rehearse-slide-time">
				{{ formatRehearseMs(slideElapsedMs) }}
			</span>
		</div>
		<div class="pptx-vue-rehearse-divider" />
		<div class="pptx-vue-rehearse-col">
			<span class="pptx-vue-rehearse-label">Total time</span>
			<span class="pptx-vue-rehearse-value" data-testid="rehearse-total-time">
				{{ formatRehearseMs(totalElapsedMs) }}
			</span>
		</div>
		<button
			type="button"
			class="pptx-vue-rehearse-pause"
			:title="paused ? 'Resume' : 'Pause'"
			:aria-label="paused ? 'Resume' : 'Pause'"
			@click="emit('toggle-pause')"
		>
			{{ paused ? '▶' : '⏸' }}
		</button>
	</div>
</template>

<style scoped>
.pptx-vue-rehearse-hud {
	position: fixed;
	bottom: 16px;
	left: 16px;
	z-index: 2147483646;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 16px;
	border-radius: 8px;
	background: rgba(0, 0, 0, 0.8);
	backdrop-filter: blur(4px);
	color: #ffffff;
	box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
	user-select: none;
	font-family:
		system-ui,
		-apple-system,
		sans-serif;
}

.pptx-vue-rehearse-col {
	display: flex;
	flex-direction: column;
	line-height: 1.2;
}

.pptx-vue-rehearse-label {
	font-size: 11px;
	color: rgba(255, 255, 255, 0.6);
}

.pptx-vue-rehearse-value {
	font-size: 18px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
}

.pptx-vue-rehearse-divider {
	width: 1px;
	height: 32px;
	background: rgba(255, 255, 255, 0.2);
}

.pptx-vue-rehearse-pause {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	margin-left: 4px;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: #ffffff;
	font-size: 14px;
	cursor: pointer;
	transition: background-color 0.15s;
}

.pptx-vue-rehearse-pause:hover {
	background: rgba(255, 255, 255, 0.2);
}
</style>
