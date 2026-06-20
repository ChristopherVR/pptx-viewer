<script setup lang="ts">
import { Copy, PanelRight, Play } from 'lucide-vue-next';
/**
 * TransitionsSection: the Vue 3 port of React's `TransitionsSection` from
 * `toolbar/DesignTransitionsReviewSection.tsx`. Renders the Transitions ribbon
 * tab: a Preview button, the transition-preset gallery, a duration input, an
 * Apply-to-All button and the Inspector toggle. A faithful, mechanical port for
 * visual + behavioral parity: class strings are copied verbatim, and React's
 * `useState` for the selected preset / duration becomes local `ref`s.
 */
import { ref } from 'vue';

import { cn } from '../../../utils';
import { ic, ics, pill, SEP } from './ribbon-constants';

const TRANSITION_PRESETS = [
	{ value: 'none', label: 'None' },
	{ value: 'fade', label: 'Fade' },
	{ value: 'push', label: 'Push' },
	{ value: 'wipe', label: 'Wipe' },
	{ value: 'split', label: 'Split' },
	{ value: 'reveal', label: 'Reveal' },
	{ value: 'cut', label: 'Cut' },
	{ value: 'cover', label: 'Cover' },
	{ value: 'uncover', label: 'Uncover' },
] as const;

interface Props {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
}

const props = defineProps<Props>();

const selected = ref('none');
const duration = ref('00.50');
</script>

<template>
	<!-- Preview -->
	<button type="button" :class="pill" title="Preview transition">
		<Play :class="ics" />
		Preview
	</button>

	<div :class="SEP" />

	<!-- Transition preset gallery -->
	<div class="inline-flex items-center gap-0.5 overflow-x-auto max-w-[420px]">
		<button
			v-for="t in TRANSITION_PRESETS"
			:key="t.value"
			type="button"
			:class="
				cn(
					'flex-shrink-0 px-2 py-1 max-md:min-h-[44px] rounded border text-[11px] leading-tight transition-colors',
					selected === t.value
						? 'border-primary bg-primary/10 text-primary font-medium'
						: 'border-border bg-muted hover:bg-accent text-foreground',
				)
			"
			:title="`${t.label} transition`"
			@click="selected = t.value"
		>
			{{ t.label }}
		</button>
	</div>

	<div :class="SEP" />

	<!-- Duration -->
	<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
		<span class="whitespace-nowrap">Duration:</span>
		<input
			v-model="duration"
			type="text"
			class="w-14 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground text-center"
			title="Transition duration in seconds"
		/>
	</label>

	<div :class="SEP" />

	<!-- Apply to All -->
	<button type="button" :class="pill" title="Apply transition to all slides">
		<Copy :class="ics" />
		Apply to All
	</button>

	<div :class="SEP" />

	<!-- Inspector -->
	<button
		type="button"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		title="Open Inspector for full transition options"
		@click="props.onToggleInspector()"
	>
		<PanelRight :class="ic" />
		Inspector
	</button>
</template>
