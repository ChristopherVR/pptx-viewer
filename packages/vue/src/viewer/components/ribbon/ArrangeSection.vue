<!--
	Arrange ribbon section — Vue port of React's `toolbar/ArrangeSection.tsx`.
	Faithful, mechanical port for visual + behavioral parity: align cluster,
	clipboard cluster, optional format-painter toggle, flip, layer ordering,
	duplicate, and delete. Class strings copied verbatim from React.
-->
<script setup lang="ts">
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, Paintbrush, Trash2 } from 'lucide-vue-next';
import type { PptxElement } from 'pptx-viewer-core';
import { computed } from 'vue';

import { cn } from '../../../utils';
import { gB, gL, grp, ic, pill, ALIGN_BTNS } from './ribbon-constants';
import type { ElementClipboardPayload } from './ribbon-types';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	clipboardPayload: ElementClipboardPayload | null;
	onAlignElements: (align: string) => void;
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
			:title="`Align ${a.k}`"
			@click="props.onAlignElements(a.k)"
		>
			<component :is="a.icon" :class="[ic, a.rotate && 'rotate-90']" />
		</button>
	</div>
	<div :class="grp">
		<button :class="gB" :disabled="!hasSel" title="Copy" @click="props.onCopy">
			<Copy :class="ic" />
		</button>
		<button :class="gB" :disabled="!canMut" title="Cut" @click="props.onCut">Cut</button>
		<button
			:class="gL"
			:disabled="!props.clipboardPayload || !props.canEdit"
			title="Paste"
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
		title="Format Painter"
		@click="props.onToggleFormatPainter"
	>
		<Paintbrush :class="ic" />
		Format
	</button>
	<div :class="grp">
		<button
			type="button"
			:class="gB"
			:disabled="!canMut"
			title="Flip Horizontally"
			@click="props.onFlip('horizontal')"
		>
			Flip H
		</button>
		<button
			type="button"
			:class="gL"
			:disabled="!canMut"
			title="Flip Vertically"
			@click="props.onFlip('vertical')"
		>
			Flip V
		</button>
	</div>
	<div :class="grp">
		<button
			:class="gB"
			:disabled="!canMut"
			title="Send Backward"
			@click="props.onMoveLayer('backward')"
		>
			<ChevronDown :class="ic" />
		</button>
		<button
			:class="gB"
			:disabled="!canMut"
			title="Bring Forward"
			@click="props.onMoveLayer('forward')"
		>
			<ChevronUp :class="ic" />
		</button>
		<button
			:class="gB"
			:disabled="!canMut"
			title="Send to Back"
			@click="props.onMoveLayerToEdge('back')"
		>
			Back
		</button>
		<button
			:class="gL"
			:disabled="!canMut"
			title="Bring to Front"
			@click="props.onMoveLayerToEdge('front')"
		>
			Front
		</button>
	</div>
	<button :class="pill" :disabled="!canMut" title="Duplicate" @click="props.onDuplicate">
		<Copy :class="ic" />
		Duplicate
	</button>
	<button
		:disabled="!canMut"
		class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-700/80 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
		title="Delete"
		@click="props.onDelete"
	>
		<Trash2 :class="ic" />
		Delete
	</button>
</template>
