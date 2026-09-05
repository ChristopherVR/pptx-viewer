<script setup lang="ts">
/**
 * ShapeArrangeExtras: the Arrange group's shape-level extras, i.e. Group,
 * Ungroup and the outline-width spinner.
 *
 * Kept out of `ArrangeSection.vue` so neither file drifts past the 300-LOC
 * budget, and grouped together because all three are gated on the same thing:
 * a selection that is actually a shape (or, for Group, two of them). Vue used
 * to offer none of them from the ribbon even though the editor has carried the
 * group/ungroup ops and the stroke-width field since the port, which made the
 * Home tab quietly thinner than the reference's.
 */
import { Group, Ungroup } from 'lucide-vue-next';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import {
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	strokeWidthOf,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { gB, gL, grp, ic } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** How many elements the multi-select currently holds; Group needs two. */
	selectedCount: number;
	/** Whether every selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
	onGroupElements: () => void;
	onUngroupElement: () => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const canGroup = computed(() =>
	canGroupSelection(props.canEdit, props.selectedCount, props.selectionGroupable),
);
const canUngroup = computed(() => canUngroupSelection(props.canEdit, props.selectedElement));
// `canSetStrokeWidth` also requires `canEdit`, which this control does not
// gate on (the spinner is disabled by `!props.canEdit || !isShape` below, same
// as before the repoint), so it is checked with `canEdit` forced true here to
// isolate just the "is this a shape" half of the decision.
const isShape = computed(() => canSetStrokeWidth(true, props.selectedElement));
const strokeWidth = computed(() => strokeWidthOf(props.selectedElement));

function onStrokeWidthInput(event: Event): void {
	const next = Number((event.target as HTMLInputElement).value);
	if (Number.isFinite(next)) {
		props.onUpdateElementStyle({ strokeWidth: Math.max(0, next) });
	}
}
</script>

<template>
	<div :class="grp">
		<button
			type="button"
			:disabled="!canGroup"
			:class="gB"
			:title="t('pptx.contextMenu.group')"
			:aria-label="t('pptx.contextMenu.group')"
			@click="props.onGroupElements()"
		>
			<Group :class="ic" />
		</button>
		<button
			type="button"
			:disabled="!canUngroup"
			:class="gL"
			:title="t('pptx.contextMenu.ungroup')"
			:aria-label="t('pptx.contextMenu.ungroup')"
			@click="props.onUngroupElement()"
		>
			<Ungroup :class="ic" />
		</button>
	</div>
	<!--
		Named explicitly: the spinner has no visible caption in the ribbon, so
		without the aria-label it announces itself as an anonymous number box.
	-->
	<input
		type="number"
		min="0"
		max="120"
		step="0.5"
		:disabled="!props.canEdit || !isShape"
		:aria-label="t('pptx.ribbon.strokeWidth')"
		:title="t('pptx.ribbon.strokeWidth')"
		:value="strokeWidth"
		class="h-[26px] w-[52px] rounded border border-border bg-muted px-1 text-center text-[11px] text-foreground disabled:opacity-40"
		@input="onStrokeWidthInput"
	/>
</template>
