<script setup lang="ts">
import { Check } from 'lucide-vue-next';
/**
 * ThemeGallery — Design ▸ Themes. A teleported overlay of the core
 * `THEME_PRESETS` (Office / Facet / Ion / …) shown as accent-swatch thumbnails;
 * clicking one emits `apply(preset)` so the host re-themes the deck via core's
 * `applyThemeToData`. Vue port of React's `toolbar/ThemeGallery`.
 */
import { THEME_PRESETS } from 'pptx-viewer-core';
import type { PptxThemePreset } from 'pptx-viewer-core';

const props = defineProps<{ open: boolean; activeName?: string }>();
const emit = defineEmits<{ apply: [preset: PptxThemePreset]; close: [] }>();

/** Six representative swatches for a preset thumbnail (dark2 + accents 1–5). */
function accents(p: PptxThemePreset): string[] {
	const c = p.colorScheme;
	return [c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5];
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="props.open"
			class="fixed inset-0 z-[1100] flex items-start justify-center bg-black/40 pt-20"
			@click.self="emit('close')"
		>
			<div
				class="w-[640px] max-w-[90vw] rounded-lg border border-border bg-popover shadow-2xl p-4"
				role="dialog"
				aria-label="Theme gallery"
			>
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-semibold text-foreground">Themes</h2>
					<button
						type="button"
						class="text-xs text-muted-foreground hover:text-foreground"
						@click="emit('close')"
					>
						Close
					</button>
				</div>
				<div class="grid grid-cols-4 gap-2">
					<button
						v-for="p in THEME_PRESETS"
						:key="p.id"
						type="button"
						class="group relative flex flex-col rounded border border-border bg-card hover:border-primary transition-colors overflow-hidden"
						:title="p.name"
						@click="emit('apply', p)"
					>
						<div class="h-12 flex" :style="{ backgroundColor: p.colorScheme.lt1 }">
							<span
								v-for="(c, i) in accents(p)"
								:key="i"
								class="flex-1"
								:style="{ backgroundColor: c }"
							/>
						</div>
						<span class="px-1.5 py-1 text-[11px] text-foreground truncate text-left">{{
							p.name
						}}</span>
						<Check
							v-if="props.activeName === p.name"
							class="absolute top-1 right-1 w-3.5 h-3.5 text-primary"
						/>
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
