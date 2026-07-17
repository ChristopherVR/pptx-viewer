<script setup lang="ts">
/**
 * SettingsAppearanceTab - File ▸ Options ▸ Appearance.
 *
 * A swatch-button gallery over the viewer chrome's theme catalog (see
 * `pptx-viewer-shared`'s `THEME_CATALOG`), extracted out of `SettingsDialog.vue`
 * to keep that file under the repo's ~300-LOC guideline. Generalizes the
 * theme-swatch idiom used by the vanilla binding's Design tab
 * (`design-tab.ts`) and the Svelte binding's `theme-swatches.ts`, restyled to
 * this dialog's existing Tailwind visual language.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ThemeCatalogEntry } from '../../theme';
import { THEME_CATALOG } from '../../theme';

const props = defineProps<{
	/** Key of the currently active theme-catalog entry. */
	themeKey: string;
	/** Theme choices to offer; defaults to the built-in `THEME_CATALOG`. */
	catalog?: ThemeCatalogEntry[];
	/** Invoked with the entry's `key` when the user picks a swatch. */
	onSelect: (key: string) => void;
}>();

const { t } = useI18n();

const entries = computed(() => props.catalog ?? THEME_CATALOG);

/** A representative swatch color: the entry's primary color, or a neutral gray for the built-in default. */
function swatchColor(entry: ThemeCatalogEntry): string {
	return entry.theme?.colors?.primary ?? '#6b7280';
}
</script>

<template>
	<div class="pptx-vue-settings-panel flex max-h-[56vh] flex-col gap-1.5 overflow-y-auto p-1">
		<button
			v-for="entry in entries"
			:key="entry.key"
			type="button"
			class="pptx-vue-settings-theme-swatch flex items-center gap-3 rounded border px-3 py-2 text-left text-[13px] transition-colors"
			:class="
				themeKey === entry.key
					? 'pptx-vue-settings-theme-swatch--active border-primary bg-accent text-foreground'
					: 'border-border text-foreground hover:bg-accent/60'
			"
			:aria-pressed="themeKey === entry.key"
			@click="onSelect(entry.key)"
		>
			<span
				class="pptx-vue-settings-theme-swatch-preview inline-block size-6 shrink-0 rounded-full border border-border"
				:style="{ background: swatchColor(entry) }"
				aria-hidden="true"
			/>
			{{ t(entry.labelKey) }}
		</button>
	</div>
</template>
