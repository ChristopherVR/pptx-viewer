<script setup lang="ts">
import { Copy, PanelRight, Play } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, ics, pill, SEP } from './ribbon-constants';

const TRANSITION_PRESETS = [
	{ value: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ value: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ value: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ value: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ value: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ value: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ value: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ value: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ value: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
] as const;

interface Props {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

const selected = ref('none');
const duration = ref('00.50');
const advanceOnClick = ref(true);
const advanceAfter = ref(false);
const advanceAfterSeconds = ref('00:00.00');
</script>

<template>
	<!-- Preview -->
	<button type="button" :class="pill" :title="t('pptx.ribbon.previewTransition')">
		<Play :class="ics" />
		{{ t('pptx.ribbon.preview') }}
	</button>

	<div :class="SEP" />

	<!-- Transition preset gallery -->
	<div class="inline-flex items-center gap-0.5 overflow-x-auto max-w-[420px]">
		<button
			v-for="preset in TRANSITION_PRESETS"
			:key="preset.value"
			type="button"
			:class="
				cn(
					'flex-shrink-0 px-2 py-1 max-md:min-h-[44px] rounded border text-[11px] leading-tight transition-colors',
					selected === preset.value
						? 'border-primary bg-primary/10 text-primary font-medium'
						: 'border-border bg-muted hover:bg-accent text-foreground',
				)
			"
			:title="t('pptx.ribbon.transitionTitle', { name: t(preset.labelKey) })"
			@click="selected = preset.value"
		>
			{{ t(preset.labelKey) }}
		</button>
	</div>

	<div :class="SEP" />

	<!-- Duration -->
	<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
		<span class="whitespace-nowrap">{{ t('pptx.ribbon.duration') }}</span>
		<input
			v-model="duration"
			type="text"
			class="w-14 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground text-center"
			:title="t('pptx.ribbon.transitionDurationTitle')"
		/>
	</label>

	<div :class="SEP" />

	<!-- Sound -->
	<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
		<span class="whitespace-nowrap">{{ t('pptx.ribbon.sound') }}</span>
		<select class="w-24 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground">
			<option value="none">{{ t('pptx.ribbon.soundNone') }}</option>
		</select>
	</label>

	<div :class="SEP" />

	<!-- Apply to All -->
	<button type="button" :class="pill" :title="t('pptx.ribbon.applyTransitionToAll')">
		<Copy :class="ics" />
		{{ t('pptx.headerFooter.applyToAll') }}
	</button>

	<div :class="SEP" />

	<!-- Advance Slide group -->
	<div class="inline-flex flex-col gap-1 text-xs text-muted-foreground">
		<span class="text-[10px] font-medium text-foreground">{{ t('pptx.ribbon.advanceSlide') }}</span>
		<label class="inline-flex items-center gap-1.5 cursor-pointer">
			<input v-model="advanceOnClick" type="checkbox" class="accent-primary h-3 w-3" />
			<span class="whitespace-nowrap">{{ t('pptx.ribbon.onMouseClick') }}</span>
		</label>
		<label class="inline-flex items-center gap-1.5 cursor-pointer">
			<input v-model="advanceAfter" type="checkbox" class="accent-primary h-3 w-3" />
			<span class="whitespace-nowrap">{{ t('pptx.ribbon.afterDuration') }}</span>
			<input
				v-model="advanceAfterSeconds"
				type="text"
				:disabled="!advanceAfter"
				class="w-16 px-1 py-0.5 rounded border border-border bg-muted text-xs text-foreground text-center disabled:opacity-50"
				:title="t('pptx.ribbon.advanceAfterSeconds')"
			/>
		</label>
	</div>

	<div :class="SEP" />

	<!-- Inspector -->
	<button
		type="button"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.ribbon.openInspectorTransitions')"
		@click="props.onToggleInspector()"
	>
		<PanelRight :class="ic" />
		{{ t('pptx.ribbon.inspector') }}
	</button>
</template>
