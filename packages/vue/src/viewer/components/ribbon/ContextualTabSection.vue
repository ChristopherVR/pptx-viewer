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

import { GROUP_LABEL, SEP } from './ribbon-constants';
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
	<template v-for="(group, index) in groups" :key="group.group">
		<div v-if="index > 0" :class="SEP" />
		<div class="flex flex-col items-center gap-0.5" :data-ribbon-group="group.group">
			<div class="flex items-center gap-1">
				<RibbonGallery
					v-for="placement in group.galleries"
					:key="placement.control"
					:gallery="placement.gallery"
					:control="placement.control"
					:mode="placement.mode"
				/>
			</div>
			<span :class="GROUP_LABEL">{{ caption(group.labelKey, group.label) }}</span>
		</div>
	</template>
</template>
