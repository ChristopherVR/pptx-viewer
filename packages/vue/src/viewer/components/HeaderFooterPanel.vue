<script setup lang="ts">
/**
 * HeaderFooterPanel: edit the presentation's header/footer placeholders.
 *
 * Vue port of the React `HeaderFooterPanel.tsx`, adapted to the Vue port's
 * data-driven contract: instead of a bundle of separate boolean/text props +
 * `onSetX` callbacks, this panel takes the real core `PptxHeaderFooter` object
 * and emits a fully-formed `update(next)` with the edited copy. The host applies
 * the change (e.g. to `PptxData.headerFooter` and/or per-slide flags).
 *
 * Covers the visibility flags (date/time, slide number, header, footer) plus the
 * date/footer/header text fields and the date auto/fixed toggle.
 *
 * Props : `{ headerFooter: PptxHeaderFooter | undefined }`
 * Emits : `update: [next: PptxHeaderFooter]`, `close: []`
 */
import type { PptxHeaderFooter } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
	headerFooter: PptxHeaderFooter | undefined;
}>();

const { t } = useI18n();

const emit = defineEmits<{
	update: [next: PptxHeaderFooter];
	close: [];
}>();

/** The current value, defaulting to an empty object when unset. */
const value = computed<PptxHeaderFooter>(() => props.headerFooter ?? {});

function patch(changes: Partial<PptxHeaderFooter>): void {
	emit('update', { ...value.value, ...changes });
}

const showDateTime = computed(() => value.value.hasDateTime ?? false);
const showSlideNumber = computed(() => value.value.hasSlideNumber ?? false);
const showHeader = computed(() => value.value.hasHeader ?? false);
const showFooter = computed(() => value.value.hasFooter ?? false);
const dateTimeAuto = computed(() => value.value.dateTimeAuto ?? false);

function onToggleDateTime(event: Event): void {
	patch({ hasDateTime: (event.target as HTMLInputElement).checked });
}
function onToggleSlideNumber(event: Event): void {
	patch({ hasSlideNumber: (event.target as HTMLInputElement).checked });
}
function onToggleHeader(event: Event): void {
	patch({ hasHeader: (event.target as HTMLInputElement).checked });
}
function onToggleFooter(event: Event): void {
	patch({ hasFooter: (event.target as HTMLInputElement).checked });
}
function onToggleDateAuto(event: Event): void {
	patch({ dateTimeAuto: (event.target as HTMLInputElement).checked });
}
function onHeaderText(event: Event): void {
	patch({ headerText: (event.target as HTMLInputElement).value });
}
function onFooterText(event: Event): void {
	patch({ footerText: (event.target as HTMLInputElement).value });
}
function onDateText(event: Event): void {
	patch({ dateTimeText: (event.target as HTMLInputElement).value });
}
</script>

<template>
	<div
		class="pptx-vue-header-footer-panel"
		role="dialog"
		:aria-label="t('pptx.headerFooter.title')"
	>
		<header class="pptx-vue-header-footer-panel__header">
			<h2 class="pptx-vue-header-footer-panel__title">{{ t('pptx.headerFooter.title') }}</h2>
			<button
				type="button"
				class="pptx-vue-header-footer-panel__close"
				:aria-label="t('pptx.headerFooter.close')"
				data-testid="header-footer-close"
				@click="emit('close')"
			>
				&times;
			</button>
		</header>

		<div class="pptx-vue-header-footer-panel__body">
			<label class="pptx-vue-header-footer-panel__row">
				<input
					type="checkbox"
					data-testid="hf-date-time"
					:checked="showDateTime"
					@change="onToggleDateTime"
				/>
				<span>{{ t('pptx.headerFooter.dateAndTime') }}</span>
			</label>

			<div v-if="showDateTime" class="pptx-vue-header-footer-panel__sub">
				<label class="pptx-vue-header-footer-panel__row">
					<input
						type="checkbox"
						data-testid="hf-date-auto"
						:checked="dateTimeAuto"
						@change="onToggleDateAuto"
					/>
					<span>{{ t('pptx.headerFooter.updateAutomatically') }}</span>
				</label>
				<input
					v-if="!dateTimeAuto"
					type="text"
					class="pptx-vue-header-footer-panel__input"
					:placeholder="t('pptx.headerFooter.fixedDate')"
					data-testid="hf-date-text"
					:value="value.dateTimeText ?? ''"
					@input="onDateText"
				/>
			</div>

			<label class="pptx-vue-header-footer-panel__row">
				<input
					type="checkbox"
					data-testid="hf-slide-number"
					:checked="showSlideNumber"
					@change="onToggleSlideNumber"
				/>
				<span>{{ t('pptx.headerFooter.slideNumber') }}</span>
			</label>

			<label class="pptx-vue-header-footer-panel__row">
				<input
					type="checkbox"
					data-testid="hf-header"
					:checked="showHeader"
					@change="onToggleHeader"
				/>
				<span>{{ t('pptx.field.header') }}</span>
			</label>

			<div v-if="showHeader" class="pptx-vue-header-footer-panel__sub">
				<input
					type="text"
					class="pptx-vue-header-footer-panel__input"
					:placeholder="t('pptx.headerFooter.headerText')"
					data-testid="hf-header-text"
					:value="value.headerText ?? ''"
					@input="onHeaderText"
				/>
			</div>

			<label class="pptx-vue-header-footer-panel__row">
				<input
					type="checkbox"
					data-testid="hf-footer"
					:checked="showFooter"
					@change="onToggleFooter"
				/>
				<span>{{ t('pptx.headerFooter.footer') }}</span>
			</label>

			<div v-if="showFooter" class="pptx-vue-header-footer-panel__sub">
				<input
					type="text"
					class="pptx-vue-header-footer-panel__input"
					:placeholder="t('pptx.headerFooter.footerPlaceholder')"
					data-testid="hf-footer-text"
					:value="value.footerText ?? ''"
					@input="onFooterText"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-header-footer-panel {
	display: flex;
	flex-direction: column;
	width: 100%;
	max-width: 360px;
	background: var(--pptx-vue-background, #ffffff);
	color: var(--pptx-vue-foreground, #111827);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: var(--pptx-vue-radius, 8px);
}

.pptx-vue-header-footer-panel__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-header-footer-panel__title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}

.pptx-vue-header-footer-panel__close {
	width: 24px;
	height: 24px;
	padding: 0;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 18px;
	line-height: 1;
	cursor: pointer;
}

.pptx-vue-header-footer-panel__close:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-header-footer-panel__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
	padding: 16px;
}

.pptx-vue-header-footer-panel__row {
	display: flex;
	align-items: center;
	gap: 10px;
	font-size: 12px;
	cursor: pointer;
	user-select: none;
}

.pptx-vue-header-footer-panel__sub {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-left: 24px;
}

.pptx-vue-header-footer-panel__input {
	width: 100%;
	padding: 6px 10px;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	background: var(--pptx-vue-muted, #f9fafb);
	color: var(--pptx-vue-foreground, #111827);
	font-size: 12px;
	box-sizing: border-box;
}

.pptx-vue-header-footer-panel__input:focus {
	outline: none;
	border-color: var(--pptx-vue-primary, #2563eb);
}
</style>
