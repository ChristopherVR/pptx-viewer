<script setup lang="ts">
import type { PptxCoreProperties } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

/**
 * Editable core-property keys surfaced on the General tab. `manager` and
 * `company` live on `PptxAppProperties`, not `PptxCoreProperties`, so they are
 * handled by their own model props below.
 */
export type GeneralCoreKey =
	| 'title'
	| 'subject'
	| 'creator'
	| 'keywords'
	| 'description'
	| 'category';

interface GeneralField {
	key: GeneralCoreKey;
	labelKey: string;
	multiline?: boolean;
}

const CORE_FIELDS: GeneralField[] = [
	{ key: 'title', labelKey: 'pptx.properties.titleLabel' },
	{ key: 'subject', labelKey: 'pptx.properties.subject' },
	{ key: 'creator', labelKey: 'pptx.properties.author' },
	{ key: 'keywords', labelKey: 'pptx.properties.keywords' },
	{ key: 'description', labelKey: 'pptx.documentProperties.summary.description', multiline: true },
	{ key: 'category', labelKey: 'pptx.documentProperties.summary.category' },
];

/**
 * DocumentPropertiesGeneralTab: the editable metadata tab.
 *
 * Edits the core-property fields (title/subject/author/keywords/comments/
 * category) plus the app-level manager/company. The parent owns the draft
 * state; this tab is a controlled form that emits granular field updates.
 */
const props = defineProps<{
	/** Draft core properties (controlled by the parent dialog). */
	core: PptxCoreProperties;
	/** Draft manager (app property). */
	manager: string;
	/** Draft company (app property). */
	company: string;
}>();

const { t } = useI18n();

const emit = defineEmits<{
	/** Fired when a core-property field changes. */
	(e: 'update-core', key: GeneralCoreKey, value: string): void;
	/** Fired when the manager or company field changes. */
	(e: 'update-manager' | 'update-company', value: string): void;
}>();

function coreValue(key: GeneralCoreKey): string {
	return props.core[key] ?? '';
}

function onCoreInput(key: GeneralCoreKey, event: Event): void {
	const target = event.target as HTMLInputElement | HTMLTextAreaElement;
	emit('update-core', key, target.value);
}

function onManagerInput(event: Event): void {
	emit('update-manager', (event.target as HTMLInputElement).value);
}

function onCompanyInput(event: Event): void {
	emit('update-company', (event.target as HTMLInputElement).value);
}
</script>

<template>
	<div class="pptx-vue-docprops-general flex flex-col gap-3">
		<div
			v-for="field in CORE_FIELDS"
			:key="field.key"
			class="pptx-vue-docprops-field flex flex-col gap-1.5"
		>
			<label
				:for="`pptx-vue-docprops-${field.key}`"
				class="pptx-vue-docprops-label text-xs font-medium text-foreground"
			>
				{{ t(field.labelKey) }}
			</label>
			<textarea
				v-if="field.multiline"
				:id="`pptx-vue-docprops-${field.key}`"
				class="pptx-vue-docprops-input pptx-vue-docprops-textarea w-full resize-y rounded-md border border-border bg-muted px-3 py-1.5 text-[0.8125rem] text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				rows="3"
				:value="coreValue(field.key)"
				@input="onCoreInput(field.key, $event)"
			/>
			<input
				v-else
				:id="`pptx-vue-docprops-${field.key}`"
				type="text"
				class="pptx-vue-docprops-input w-full rounded-md border border-border bg-muted px-3 py-1.5 text-[0.8125rem] text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				:value="coreValue(field.key)"
				@input="onCoreInput(field.key, $event)"
			/>
		</div>

		<div class="pptx-vue-docprops-field flex flex-col gap-1.5">
			<label
				for="pptx-vue-docprops-manager"
				class="pptx-vue-docprops-label text-xs font-medium text-foreground"
				>{{ t('pptx.documentProperties.summary.manager') }}</label
			>
			<input
				id="pptx-vue-docprops-manager"
				type="text"
				class="pptx-vue-docprops-input w-full rounded-md border border-border bg-muted px-3 py-1.5 text-[0.8125rem] text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				:value="manager"
				@input="onManagerInput"
			/>
		</div>

		<div class="pptx-vue-docprops-field flex flex-col gap-1.5">
			<label
				for="pptx-vue-docprops-company"
				class="pptx-vue-docprops-label text-xs font-medium text-foreground"
				>{{ t('pptx.documentProperties.summary.company') }}</label
			>
			<input
				id="pptx-vue-docprops-company"
				type="text"
				class="pptx-vue-docprops-input w-full rounded-md border border-border bg-muted px-3 py-1.5 text-[0.8125rem] text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				:value="company"
				@input="onCompanyInput"
			/>
		</div>
	</div>
</template>
