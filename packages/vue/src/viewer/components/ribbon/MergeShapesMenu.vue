<script setup lang="ts">
/**
 * MergeShapesMenu: the Arrange group's "Merge Shapes" dropdown (Union /
 * Combine / Fragment / Intersect / Subtract). The list, its order and labels
 * come from the shared `MERGE_SHAPES_MENU_ITEMS`; the action is the injected
 * merge controller (`useMergeShapes`), which runs as one undo step.
 */
import { ChevronDown, SquaresUnite } from 'lucide-vue-next';
import type { MergeShapeOperation } from 'pptx-viewer-core';
import {
	MERGE_SHAPES_HINT_KEY,
	MERGE_SHAPES_LABEL_KEY,
	MERGE_SHAPES_MENU_ITEMS,
} from 'pptx-viewer-shared';
import { computed, inject, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { MergeCropKey } from '../../composables/merge-crop-context';
import { vAnchoredPopup } from './anchored-popup';
import { ic, MENU_ITEM, MENU_PANEL, pill } from './ribbon-constants';
import { useDropdown } from './use-dropdown';

const { t } = useI18n();
const controller = inject(MergeCropKey, undefined);
const menu = useDropdown();
/** The trigger the popup hangs below (not the wrapper, which contains the popup). */
const trigger = useTemplateRef<HTMLElement>('trigger');
const enabled = computed(() => Boolean(controller?.canMerge.value));

function run(op: MergeShapeOperation): void {
	menu.close();
	controller?.merge(op);
}
</script>

<template>
	<div :ref="menu.root" class="relative">
		<button
			ref="trigger"
			type="button"
			:class="pill"
			:disabled="!enabled"
			data-pptx-ribbon-control="merge-shapes"
			aria-haspopup="menu"
			:aria-expanded="menu.open.value ? 'true' : 'false'"
			:aria-label="t(MERGE_SHAPES_LABEL_KEY)"
			:title="enabled ? t(MERGE_SHAPES_LABEL_KEY) : t(MERGE_SHAPES_HINT_KEY)"
			@click="menu.toggle()"
		>
			<SquaresUnite :class="ic" />
			{{ t(MERGE_SHAPES_LABEL_KEY) }}
			<ChevronDown class="w-3 h-3" />
		</button>
		<div
			v-if="menu.open.value && enabled"
			class="z-50 flex flex-col w-40 pt-1"
			v-anchored-popup="{ anchor: trigger }"
		>
			<div :class="MENU_PANEL" role="menu" :aria-label="t(MERGE_SHAPES_LABEL_KEY)">
				<button
					v-for="item in MERGE_SHAPES_MENU_ITEMS"
					:key="item.operation"
					type="button"
					role="menuitem"
					:class="MENU_ITEM"
					:data-pptx-merge-op="item.operation"
					@click="run(item.operation)"
				>
					{{ t(item.labelKey) }}
				</button>
			</div>
		</div>
	</div>
</template>
