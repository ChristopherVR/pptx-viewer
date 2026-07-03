<!--
	Arrange ribbon section: Vue port of React's `toolbar/ArrangeSection.tsx`.
	Faithful, mechanical port for visual + behavioral parity: align cluster,
	clipboard cluster, optional format-painter toggle, flip, layer ordering,
	duplicate, and delete. Class strings copied verbatim from React.
-->
<script setup lang="ts">
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, Paintbrush, Trash2 } from 'lucide-vue-next';
import type { PptxElement } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { gB, gL, grp, ic, pill, ALIGN_BTNS, DISTRIBUTE_BTNS } from './ribbon-constants';
import type { ElementClipboardPayload } from './ribbon-types';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	clipboardPayload: ElementClipboardPayload | null;
	onAlignElements: (align: string) => void;
	onDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onFlip: (direction: 'horizontal' | 'vertical') => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
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
			:title="t('pptx.ribbon.distribute' + d.k.charAt(0).toUpperCase() + d.k.slice(1) + 'ly')"
			@click="props.onDistributeElements(d.k)"
		>
			<component :is="d.icon" :class="ic" />
		</button>
	</div>
	<div :class="grp">
		<button :class="gB" :disabled="!hasSel" :title="t('pptx.arrange.copy')" @click="props.onCopy">
			<Copy :class="ic" />
		</button>
		<button :class="gB" :disabled="!canMut" :title="t('pptx.arrange.cut')" @click="props.onCut">
			{{ t('pptx.arrange.cut') }}
		</button>
		<button
			:class="gL"
			:disabled="!props.clipboardPayload || !props.canEdit"
			:title="t('pptx.arrange.paste')"
			@click="props.onPaste"
		>
			<ClipboardPaste :class="ic" />
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
