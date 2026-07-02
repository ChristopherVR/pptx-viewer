<!--
	Animations ribbon section: Vue port of React's `toolbar/AnimationsSection.tsx`.
	Faithful, mechanical port for visual + behavioral parity: a Preview button with
	a transient active flash, a hover-revealed "Add Animation" preset menu, a
	Remove button, and an Animation-Panel toggle. Class strings copied verbatim.
-->
<script setup lang="ts">
import { ChevronDown, PanelRight, Play, Sparkles, Trash2 } from 'lucide-vue-next';
import type { PptxElement } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, pill, SEP } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	/** Opens the inspector and switches to properties tab to show the animation panel. */
	onOpenAnimationPanel?: () => void;
	/** Adds an animation preset to the selected element. */
	onAddAnimation?: (preset: string, group: 'entrance' | 'emphasis' | 'exit') => void;
	/** Removes all animations from the selected element. */
	onRemoveAnimation?: () => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

/* Preset categories shown in the "Add Animation" dropdown. */
const ANIMATION_PRESETS = [
	{
		group: 'Entrance',
		items: [
			{ value: 'appear', label: 'Appear' },
			{ value: 'fadeIn', label: 'Fade In' },
			{ value: 'flyIn', label: 'Fly In' },
		],
	},
	{
		group: 'Emphasis',
		items: [
			{ value: 'pulse', label: 'Pulse' },
			{ value: 'spin', label: 'Spin' },
		],
	},
	{
		group: 'Exit',
		items: [
			{ value: 'disappear', label: 'Disappear' },
			{ value: 'fadeOut', label: 'Fade Out' },
		],
	},
] as const;

const previewActive = ref(false);
const hasElement = computed(() => props.selectedElement !== null);
const disabled = computed(() => !props.canEdit || !hasElement.value);

function handlePreview(): void {
	if (disabled.value) {
		return;
	}
	previewActive.value = true;
	// Reset after a short delay to re-enable the button
	setTimeout(() => {
		previewActive.value = false;
	}, 1200);
}
</script>

<template>
	<!-- Preview -->
	<button
		type="button"
		:disabled="disabled"
		:class="cn(pill, previewActive ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.animations.previewTooltip')"
		@click="handlePreview"
	>
		<Play :class="ic" />
		{{ t('pptx.animations.preview') }}
	</button>

	<div :class="SEP" />

	<!-- Add Animation dropdown -->
	<div class="relative group">
		<button
			type="button"
			:disabled="disabled"
			:class="pill"
			:title="t('pptx.animations.addTooltip')"
		>
			<Sparkles :class="ic" />
			{{ t('pptx.animations.addAnimation') }}
			<ChevronDown class="w-3 h-3" />
		</button>
		<div class="absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-44 pt-1">
			<div class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1">
				<template v-for="group in ANIMATION_PRESETS" :key="group.group">
					<div
						class="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
					>
						{{ t('pptx.animations.group.' + group.group.toLowerCase()) }}
					</div>
					<button
						v-for="item in group.items"
						:key="item.value"
						type="button"
						:disabled="disabled"
						class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						:title="
							t('pptx.animations.applyAnimation', {
								name: t('pptx.animations.preset.' + item.value),
							})
						"
						@click="
							props.onAddAnimation?.(
								item.value,
								group.group.toLowerCase() as 'entrance' | 'emphasis' | 'exit',
							)
						"
					>
						{{ t('pptx.animations.preset.' + item.value) }}
					</button>
				</template>
			</div>
		</div>
	</div>

	<div :class="SEP" />

	<!-- Remove Animation -->
	<button
		type="button"
		:disabled="disabled"
		:class="pill"
		:title="t('pptx.animations.removeTooltip')"
		@click="props.onRemoveAnimation"
	>
		<Trash2 :class="ic" />
		{{ t('pptx.animations.remove') }}
	</button>

	<div :class="SEP" />

	<!-- Animation Panel toggle -->
	<button
		type="button"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.animations.openPanelTooltip')"
		@click="(props.onOpenAnimationPanel ?? props.onToggleInspector)()"
	>
		<PanelRight :class="ic" />
		{{ t('pptx.animations.animationPanel') }}
	</button>
</template>
