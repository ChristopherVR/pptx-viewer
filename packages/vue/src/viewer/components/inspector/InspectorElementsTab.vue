<script setup lang="ts">
/**
 * InspectorElementsTab: the Elements tab body (layer-order list, top-most
 * first, click to select), mirroring the `elements` tab of React's
 * `InspectorPane.tsx`.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { HEADING } from './inspector-cards';

const props = defineProps<{
	slide: PptxSlide | undefined;
	selectedElementIds?: readonly string[];
}>();

const emit = defineEmits<{ 'select-element': [id: string] }>();

const { t } = useI18n();

interface Row {
	element: PptxElement;
	index: number;
	label: string;
	selected: boolean;
}

const rows = computed<Row[]>(() => {
	const elements = props.slide?.elements ?? [];
	return [...elements].reverse().map((element, ri) => ({
		element,
		index: elements.length - 1 - ri,
		label:
			(hasTextProperties(element) ? (element.text || '').slice(0, 24) : undefined) || element.type,
		selected: (props.selectedElementIds ?? []).includes(element.id),
	}));
});
</script>

<template>
	<div class="space-y-1">
		<div :class="cn(HEADING, 'mb-2')">{{ t('pptx.inspector.layerOrder') }}</div>
		<template v-if="props.slide">
			<div
				v-for="row in rows"
				:key="row.element.id"
				:title="`${row.element.type} - ${row.element.id}`"
				:class="
					cn(
						'flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors',
						row.selected ? 'bg-primary/30 text-primary' : 'hover:bg-muted text-foreground',
					)
				"
				@click="emit('select-element', row.element.id)"
			>
				<span class="text-muted-foreground w-4 text-right">{{ row.index + 1 }}</span>
				<span class="flex-1 truncate">{{ row.label }}</span>
			</div>
		</template>
		<div v-else class="text-muted-foreground italic">
			{{ t('pptx.inspector.noSlideSelected') }}
		</div>
	</div>
</template>
