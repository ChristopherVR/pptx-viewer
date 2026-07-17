<script setup lang="ts">
/**
 * DocumentPropertiesCard: DOCUMENT card (Title / Author / Company /
 * Application text fields + custom properties), mirroring React's
 * `DocumentPropertiesCard` in `inspector/DocumentPropertiesCards.tsx`.
 */
import type { PptxAppProperties, PptxCoreProperties, PptxCustomProperty } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import CustomPropertiesBlock from './CustomPropertiesBlock.vue';
import { CARD, HEADING, INPUT } from './inspector-cards';

const props = withDefaults(
	defineProps<{
		coreProperties?: PptxCoreProperties;
		appProperties?: PptxAppProperties;
		customProperties: PptxCustomProperty[];
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	'update-core': [patch: Partial<PptxCoreProperties>];
	'update-app': [patch: Partial<PptxAppProperties>];
	'update-custom': [props: PptxCustomProperty[]];
}>();

const { t } = useI18n();

interface FieldRow {
	label: string;
	value: string;
	commit: (value: string) => void;
}

const fields = computed<FieldRow[]>(() => [
	{
		label: t('pptx.properties.titleLabel'),
		value: props.coreProperties?.title ?? '',
		commit: (v) => emit('update-core', { title: v }),
	},
	{
		label: t('pptx.properties.author'),
		value: props.coreProperties?.creator ?? '',
		commit: (v) => emit('update-core', { creator: v }),
	},
	{
		label: t('pptx.documentProperties.summary.company'),
		value: props.appProperties?.company ?? '',
		commit: (v) => emit('update-app', { company: v }),
	},
	{
		label: t('pptx.documentProperties.statistics.application'),
		value: props.appProperties?.application ?? '',
		commit: (v) => emit('update-app', { application: v }),
	},
]);
</script>

<template>
	<div :class="CARD">
		<div :class="HEADING">{{ t('pptx.documentProperties.documentHeading') }}</div>
		<div class="space-y-2 text-[11px] text-muted-foreground">
			<label v-for="field in fields" :key="field.label" class="flex flex-col gap-1">
				<span class="text-muted-foreground">{{ field.label }}</span>
				<input
					type="text"
					:class="INPUT"
					:disabled="!props.canEdit"
					:value="field.value"
					@input="(e) => field.commit((e.target as HTMLInputElement).value)"
				/>
			</label>
			<CustomPropertiesBlock
				:custom-properties="props.customProperties"
				:can-edit="props.canEdit"
				@update="(next) => emit('update-custom', next)"
			/>
		</div>
	</div>
</template>
