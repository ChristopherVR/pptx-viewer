<script setup lang="ts">
/**
 * OptionsRibbonPane - Options > Customize Ribbon: PowerPoint's "Main Tabs"
 * checkbox list over the shared `TOOLBAR_TABS` registry (the File tab can
 * never be hidden), plus the keyboard-shortcut reference. Vue counterpart of
 * React's `settings/OptionsRibbonPane.tsx`.
 */
import type { ToolbarTabId, ViewerOptions } from 'pptx-viewer-shared';
import { SHORTCUT_REFERENCE_ITEMS, TOOLBAR_TABS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	options: ViewerOptions;
	onRibbonTabHiddenChange: (tabId: ToolbarTabId, hidden: boolean) => void;
	onResetRibbon: () => void;
}>();

const { t } = useI18n();

const tabs = TOOLBAR_TABS;
const shortcuts = SHORTCUT_REFERENCE_ITEMS;
const hidden = computed(() => new Set(props.options.ribbon.hiddenTabIds));
</script>

<template>
	<div class="pptx-vue-options-ribbon space-y-5">
		<section>
			<h3
				class="mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.options.ribbon.tabsTitle') }}
			</h3>
			<p class="mb-2 text-xs text-muted-foreground">
				{{ t('pptx.options.ribbon.tabsDescription') }}
			</p>
			<div class="space-y-0.5 rounded border border-border/60 p-2">
				<label
					v-for="tab in tabs"
					:key="tab.id"
					class="pptx-vue-options-ribbon-tab flex items-center gap-2 rounded px-2 py-1.5"
					:class="
						tab.id === 'file' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-accent'
					"
				>
					<input
						type="checkbox"
						class="h-4 w-4 accent-[var(--pptx-primary,#6366f1)]"
						:checked="tab.id === 'file' || !hidden.has(tab.id)"
						:disabled="tab.id === 'file'"
						@change="onRibbonTabHiddenChange(tab.id, !($event.target as HTMLInputElement).checked)"
					/>
					<span class="text-sm text-foreground">{{ t(tab.labelKey) }}</span>
				</label>
			</div>
			<button
				type="button"
				class="mt-2 rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
				@click="onResetRibbon"
			>
				{{ t('pptx.options.ribbon.reset') }}
			</button>
		</section>

		<section>
			<h3
				class="mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t('pptx.settings.keyboardShortcuts') }}
			</h3>
			<div class="space-y-0.5">
				<div
					v-for="(shortcut, i) in shortcuts"
					:key="shortcut.actionKey"
					class="pptx-vue-options-shortcut flex items-center justify-between gap-3 rounded px-3 py-2"
					:class="{ 'bg-muted/60': i % 2 === 0 }"
				>
					<span class="text-xs text-foreground">{{ t(shortcut.actionKey) }}</span>
					<span class="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
						{{ shortcut.shortcut }}
					</span>
				</div>
			</div>
		</section>
	</div>
</template>
