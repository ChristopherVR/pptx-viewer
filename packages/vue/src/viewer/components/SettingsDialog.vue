<script setup lang="ts">
/**
 * SettingsDialog - the PowerPoint "File > Options" parity dialog.
 *
 * Vue counterpart of the React `SettingsDialog.tsx`: the ten shared categories
 * (`VIEWER_OPTIONS_TABS`) in a left rail with schema-driven panes on the right
 * (`OptionsPane` and the bespoke Ribbon / Quick Access / Add-ins panes).
 * Changes apply live through `onOptionChange`; Cancel restores the snapshot
 * taken when the dialog opened; OK (or Escape / backdrop) closes confirming.
 *
 * Renders its own wide overlay instead of the shared `ModalDialog`, whose
 * 480px max-width cannot host the two-column category-rail layout.
 */
import { Settings, X } from 'lucide-vue-next';
import type {
	ToolbarTabId,
	ViewerAddinStatus,
	ViewerOptions,
	ViewerOptionsGroupId,
	ViewerOptionsTabId,
} from 'pptx-viewer-shared';
import { DEFAULT_QUICK_ACCESS_COMMAND_IDS, VIEWER_OPTIONS_TABS } from 'pptx-viewer-shared';
import type { PptxAiChatStore } from 'pptx-viewer-shared/ai';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { LocaleCatalogEntry } from '../../i18n';
import type { ThemeCatalogEntry } from '../../theme';
import OptionsAddInsPane from './settings/OptionsAddInsPane.vue';
import OptionsPane from './settings/OptionsPane.vue';
import OptionsQuickAccessPane from './settings/OptionsQuickAccessPane.vue';
import OptionsRibbonPane from './settings/OptionsRibbonPane.vue';
import SettingsAiTab from './SettingsAiTab.vue';
import SettingsAppearanceTab from './SettingsAppearanceTab.vue';
import SettingsCustomFontsSection from './SettingsCustomFontsSection.vue';
import SettingsCustomFontsSection from './SettingsCustomFontsSection.vue';
import SettingsLanguageTab from './SettingsLanguageTab.vue';

/** Synthetic tab id for the AI section (appended only when `aiEnabled`). */
const AI_TAB_ID = 'ai';

const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Full File > Options snapshot rendered by every pane. */
	options: ViewerOptions;
	onOptionChange: (
		group: ViewerOptionsGroupId,
		key: string,
		value: boolean | number | string,
	) => void;
	/** Restore a snapshot wholesale (Cancel semantics). */
	onRestoreOptions: (options: ViewerOptions) => void;
	onRibbonTabHiddenChange: (tabId: ToolbarTabId, hidden: boolean) => void;
	onQuickAccessCommandsChange: (commandIds: string[]) => void;
	onResetOptions: (group?: ViewerOptionsGroupId) => void;
	/** Options > Save > "Delete cached files". */
	onClearCache: () => void;
	/** Availability flags for the Add-ins pane. */
	addinStatus?: ViewerAddinStatus;
	/** Key of the currently active theme-catalog entry. */
	themeKey: string;
	/** Invoked with the entry's `key` when the user picks an Appearance swatch. */
	onThemeSelect: (key: string) => void;
	/** Code of the currently active locale. */
	localeCode: string;
	/** Invoked with the entry's `code` when the user picks a Language choice. */
	onLocaleSelect: (code: string) => void;
	/** Theme choices to offer; defaults to the built-in catalog. */
	availableThemes?: ThemeCatalogEntry[];
	/** Locale choices to offer on the Language pane. */
	availableLocales: LocaleCatalogEntry[];
	/** When true, an "AI" section is shown for exporting detailed chat logs. */
	aiEnabled?: boolean;
	/** Families registered this session via the Fonts section. */
	customFontFamilies?: readonly string[];
	/** Chat store the AI section reads from (defaults to the shared store). */
	chatStore?: PptxAiChatStore;
}>();

const emit = defineEmits<{
	/** Emitted when the dialog should close (changes kept). */
	(e: 'close'): void;
	/** A font file was registered; the ribbon adds the family to its list. */
	(e: 'customFontRegistered', family: string): void;
}>();

