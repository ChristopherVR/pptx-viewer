<!--
	Arrange ribbon section: Vue port of React's `toolbar/ArrangeSection.tsx`.
	Faithful, mechanical port for visual + behavioral parity: align cluster,
	optional format-painter toggle, flip, group/ungroup + outline width
	(`ShapeArrangeExtras.vue`), layer ordering, duplicate, and delete. Class
	strings copied verbatim from React.

	This group deliberately does NOT repeat Cut / Copy / Paste. It used to, and
	since the Home tab already renders the Clipboard group beside it, every one
	of those three commands appeared twice on the same tab under the same name:
	two buttons that claim to be "Copy" is a tab that cannot be addressed by
	name, by a user or by a test.
-->
<script setup lang="ts">
import { ChevronDown, ChevronUp, Copy, Paintbrush, Trash2 } from 'lucide-vue-next';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { gB, gL, grp, ic, pill, ALIGN_BTNS, DISTRIBUTE_BTNS } from './ribbon-constants';
import ShapeArrangeExtras from './ShapeArrangeExtras.vue';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** How many elements the multi-select currently holds; Group needs two. */
	selectedCount: number;
	onAlignElements: (align: string) => void;
	onDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	onFlip: (direction: 'horizontal' | 'vertical') => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	onGroupElements: () => void;
	onUngroupElement: () => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	formatPainterActive?: boolean;
	onToggleFormatPainter?: () => void;
	canActivateFormatPainter?: boolean;
}

const props = defineProps<Props>();

const { t } = useI18n();

const hasSel = computed(() => Boolean(props.selectedElement));
const canMut = computed(() => hasSel.value && props.canEdit);
</script>

<template>
	<div :class="grp">
		<button
			v-for="(a, i) in ALIGN_BTNS"
			:key="a.k"
			type="button"
			:class="i < ALIGN_BTNS.length - 1 ? gB : gL"
			:disabled="!canMut"
			:title="t('pptx.arrange.align', { direction: a.k })"
			@click="props.onAlignElements(a.k)"
		>
			<component :is="a.icon" :class="[ic, a.rotate && 'rotate-90']" />
		</button>
	</div>
	<div :class="grp">
		<button
			v-for="(d, i) in DISTRIBUTE_BTNS"
			:key="d.k"
			type="button"
			:class="i < DISTRIBUTE_BTNS.length - 1 ? gB : gL"
			:disabled="!props.canEdit || !props.canDistribute"
			:title="t('pptx.arrange.distribute' + d.k.charAt(0).toUpperCase() + d.k.slice(1))"
			@click="props.onDistributeElements(d.k)"
		>
			<component :is="d.icon" :class="ic" />
		</button>
	</div>
	<button
		v-if="props.onToggleFormatPainter"
		type="button"
		:disabled="
			!props.canEdit || (props.canActivateFormatPainter === false && !props.formatPainterActive)
		"
		data-testid="format-painter-toggle"
		:data-active="props.formatPainterActive ? 'true' : 'false'"
		:class="
			cn(pill, props.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')
		"
		:title="t('pptx.arrange.formatPainter')"
		@click="props.onToggleFormatPainter"
	>
		<Paintbrush :class="ic" />
		{{ t('pptx.arrange.format') }}
	</button>
	<div :class="grp">
		<button
			type="button"
			:class="gB"
			:disabled="!canMut"
			:title="t('pptx.arrange.flipHorizontally')"
			@click="props.onFlip('horizontal')"
		>
			{{ t('pptx.arrange.flipH') }}
		</button>
		<button
			type="button"
			:class="gL"
			:disabled="!canMut"
			:title="t('pptx.arrange.flipVertically')"
			@click="props.onFlip('vertical')"
		>
			{{ t('pptx.arrange.flipV') }}
		</button>
	</div>
	<ShapeArrangeExtras
		:can-edit="props.canEdit"
		:selected-element="props.selectedElement"
		:selected-count="props.selectedCount"
		:on-group-elements="props.onGroupElements"
		:on-ungroup-element="props.onUngroupElement"
		:on-update-element-style="props.onUpdateElementStyle"
	/>
	<div :class="grp">
		<button
			:class="gB"
			:disabled="!canMut"
			:title="t('pptx.arrange.sendBackward')"
			@click="props.onMoveLayer('backward')"
		>
			<ChevronDown :class="ic" />
		</button>
		<button
			:class="gB"
			:disabled="!canMut"
			:title="t('pptx.arrange.bringForward')"
			@click="props.onMoveLayer('forward')"
		>
			<ChevronUp :class="ic" />
		</button>
		<button
			:class="gB"
			:disabled="!canMut"
			:title="t('pptx.arrange.sendToBack')"
			@click="props.onMoveLayerToEdge('back')"
		>
			{{ t('pptx.arrange.back') }}
		</button>
		<button
			:class="gL"
			:disabled="!canMut"
			:title="t('pptx.arrange.bringToFront')"
			@click="props.onMoveLayerToEdge('front')"
		>
			{{ t('pptx.arrange.front') }}
		</button>
	</div>
	<button
		:class="pill"
		:disabled="!canMut"
		:title="t('pptx.arrange.duplicate')"
		@click="props.onDuplicate"
	>
		<Copy :class="ic" />
		{{ t('pptx.arrange.duplicate') }}
	</button>
	<button
		:disabled="!canMut"
		class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-700/80 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
		:title="t('pptx.arrange.delete')"
		@click="props.onDelete"
	>
		<Trash2 :class="ic" />
		{{ t('pptx.arrange.delete') }}
	</button>
</template>
