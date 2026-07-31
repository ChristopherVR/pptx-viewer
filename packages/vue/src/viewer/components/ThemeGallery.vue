<script setup lang="ts">
import { X } from 'lucide-vue-next';
/**
 * ThemeGallery - Design ▸ Themes. The Vue 3 port of React's
 * `toolbar/ThemeGallery`: a centered modal of the built-in gallery themes
 * (Office / Facet / Ion / …) shown as colour-preview thumbnails. Selecting a
 * thumbnail highlights it; the footer Apply button then emits `apply(preset)`
 * so the host re-themes the deck via core's `applyThemeToData`. Mirrors React's
 * select-then-apply flow, header (title + description), and Cancel/Apply footer;
 * class strings are copied verbatim for visual parity.
 *
 * The gallery set comes from `theme-gallery-presets` so it matches React's
 * exact 10-theme list/order (adds wisp/berlin/slice/dividend, omits core's
 * slate/metropolitan) rather than core's raw `THEME_PRESETS`.
 */
import type { PptxThemePreset } from 'pptx-viewer-core';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { GALLERY_THEME_PRESETS } from './theme-gallery-presets';
import ThemeThumbnail from './ThemeThumbnail.vue';

const { t } = useI18n();

const props = withDefaults(
	defineProps<{ open: boolean; activeName?: string; canEdit?: boolean }>(),
	{ canEdit: true },
);
const emit = defineEmits<{ apply: [preset: PptxThemePreset]; close: [] }>();

/** Currently highlighted preset id (select-then-apply, mirroring React). */
const selectedId = ref<string | null>(null);

/** Seed the selection from the active theme each time the gallery opens. */
watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			selectedId.value = GALLERY_THEME_PRESETS.find((p) => p.name === props.activeName)?.id ?? null;
		}
	},
	{ immediate: true },
);

function handleApply(): void {
	const preset = GALLERY_THEME_PRESETS.find((p) => p.id === selectedId.value);
	if (preset) {
		emit('apply', preset);
		emit('close');
	}
}
</script>

<template>
	<Teleport to="body">
		<template v-if="props.open">
			<!-- Backdrop -->
			<button
				type="button"
				class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
				:aria-label="t('pptx.common.close')"
				@click="emit('close')"
			/>

			<!-- Modal -->
			<div class="fixed inset-0 z-[101] flex items-center justify-center p-4">
				<div
					class="bg-background border border-border rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col"
					role="dialog"
					:aria-label="t('pptx.themes.gallery.ariaLabel')"
				>
					<!-- Header -->
					<div class="flex items-center justify-between px-6 py-4 border-b border-border">
						<div>
							<h2 class="text-lg font-semibold text-foreground">
								{{ t('pptx.themes.gallery.title') }}
							</h2>
							<p class="text-xs text-muted-foreground mt-0.5">
								{{ t('pptx.themes.gallery.description') }}
							</p>
						</div>
						<button
							type="button"
							class="p-2 rounded hover:bg-accent transition-colors"
							:aria-label="t('pptx.common.close')"
							@click="emit('close')"
						>
							<X class="w-5 h-5" />
						</button>
					</div>

					<!-- Content -->
					<div class="flex-1 overflow-auto p-6">
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							<ThemeThumbnail
								v-for="preset in GALLERY_THEME_PRESETS"
								:key="preset.id"
								:theme="preset"
								:selected="selectedId === preset.id"
								@select="selectedId = preset.id"
							/>
						</div>
					</div>

					<!-- Footer -->
					<div class="flex items-center justify-end px-6 py-4 border-t border-border gap-2">
						<button
							type="button"
							class="px-3 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs font-medium text-foreground transition-colors"
							@click="emit('close')"
						>
							{{ t('pptx.common.cancel') }}
						</button>
						<button
							type="button"
							:disabled="!props.canEdit || !selectedId"
							class="px-3 py-1.5 rounded bg-primary hover:bg-primary/80 text-xs font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
							@click="handleApply"
						>
							{{ t('pptx.common.apply') }}
						</button>
					</div>
				</div>
			</div>
		</template>
	</Teleport>
</template>
