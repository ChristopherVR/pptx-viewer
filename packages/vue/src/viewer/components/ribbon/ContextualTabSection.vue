<script setup lang="ts">
/**
 * ContextualTabSection: the body of a contextual ribbon tab (Shape Format,
 * Picture Format, Table Design, Chart Design, SmartArt Design). The groups
 * and the galleries inside them, with their modes, come from the shared
 * `CONTEXTUAL_TAB_GROUPS`; this only maps them onto the ribbon's group markup.
 */
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import type { RibbonContextualTabId } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import RibbonGallery from './RibbonGallery.vue';

interface Props {
	tab: RibbonContextualTabId;
}

const props = defineProps<Props>();
const { t } = useI18n();
const groups = computed(() => CONTEXTUAL_TAB_GROUPS[props.tab]);

function caption(labelKey: string, fallback: string): string {
	const translated = t(labelKey);
	return translated && translated !== labelKey ? translated : fallback;
}
</script>

<template>
	<pptx-ui-ribbon-group
		v-for="group in groups"
		:key="group.group"
		:label="caption(group.labelKey, group.label)"
		:data-ribbon-group="group.group"
	>
		<RibbonGallery
			v-for="placement in group.galleries"
			:key="placement.control"
			:gallery="placement.gallery"
			:control="placement.control"
			:mode="placement.mode"
		/>
	</pptx-ui-ribbon-group>
</template>
