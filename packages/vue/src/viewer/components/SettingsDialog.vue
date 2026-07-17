<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { LocaleCatalogEntry } from '../../i18n';
import type { ThemeCatalogEntry } from '../../theme';
import ModalDialog from './ModalDialog.vue';
import SettingsAppearanceTab from './SettingsAppearanceTab.vue';
import SettingsLanguageTab from './SettingsLanguageTab.vue';
import type { ViewerSettings } from './viewer-settings';
import { SETTING_TOGGLES, SHORTCUT_REFERENCE_ITEMS } from './viewer-settings';

/**
 * SettingsDialog - viewer/editor preferences on a tabbed `ModalDialog`.
 *
 * Vue counterpart of the React package's `SettingsDialog.tsx`. It exposes the
 * same boolean preferences (autosave, spell-check, show-grid, show-rulers,
 * snap-to-grid, reduced-motion) on a "General" tab, a read-only keyboard
 * "Shortcuts" reference tab, plus "Appearance" (viewer chrome theme catalog)
 * and "Language" (locale catalog) tabs delegating to
 * `SettingsAppearanceTab.vue` / `SettingsLanguageTab.vue`.
 *
 * Where the React dialog threaded each setting through its own prop/callback
 * (and kept `autoSave` as dialog-local state), the Vue port takes the whole
 * `ViewerSettings` object as one `settings` prop and emits a single
 * `update(settings)` with the full next value whenever a toggle flips. The host
 * owns persistence; this component is purely presentational.
 *
 * Theme/locale are not part of `ViewerSettings` (they live in
 * `PowerPointViewer.vue`'s own `themeKey`/`localeCode` refs), so they're
 * threaded as separate props/callbacks rather than folded into `settings`.
 *
 * The form is seeded from `settings` each time the dialog opens, so a host can
 * pass a live reactive object or re-feed it on every open; both work.
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Current viewer settings. */
	settings: ViewerSettings;
	/** Key of the currently active theme-catalog entry. */
	themeKey: string;
	/** Invoked with the entry's `key` when the user picks an Appearance swatch. */
	onThemeSelect: (key: string) => void;
	/** Code of the currently active locale. */
	localeCode: string;
	/** Invoked with the entry's `code` when the user picks a Language choice. */
	onLocaleSelect: (code: string) => void;
	/** Theme choices to offer on the Appearance tab; defaults to the built-in catalog. */
	availableThemes?: ThemeCatalogEntry[];
	/** Locale choices to offer on the Language tab. */
	availableLocales: LocaleCatalogEntry[];
}>();

const emit = defineEmits<{
	/** Emitted with the full next settings object when any toggle changes. */
	(e: 'update', settings: ViewerSettings): void;
	/** Emitted when the dialog should close. */
	(e: 'close'): void;
}>();

type SettingsTab = 'general' | 'shortcuts' | 'appearance' | 'language';

const { t } = useI18n();

const activeTab = ref<SettingsTab>('general');

/** Local working copy, re-seeded from `settings` on open. */
const draft = ref<ViewerSettings>({ ...props.settings });

watch(
	[() => props.open, () => props.settings],
	([isOpen]) => {
		if (isOpen) {
			draft.value = { ...props.settings };
		}
	},
	{ immediate: true },
);

const toggles = SETTING_TOGGLES;
const shortcuts = SHORTCUT_REFERENCE_ITEMS;

const tabs = computed<Array<{ id: SettingsTab; label: string }>>(() => [
	{ id: 'general', label: t('pptx.settings.general') },
	{ id: 'appearance', label: t('pptx.settings.appearance') },
	{ id: 'language', label: t('pptx.settings.language') },
	{ id: 'shortcuts', label: t('pptx.settings.keyboardShortcuts') },
]);

function toggle(key: keyof ViewerSettings): void {
	const next: ViewerSettings = { ...draft.value, [key]: !draft.value[key] };
	draft.value = next;
	emit('update', next);
}

function close(): void {
	emit('close');
}
</script>

<template>
	<ModalDialog :open="open" :title="t('pptx.settings.title')" @close="close">
		<div class="pptx-vue-settings flex min-w-[320px] flex-col">
			<div class="pptx-vue-settings-tabs mb-2 flex gap-1 border-b border-border" role="tablist">
				<button
					v-for="tab in tabs"
					:key="tab.id"
					type="button"
					role="tab"
					:aria-selected="activeTab === tab.id"
					class="pptx-vue-settings-tab relative border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors"
					:class="
						activeTab === tab.id
							? 'pptx-vue-settings-tab--active border-primary text-primary'
							: 'border-transparent text-muted-foreground hover:text-foreground'
					"
					@click="activeTab = tab.id"
				>
					{{ tab.label }}
				</button>
			</div>

			<div
				v-if="activeTab === 'general'"
				class="pptx-vue-settings-panel flex max-h-[56vh] flex-col overflow-y-auto"
			>
				<div
					v-for="spec in toggles"
					:key="spec.key"
					class="pptx-vue-settings-row flex items-center justify-between gap-3 px-1 py-2"
				>
					<span class="pptx-vue-settings-row-label text-[13px] text-foreground">
						{{ t(spec.labelKey) }}
					</span>
					<button
						type="button"
						role="switch"
						:aria-checked="draft[spec.key]"
						:aria-label="t(spec.labelKey)"
						class="pptx-vue-settings-switch relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
						:class="
							draft[spec.key] ? 'pptx-vue-settings-switch--on bg-primary' : 'bg-muted-foreground/30'
						"
						@click="toggle(spec.key)"
					>
						<span
							class="pptx-vue-settings-switch-knob inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
							:class="draft[spec.key] ? 'translate-x-[18px]' : 'translate-x-[3px]'"
						/>
					</button>
				</div>
			</div>

			<SettingsAppearanceTab
				v-else-if="activeTab === 'appearance'"
				:theme-key="themeKey"
				:catalog="availableThemes"
				:on-select="onThemeSelect"
			/>

			<SettingsLanguageTab
				v-else-if="activeTab === 'language'"
				:locale-code="localeCode"
				:locales="availableLocales"
				:on-select="onLocaleSelect"
			/>

			<div v-else class="pptx-vue-settings-panel flex max-h-[56vh] flex-col overflow-y-auto">
				<div
					v-for="(item, i) in shortcuts"
					:key="item.actionKey"
					class="pptx-vue-settings-shortcut flex items-center justify-between gap-3 rounded px-2 py-1.5"
					:class="{ 'pptx-vue-settings-shortcut--alt bg-muted/60': i % 2 === 0 }"
				>
					<span class="pptx-vue-settings-shortcut-action text-xs text-foreground">
						{{ t(item.actionKey) }}
					</span>
					<span
						class="pptx-vue-settings-shortcut-keys whitespace-nowrap font-mono text-[11px] text-muted-foreground"
					>
						{{ item.shortcut }}
					</span>
				</div>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-settings-btn pptx-vue-settings-btn--primary rounded border border-transparent bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90"
				@click="close"
			>
				{{ t('pptx.settings.done') }}
			</button>
		</template>
	</ModalDialog>
</template>
