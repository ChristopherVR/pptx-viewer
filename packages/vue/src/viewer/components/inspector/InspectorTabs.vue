<script setup lang="ts">
/**
 * InspectorTabs: the [Elements | Properties | Comments] tab strip at the top of
 * the right inspector, mirroring React's `InspectorPaneHeader` (same layout and
 * active-tab styling, `react-icons/lu` glyphs mapped to `lucide-vue-next`).
 */
import { Layers, MessageSquare, Settings2, X } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import type { InspectorTab } from './inspector-cards';

defineProps<{ activeTab: InspectorTab }>();

const emit = defineEmits<{
	'set-tab': [tab: InspectorTab];
	close: [];
}>();

const { t } = useI18n();

const TABS = [
	{ key: 'elements', labelKey: 'pptx.documentProperties.statistics.elements', icon: Layers },
	{ key: 'properties', labelKey: 'pptx.inspector.properties', icon: Settings2 },
	{ key: 'comments', labelKey: 'pptx.toolbar.comments', icon: MessageSquare },
] as const;
</script>

<template>
	<div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
		<div class="flex items-center gap-1 rounded bg-muted p-0.5">
			<button
				v-for="tab in TABS"
				:key="tab.key"
				type="button"
				:title="t(tab.labelKey)"
				:class="
					cn(
						'flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors',
						activeTab === tab.key
							? 'bg-primary text-white'
							: 'text-muted-foreground hover:text-foreground hover:bg-accent',
					)
				"
				@click="emit('set-tab', tab.key)"
			>
				<component :is="tab.icon" class="w-3.5 h-3.5" />
				<span class="hidden sm:inline">{{ t(tab.labelKey) }}</span>
			</button>
		</div>
		<button
			type="button"
			:title="t('common.close')"
			class="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
			@click="emit('close')"
		>
			<X class="w-4 h-4" />
		</button>
	</div>
</template>
