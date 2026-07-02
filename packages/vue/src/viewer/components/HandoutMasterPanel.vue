<script setup lang="ts">
/**
 * HandoutMasterPanel: settings panel for the handout master.
 *
 * Vue port of the React `HandoutMasterPanel.tsx`. Lets the user pick the
 * slides-per-page layout (1/2/3/4/6/9) and shows the background swatch plus the
 * handout master's placeholders. The selected count is surfaced via an emit
 * (React used an `onSlidesPerPageChange` callback).
 *
 * Props : `{ handoutMaster, slidesPerPage }`
 * Emits : `slides-per-page-change: [count: number]`
 */
import type { PptxHandoutMaster } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

defineProps<{
	handoutMaster: PptxHandoutMaster | undefined;
	slidesPerPage: number;
}>();

const emit = defineEmits<{
	'slides-per-page-change': [count: number];
}>();

const { t } = useI18n();

const SLIDES_PER_PAGE_OPTIONS: readonly number[] = [1, 2, 3, 4, 6, 9];
</script>

<template>
	<div
		v-if="!handoutMaster"
		class="pptx-vue-handout-master-panel__empty"
		data-testid="handout-master-panel-empty"
	>
		{{ t('pptx.handout.noMaster') }}
	</div>

	<div v-else class="pptx-vue-handout-master-panel">
		<section class="pptx-vue-handout-master-panel__card">
			<div class="pptx-vue-handout-master-panel__heading">
				{{ t('pptx.handout.slidesPerPage') }}
			</div>
			<div class="pptx-vue-handout-master-panel__grid">
				<button
					v-for="count in SLIDES_PER_PAGE_OPTIONS"
					:key="count"
					type="button"
					class="pptx-vue-handout-master-panel__option"
					:class="{ 'pptx-vue-handout-master-panel__option--active': slidesPerPage === count }"
					:data-testid="`slides-per-page-${count}`"
					@click="emit('slides-per-page-change', count)"
				>
					{{ count }}
				</button>
			</div>
		</section>

		<section class="pptx-vue-handout-master-panel__card">
			<div class="pptx-vue-handout-master-panel__heading">
				{{ t('pptx.handout.background') }}
			</div>
			<div
				class="pptx-vue-handout-master-panel__swatch"
				data-testid="handout-master-bg-swatch"
				:style="{ backgroundColor: handoutMaster.backgroundColor ?? '#ffffff' }"
			/>
		</section>

		<section
			v-if="handoutMaster.placeholders && handoutMaster.placeholders.length > 0"
			class="pptx-vue-handout-master-panel__card"
		>
			<div class="pptx-vue-handout-master-panel__heading">
				{{ t('pptx.handout.placeholders') }}
			</div>
			<div class="pptx-vue-handout-master-panel__list">
				<div
					v-for="ph in handoutMaster.placeholders"
					:key="`${ph.type}-${ph.idx ?? 'default'}`"
					class="pptx-vue-handout-master-panel__row"
					data-testid="handout-master-placeholder"
				>
					<span class="pptx-vue-handout-master-panel__dot" />
					{{ ph.type }}
				</div>
			</div>
		</section>
	</div>
</template>

<style scoped>
.pptx-vue-handout-master-panel {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 0 4px;
}

.pptx-vue-handout-master-panel__empty {
	padding: 16px 8px;
	text-align: center;
	font-size: 12px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-handout-master-panel__card {
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 6px;
	padding: 8px;
	background: rgba(0, 0, 0, 0.02);
}

.pptx-vue-handout-master-panel__heading {
	margin-bottom: 6px;
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-handout-master-panel__grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 4px;
}

.pptx-vue-handout-master-panel__option {
	padding: 6px 8px;
	border: none;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.05);
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 11px;
	font-weight: 500;
	cursor: pointer;
	transition:
		background 0.15s ease,
		color 0.15s ease;
}

.pptx-vue-handout-master-panel__option:hover {
	background: rgba(0, 0, 0, 0.08);
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-handout-master-panel__option--active {
	background: var(--pptx-vue-primary, #2563eb);
	color: #ffffff;
}

.pptx-vue-handout-master-panel__swatch {
	width: 100%;
	height: 32px;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
}

.pptx-vue-handout-master-panel__list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.pptx-vue-handout-master-panel__row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 6px;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.03);
	font-size: 10px;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-handout-master-panel__dot {
	flex-shrink: 0;
	width: 8px;
	height: 8px;
	border-radius: 9999px;
	background: rgba(168, 85, 247, 0.6);
}
</style>