const { t } = useI18n();

const activeTabId = ref<ViewerOptionsTabId | typeof AI_TAB_ID>('general');
const activeTab = computed(
	() => VIEWER_OPTIONS_TABS.find((tab) => tab.id === activeTabId.value) ?? VIEWER_OPTIONS_TABS[0],
);

/** Snapshot taken on open, restored wholesale by Cancel. */
let snapshot: ViewerOptions | null = null;
watch(
	() => props.open,
	(isOpen, wasOpen) => {
		if (isOpen && !wasOpen) {
			snapshot = props.options;
		}
	},
	{ immediate: true },
);

function close(): void {
	emit('close');
}

function cancel(): void {
	if (snapshot) {
		props.onRestoreOptions(snapshot);
	}
	close();
}

function resetQuickAccess(): void {
	props.onQuickAccessCommandsChange([...DEFAULT_QUICK_ACCESS_COMMAND_IDS]);
}

// Close (confirming) on Escape while open.
function onDocumentKeydown(event: KeyboardEvent): void {
	if (props.open && event.key === 'Escape') {
		event.preventDefault();
		close();
	}
}
onMounted(() => document.addEventListener('keydown', onDocumentKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown));
</script>

<template>
	<Teleport to="body">
		<template v-if="open && activeTab">
			<!-- Backdrop -->
			<button
				type="button"
				class="pptx-vue-options-backdrop fixed inset-0 z-[1200] bg-black/60"
				:aria-label="t('pptx.settings.closeSettings')"
				@click="close"
			/>
			<!-- Dialog -->
			<div class="pointer-events-none fixed inset-0 z-[1201] flex items-center justify-center">
				<div
					role="dialog"
					aria-modal="true"
					:aria-label="t('pptx.options.title')"
					class="pptx-vue-options-dialog pointer-events-auto flex max-h-[85vh] w-[min(56rem,calc(100%-2rem))] flex-col rounded-xl border border-border bg-popover text-foreground shadow-2xl backdrop-blur-xl max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[88dvh] max-md:w-full max-md:rounded-b-none max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]"
				>
					<!-- Header -->
					<div
						class="pptx-vue-options-header flex items-center justify-between border-b border-border/60 px-5 py-4"
					>
						<div class="flex items-center gap-2">
							<Settings class="h-5 w-5 text-primary" aria-hidden="true" />
							<h2 class="text-sm font-semibold text-foreground">{{ t('pptx.options.title') }}</h2>
						</div>
						<button
							type="button"
							class="rounded p-1 transition-colors hover:bg-accent"
							:aria-label="t('pptx.settings.close')"
							@click="close"
						>
							<X class="h-4 w-4 text-muted-foreground" />
						</button>
					</div>

					<!-- Body: category rail + pane -->
					<div class="flex min-h-0 flex-1 max-md:flex-col">
						<nav
							:aria-label="t('pptx.options.title')"
							class="pptx-vue-options-rail w-44 shrink-0 space-y-0.5 overflow-y-auto border-r border-border/60 p-2 max-md:flex max-md:w-full max-md:space-y-0 max-md:gap-1 max-md:overflow-x-auto max-md:border-b max-md:border-r-0"
						>
							<button
								v-for="tab in VIEWER_OPTIONS_TABS"
								:key="tab.id"
								type="button"
								:aria-current="activeTabId === tab.id"
								class="block w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm transition-colors max-md:w-auto"
								:class="
									activeTabId === tab.id
										? 'bg-primary/10 font-medium text-primary'
										: 'text-foreground hover:bg-accent'
								"
								@click="activeTabId = tab.id"
							>
								{{ t(tab.labelKey) }}
							</button>
							<button
								v-if="aiEnabled"
								type="button"
								:aria-current="activeTabId === AI_TAB_ID"
								class="block w-full whitespace-nowrap rounded px-3 py-2 text-left text-sm transition-colors max-md:w-auto"
								:class="
									activeTabId === AI_TAB_ID
										? 'bg-primary/10 font-medium text-primary'
										: 'text-foreground hover:bg-accent'
								"
								@click="activeTabId = AI_TAB_ID"
							>
								{{ t('pptx.ai.settingsSectionTitle') }}
							</button>
						</nav>

						<div class="pptx-vue-options-body min-h-0 flex-1 overflow-y-auto px-5 py-4">
							<!-- AI: detailed chat-log export (shown only when enabled) -->
							<div v-if="activeTabId === AI_TAB_ID" class="space-y-4">
								<p class="text-sm font-medium text-foreground">
									{{ t('pptx.ai.settingsSectionTitle') }}
								</p>
								<SettingsAiTab :store="chatStore" />
							</div>

							<!-- Language: bespoke pane around the locale list -->
							<div v-else-if="activeTab.custom === 'language'" class="space-y-4">
								<p class="text-sm font-medium text-foreground">{{ t(activeTab.descriptionKey) }}</p>
								<section>
									<h3
										class="mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
									>
										{{ t('pptx.options.language.displayLanguage') }}
									</h3>
									<p class="mb-2 text-xs text-muted-foreground">
										{{ t('pptx.options.language.displayLanguageDescription') }}
									</p>
									<SettingsLanguageTab
										:locale-code="localeCode"
										:locales="availableLocales"
										:on-select="onLocaleSelect"
									/>
								</section>
							</div>

							<!-- Customize Ribbon -->
							<div v-else-if="activeTab.custom === 'ribbon'" class="space-y-4">
								<p class="text-sm font-medium text-foreground">{{ t(activeTab.descriptionKey) }}</p>
								<OptionsRibbonPane
									:options="options"
									:on-ribbon-tab-hidden-change="onRibbonTabHiddenChange"
									:on-reset-ribbon="() => onResetOptions('ribbon')"
								/>
							</div>

							<!-- Add-ins -->
							<div v-else-if="activeTab.custom === 'addIns'" class="space-y-4">
								<p class="text-sm font-medium text-foreground">{{ t(activeTab.descriptionKey) }}</p>
								<OptionsAddInsPane :addin-status="addinStatus" />
							</div>

							<!-- Generic schema pane (plus the Quick Access chooser) -->
							<OptionsPane
								v-else
								:tab="activeTab"
								:options="options"
								:on-option-change="onOptionChange"
							>
								<template #special="{ section }">
									<div v-if="section.special === 'themePicker'" class="mt-2">
										<SettingsAppearanceTab
											:theme-key="themeKey"
											:catalog="availableThemes"
											:on-select="onThemeSelect"
										/>
									</div>
									<SettingsCustomFontsSection
										v-else-if="section.special === 'customFonts'"
										:enabled="props.options.general.enableCustomFontUpload"
										:families="props.customFontFamilies ?? []"
										@registered="(family: string) => emit('customFontRegistered', family)"
									/>
									<div v-else-if="section.special === 'clearCache'" class="mt-2">
										<p class="mb-2 text-xs text-muted-foreground">
											{{ t('pptx.options.save.clearCacheDescription') }}
										</p>
										<button
											type="button"
											class="rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
											@click="onClearCache"
										>
											{{ t('pptx.options.save.clearCacheNow') }}
										</button>
									</div>
								</template>
								<OptionsQuickAccessPane
									v-if="activeTab.custom === 'quickAccess'"
									:options="options"
									:on-quick-access-commands-change="onQuickAccessCommandsChange"
									:on-reset-quick-access="resetQuickAccess"
								/>
							</OptionsPane>
						</div>
					</div>

					<!-- Footer -->
					<div
						class="pptx-vue-options-footer flex items-center justify-between gap-2 border-t border-border/60 px-5 py-3"
					>
						<button
							type="button"
							class="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							@click="onResetOptions()"
						>
							{{ t('pptx.options.resetAll') }}
						</button>
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="rounded border border-border px-4 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
								@click="cancel"
							>
								{{ t('pptx.common.cancel') }}
							</button>
							<button
								type="button"
								class="rounded bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
								@click="close"
							>
								{{ t('pptx.common.ok') }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Teleport>
</template>
