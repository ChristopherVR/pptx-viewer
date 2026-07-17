<script setup lang="ts">
/**
 * CustomPropertiesBlock: editable custom document properties (name / value
 * rows + add / remove), mirroring React's `CustomPropertiesBlock` in
 * `inspector/DocumentPropertiesCards.tsx`. Emits the full replacement array.
 */
import type { PptxCustomProperty } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { BTN, INPUT } from './inspector-cards';

const props = withDefaults(
	defineProps<{
		customProperties: PptxCustomProperty[];
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{ update: [props: PptxCustomProperty[]] }>();

const { t } = useI18n();

function addProperty(): void {
	emit('update', [
		...props.customProperties,
		{ name: `Property ${props.customProperties.length + 1}`, value: '', type: 'lpwstr' },
	]);
}

function patchAt(index: number, patch: Partial<PptxCustomProperty>): void {
	emit(
		'update',
		props.customProperties.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
	);
}

function removeAt(index: number): void {
	emit(
		'update',
		props.customProperties.filter((_, i) => i !== index),
	);
}
</script>

<template>
	<div class="space-y-1">
		<div class="flex items-center justify-between">
			<span class="text-muted-foreground">{{ t('pptx.documentProperties.custom.heading') }}</span>
			<button v-if="props.canEdit" type="button" :class="BTN" @click="addProperty">
				{{ t('pptx.documentProperties.custom.add') }}
			</button>
		</div>
		<div v-if="props.customProperties.length === 0" class="text-[10px] text-muted-foreground">
			{{ t('pptx.documentProperties.custom.empty') }}
		</div>
		<div
			v-for="(entry, index) in props.customProperties"
			:key="`${entry.name}-${index}`"
			class="grid grid-cols-[1fr,1fr,auto] gap-1"
		>
			<input
				type="text"
				:class="INPUT"
				:disabled="!props.canEdit"
				:value="entry.name"
				@input="(e) => patchAt(index, { name: (e.target as HTMLInputElement).value })"
			/>
			<input
				type="text"
				:class="INPUT"
				:disabled="!props.canEdit"
				:value="entry.value"
				@input="(e) => patchAt(index, { value: (e.target as HTMLInputElement).value })"
			/>
			<button
				v-if="props.canEdit"
				type="button"
				:class="cn(BTN, 'px-1.5 text-red-400 hover:text-red-300')"
				@click="removeAt(index)"
			>
				×
			</button>
		</div>
	</div>
</template>
