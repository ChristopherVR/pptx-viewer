<script setup lang="ts">
import { ChevronDown, ChevronUp, Copy, Paintbrush, Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
/**
 * ArrangeButtonGroup: Arrange / selection actions extracted from EditorToolbar
 * to keep EditorToolbar.vue under the 300-LOC limit.
 *
 * Mirrors the Arrange section of React's toolbar (format painter, duplicate,
 * bring-forward, send-backward, delete), down to the `lucide` icon chosen for
 * each control. All actions are disabled when no element is selected, except
 * for the format painter which is gated separately.
 */

const TB_BTN =
	'inline-flex items-center justify-center px-2.5 py-1.5 rounded bg-muted text-xs hover:bg-accent transition-colors active:scale-95 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed';

/** Icon sizing, matching React's shared `ic` toolbar-icon class. */
const IC = 'w-4 h-4';

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
			<Paintbrush :class="IC" aria-hidden="true" />
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
			<Copy :class="IC" aria-hidden="true" />
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
			<ChevronUp :class="IC" aria-hidden="true" />
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
			<ChevronDown :class="IC" aria-hidden="true" />
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
			<Trash2 :class="IC" aria-hidden="true" />
		</button>
	</div>
</template>
