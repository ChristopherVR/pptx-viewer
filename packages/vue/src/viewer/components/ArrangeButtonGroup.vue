<script setup lang="ts">
import { useI18n } from 'vue-i18n';
/**
 * ArrangeButtonGroup: Arrange / selection actions extracted from EditorToolbar
 * to keep EditorToolbar.vue under the 300-LOC limit.
 *
 * Mirrors the Arrange section of React's toolbar (format painter, duplicate,
 * bring-forward, send-backward, delete). All actions are disabled when no
 * element is selected, except for the format painter which is gated separately.
 */

const TB_BTN =
	'inline-flex items-center justify-center px-2.5 py-1.5 rounded bg-muted text-xs hover:bg-accent transition-colors active:scale-95 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';

interface Props {
	hasSelection: boolean;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
}

defineProps<Props>();

const { t } = useI18n();

defineEmits<{
	'toggle-format-painter': [];
	'duplicate-selected': [];
	'bring-forward': [];
	'send-backward': [];
	'delete-selected': [];
}>();
</script>

<template>
	<div
		class="pptx-vue-tb-group flex items-center gap-1"
		role="group"
		:aria-label="t('pptx.arrange.groupLabel')"
	>
		<button
			type="button"
			class="pptx-vue-tb-btn pptx-vue-tb-painter"
			:class="[
				TB_BTN,
				formatPainterActive ? 'is-active !bg-amber-600 !text-amber-50 hover:!bg-amber-500' : '',
			]"
			data-testid="format-painter-toggle"
			:data-active="formatPainterActive ? 'true' : 'false'"
			:aria-label="t('pptx.arrange.formatPainter')"
			:title="t('pptx.arrange.formatPainter')"
			:disabled="!canActivateFormatPainter && !formatPainterActive"
			@click="$emit('toggle-format-painter')"
		>
			<span aria-hidden="true">🖌</span>
		</button>
		<button
			type="button"
			class="pptx-vue-tb-btn"
			:class="TB_BTN"
			:aria-label="t('pptx.arrange.duplicateSelection')"
			:title="t('pptx.arrange.duplicate')"
			:disabled="!hasSelection"
			@click="$emit('duplicate-selected')"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<rect
					x="8"
					y="8"
					width="11"
					height="11"
					rx="1.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
				<path
					d="M5 15V6a1 1 0 0 1 1-1h9"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
		<button
			type="button"
			class="pptx-vue-tb-btn"
			:class="TB_BTN"
			:aria-label="t('pptx.arrange.bringForward')"
			:title="t('pptx.arrange.bringForward')"
			:disabled="!hasSelection"
			@click="$emit('bring-forward')"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<rect x="9" y="3" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.85" />
				<rect
					x="3"
					y="9"
					width="12"
					height="12"
					rx="1.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
			</svg>
		</button>
		<button
			type="button"
			class="pptx-vue-tb-btn"
			:class="TB_BTN"
			:aria-label="t('pptx.arrange.sendBackward')"
			:title="t('pptx.arrange.sendBackward')"
			:disabled="!hasSelection"
			@click="$emit('send-backward')"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<rect x="3" y="9" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.85" />
				<rect
					x="9"
					y="3"
					width="12"
					height="12"
					rx="1.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
			</svg>
		</button>
		<button
			type="button"
			class="pptx-vue-tb-btn pptx-vue-tb-danger hover:!text-destructive"
			:class="TB_BTN"
			:aria-label="t('pptx.arrange.deleteSelection')"
			:title="t('pptx.arrange.delete')"
			:disabled="!hasSelection"
			@click="$emit('delete-selected')"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<path
					d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
	</div>
</template>
