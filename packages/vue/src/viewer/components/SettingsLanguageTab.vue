<script setup lang="ts">
/**
 * SettingsLanguageTab - File ▸ Options ▸ Language.
 *
 * A simple list over the resolved locale catalog (every locale the host's
 * `vue-i18n` instance actually has messages registered for, or a
 * host-supplied `availableLocales` override), extracted out of
 * `SettingsDialog.vue` to keep that file under the repo's ~300-LOC guideline.
 */
import type { LocaleCatalogEntry } from '../../i18n';

defineProps<{
	/** Code of the currently active locale. */
	localeCode: string;
	/** Resolved locale choices to offer. */
	locales: LocaleCatalogEntry[];
	/** Invoked with the entry's `code` when the user picks a locale. */
	onSelect: (code: string) => void;
}>();
</script>

<template>
	<div class="pptx-vue-settings-panel flex max-h-[56vh] flex-col gap-1 overflow-y-auto p-1">
		<button
			v-for="entry in locales"
			:key="entry.code"
			type="button"
			class="pptx-vue-settings-locale-row flex items-center justify-between gap-3 rounded px-3 py-2 text-left text-[13px] transition-colors"
			:class="
				localeCode === entry.code
					? 'pptx-vue-settings-locale-row--active bg-accent font-medium text-primary'
					: 'text-foreground hover:bg-accent/60'
			"
			:aria-pressed="localeCode === entry.code"
			@click="onSelect(entry.code)"
		>
			<span>{{ entry.nativeLabel }}</span>
			<span
				v-if="entry.nativeLabel !== entry.label"
				class="pptx-vue-settings-locale-row-label text-xs text-muted-foreground"
			>
				{{ entry.label }}
			</span>
		</button>
	</div>
</template>
