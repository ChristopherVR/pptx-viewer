<script setup lang="ts">
/**
 * OptionsPane - generic File > Options pane: the tab's headline plus its
 * schema-driven sections of controls. Vue counterpart of React's
 * `settings/OptionsPane.tsx`.
 *
 * Bespoke blocks (theme picker, clear-cache button) are rendered by the parent
 * through the scoped `special` slot, keyed by `section.special`; extra content
 * for custom panes (the Quick Access chooser) goes into the default slot.
 */
import type {
	ViewerOptions,
	ViewerOptionsGroupId,
	ViewerOptionsTabDefinition,
} from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import OptionsControlRow from './OptionsControlRow.vue';

defineProps<{
	tab: ViewerOptionsTabDefinition;
	options: ViewerOptions;
	onOptionChange: (
		group: ViewerOptionsGroupId,
		key: string,
		value: boolean | number | string,
	) => void;
}>();

const { t } = useI18n();
</script>

<template>
	<div class="pptx-vue-options-pane space-y-5">
		<p class="text-sm font-medium text-foreground">{{ t(tab.descriptionKey) }}</p>
		<section v-for="section in tab.sections" :key="section.id">
			<h3
				class="mb-1 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
			>
				{{ t(section.titleKey) }}
			</h3>
			<p v-if="section.descriptionKey" class="mb-2 text-xs text-muted-foreground">
				{{ t(section.descriptionKey) }}
			</p>
			<div class="space-y-0.5">
				<OptionsControlRow
					v-for="control in section.controls"
					:key="`${control.group}.${control.key}.${section.id}`"
					:control="control"
					:options="options"
					:on-option-change="onOptionChange"
				/>
			</div>
			<slot v-if="section.special" name="special" :section="section" />
		</section>
		<slot />
	</div>
</template>
