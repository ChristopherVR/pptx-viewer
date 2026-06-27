<script setup lang="ts">
import { Check } from 'lucide-vue-next';
/**
 * ThemeThumbnail: the Vue 3 port of React's `toolbar/ThemeThumbnail.tsx`. Renders
 * a single built-in theme as a colour-preview card (accent header bar + dark/light
 * content area + name footer) with a selected-check indicator. A faithful,
 * mechanical port for visual parity: class strings are copied verbatim and the
 * core `PptxThemePreset` colour scheme drives the swatch backgrounds.
 */
import type { PptxThemePreset } from 'pptx-viewer-core';

import { cn } from '../../utils';

const props = defineProps<{ theme: PptxThemePreset; selected: boolean }>();
const emit = defineEmits<{ select: [] }>();
</script>

<template>
	<button
		type="button"
		:class="
			cn(
				'group relative flex flex-col rounded-lg border-2 transition-all overflow-hidden',
				props.selected
					? 'border-primary shadow-lg scale-[1.02]'
					: 'border-border hover:border-primary/50 hover:shadow-md',
			)
		"
		:title="props.theme.name"
		@click="emit('select')"
	>
		<!-- Color preview bars -->
		<div class="h-24 flex flex-col">
			<!-- Title/header bar with accent colors -->
			<div class="h-10 flex">
				<div class="flex-1" :style="{ backgroundColor: props.theme.colorScheme.accent1 }" />
				<div class="flex-1" :style="{ backgroundColor: props.theme.colorScheme.accent2 }" />
				<div class="flex-1" :style="{ backgroundColor: props.theme.colorScheme.accent3 }" />
			</div>
			<!-- Content area with dark/light colors -->
			<div class="flex-1 flex">
				<div class="w-1/3" :style="{ backgroundColor: props.theme.colorScheme.dk2 }" />
				<div class="flex-1" :style="{ backgroundColor: props.theme.colorScheme.lt2 }" />
			</div>
		</div>

		<!-- Theme name -->
		<div class="bg-background border-t border-border px-2 py-1.5">
			<p class="text-xs font-medium text-foreground text-center">{{ props.theme.name }}</p>
		</div>

		<!-- Selected indicator -->
		<div
			v-if="props.selected"
			class="absolute top-1 right-1 bg-primary text-white rounded-full p-1"
		>
			<Check class="w-3 h-3" />
		</div>
	</button>
</template>
