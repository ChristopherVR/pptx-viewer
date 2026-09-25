<script setup lang="ts">
/**
 * DrawSection: the Vue 3 port of React's `toolbar/DrawSection.tsx`. Renders the
 * Draw ribbon tab: the inking-tool button cluster (Select / Pen / Highlighter /
 * Eraser / Freeform) plus the pen-colour swatch and stroke-width slider. A
 * faithful, mechanical port for visual + behavioral parity: class strings are
 * copied verbatim and `cn` composes the active-tool highlight, exactly as React.
 * The shared `DRAW_TOOLS` table supplies lucide icon component refs, rendered via
 * `<component :is="…" />`.
 */
import type { RibbonControlId } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { injectRecentColors } from '../../composables/recent-colors-context';
import { DRAW_TOOLS, gB, gL, grp, ic } from './ribbon-constants';
import type { DrawingTool } from './ribbon-types';

interface Props {
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	onSetActiveTool: (tool: DrawingTool) => void;
	onSetDrawingColor: (color: string) => void;
	onSetDrawingWidth: (width: number) => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

/** Catalogue ids of the tool buttons (Freeform has none). */
const DRAW_TOOL_CONTROLS: Partial<Record<DrawingTool, RibbonControlId>> = {
	select: 'draw.tools.select',
	pen: 'draw.tools.pen',
	highlighter: 'draw.tools.highlighter',
	eraser: 'draw.tools.eraser',
};

// The pen colour joins the deck's "Recent colours" list like every other
// picker, but only on `change` (the committed pick): `input` is the continuous
// stream while the dialog is dragged, which keeps driving the live pen colour.
const recentColors = injectRecentColors();
function commitPenColor(event: Event): void {
	recentColors?.push((event.target as HTMLInputElement).value);
}
</script>

<template>
	<div :class="grp" data-ribbon-group="draw.tools">
		<button
			v-for="(tool, i) in DRAW_TOOLS"
			:key="tool.id"
			type="button"
			:data-ribbon-control="DRAW_TOOL_CONTROLS[tool.id]"
			:class="
				cn(
					i < DRAW_TOOLS.length - 1 ? gB : gL,
					props.activeTool === tool.id ? (tool.ac ?? 'bg-accent text-foreground') : '',
				)
			"
			:title="t(tool.labelKey)"
			@click="props.onSetActiveTool(tool.id)"
		>
			<component :is="tool.icon" :class="ic" />
		</button>
	</div>
	<div class="inline-flex items-center gap-2 text-xs" data-ribbon-group="draw.tools">
		<label
			data-ribbon-control="draw.tools.penColor"
			class="inline-flex items-center gap-1 text-muted-foreground"
			:title="t('pptx.ribbon.penColour')"
		>
			{{ t('pptx.ribbon.colour') }}
			<input
				type="color"
				:value="props.drawingColor"
				class="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
				@input="props.onSetDrawingColor(($event.target as HTMLInputElement).value)"
				@change="commitPenColor"
			/>
		</label>
		<label
			data-ribbon-control="draw.tools.penWidth"
			class="inline-flex items-center gap-1 text-muted-foreground"
			:title="t('pptx.ribbon.strokeWidth')"
		>
			{{ t('pptx.ribbon.width') }}
			<input
				type="range"
				:min="1"
				:max="12"
				:value="props.drawingWidth"
				class="w-16 h-1 accent-primary"
				@input="props.onSetDrawingWidth(Number(($event.target as HTMLInputElement).value))"
			/>
			<span class="text-foreground w-4 text-right">{{ props.drawingWidth }}</span>
		</label>
	</div>
</template>
