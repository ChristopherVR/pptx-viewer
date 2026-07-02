<script setup lang="ts">
import type { AlignEdge, DistributeAxis } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

/**
 * AlignToolbar: a compact, purely presentational button row for the editor's
 * align / distribute / group operations.
 *
 * It owns no state and performs no geometry: every button emits an intent and
 * the host (PowerPointViewer) applies it against the current selection. Group
 * is disabled until two or more elements are selected; Ungroup is disabled
 * unless a single group element is selected; both gated by props.
 *
 * Icons are inline SVG glyphs (no external icon dependency) so the toolbar is
 * self-contained. Styling is scoped with the `pptx-vue-` class prefix.
 */
defineProps<{
	/** Whether the current selection can be grouped (≥ 2 elements). */
	canGroup: boolean;
	/** Whether the current selection can be ungrouped (a group is selected). */
	canUngroup: boolean;
}>();

const emit = defineEmits<{
	/** Align the selection to the given edge / centre line. */
	align: [edge: AlignEdge];
	/** Distribute the selection evenly along the given axis. */
	distribute: [axis: DistributeAxis];
	/** Wrap the selected elements into a new group. */
	group: [];
	/** Flatten the selected group back into its children. */
	ungroup: [];
}>();

const { t } = useI18n();

interface AlignButton {
	edge: AlignEdge;
	labelKey: string;
}

const alignButtons: readonly AlignButton[] = [
	{ edge: 'left', labelKey: 'pptx.align.left' },
	{ edge: 'centerH', labelKey: 'pptx.align.centerH' },
	{ edge: 'right', labelKey: 'pptx.align.right' },
	{ edge: 'top', labelKey: 'pptx.align.top' },
	{ edge: 'middle', labelKey: 'pptx.align.middle' },
	{ edge: 'bottom', labelKey: 'pptx.align.bottom' },
];

/**
 * Shared ghost icon-button classes: mirrors React's toolbar align buttons
 * (`hover:bg-accent`, focus ring, disabled fade) over semantic tokens.
 */
const ALIGN_BTN =
	'inline-flex items-center justify-center w-7 h-7 p-0 border-0 rounded bg-transparent text-current cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed';
</script>

<template>
	<div
		class="pptx-vue-align-toolbar inline-flex items-center gap-0.5 p-1 rounded-md bg-card border border-border text-foreground shadow-sm"
		role="toolbar"
		:aria-label="t('pptx.align.toolbarLabel')"
	>
		<button
			v-for="btn in alignButtons"
			:key="btn.edge"
			type="button"
			class="pptx-vue-align-btn"
			:class="ALIGN_BTN"
			:title="t(btn.labelKey)"
			:aria-label="t(btn.labelKey)"
			@click="emit('align', btn.edge)"
		>
			<!-- Horizontal-axis aligns: a vertical guide line + a bar. -->
			<svg
				v-if="btn.edge === 'left' || btn.edge === 'centerH' || btn.edge === 'right'"
				viewBox="0 0 16 16"
				width="16"
				height="16"
				aria-hidden="true"
			>
				<line
					:x1="btn.edge === 'left' ? 2 : btn.edge === 'right' ? 14 : 8"
					:y1="1"
					:x2="btn.edge === 'left' ? 2 : btn.edge === 'right' ? 14 : 8"
					:y2="15"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<rect
					:x="btn.edge === 'left' ? 2 : btn.edge === 'right' ? 4 : 4"
					y="4"
					width="10"
					height="3"
					fill="currentColor"
				/>
				<rect
					:x="btn.edge === 'left' ? 2 : btn.edge === 'right' ? 8 : 5"
					y="9"
					width="6"
					height="3"
					fill="currentColor"
				/>
			</svg>
			<!-- Vertical-axis aligns: a horizontal guide line + a bar. -->
			<svg v-else viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<line
					:x1="1"
					:y1="btn.edge === 'top' ? 2 : btn.edge === 'bottom' ? 14 : 8"
					:x2="15"
					:y2="btn.edge === 'top' ? 2 : btn.edge === 'bottom' ? 14 : 8"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<rect
					x="4"
					:y="btn.edge === 'top' ? 2 : btn.edge === 'bottom' ? 4 : 4"
					width="3"
					height="10"
					fill="currentColor"
				/>
				<rect
					x="9"
					:y="btn.edge === 'top' ? 2 : btn.edge === 'bottom' ? 8 : 5"
					width="3"
					height="6"
					fill="currentColor"
				/>
			</svg>
		</button>

		<span class="pptx-vue-align-sep w-px h-[18px] mx-[3px] bg-border" aria-hidden="true" />

		<button
			type="button"
			class="pptx-vue-align-btn"
			:class="ALIGN_BTN"
			:title="t('pptx.align.distributeHorizontally')"
			:aria-label="t('pptx.align.distributeHorizontally')"
			@click="emit('distribute', 'horizontal')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<rect x="0" y="3" width="3" height="10" fill="currentColor" />
				<rect x="6.5" y="3" width="3" height="10" fill="currentColor" />
				<rect x="13" y="3" width="3" height="10" fill="currentColor" />
			</svg>
		</button>
		<button
			type="button"
			class="pptx-vue-align-btn"
			:class="ALIGN_BTN"
			:title="t('pptx.align.distributeVertically')"
			:aria-label="t('pptx.align.distributeVertically')"
			@click="emit('distribute', 'vertical')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<rect x="3" y="0" width="10" height="3" fill="currentColor" />
				<rect x="3" y="6.5" width="10" height="3" fill="currentColor" />
				<rect x="3" y="13" width="10" height="3" fill="currentColor" />
			</svg>
		</button>

		<span class="pptx-vue-align-sep w-px h-[18px] mx-[3px] bg-border" aria-hidden="true" />

		<button
			type="button"
			class="pptx-vue-align-btn"
			:class="ALIGN_BTN"
			:title="t('pptx.align.group')"
			:aria-label="t('pptx.align.group')"
			:disabled="!canGroup"
			@click="emit('group')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<rect
					x="1.5"
					y="1.5"
					width="13"
					height="13"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
					stroke-dasharray="2 1.5"
				/>
				<rect x="3" y="3" width="5" height="5" fill="currentColor" />
				<rect x="8" y="8" width="5" height="5" fill="currentColor" />
			</svg>
		</button>
		<button
			type="button"
			class="pptx-vue-align-btn"
			:class="ALIGN_BTN"
			:title="t('pptx.align.ungroup')"
			:aria-label="t('pptx.align.ungroup')"
			:disabled="!canUngroup"
			@click="emit('ungroup')"
		>
			<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
				<rect x="2" y="2" width="6" height="6" fill="currentColor" />
				<rect x="9" y="9" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1" />
			</svg>
		</button>
	</div>
</template>
