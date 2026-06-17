<script setup lang="ts">
/**
 * DrawSection — the Vue 3 port of React's `toolbar/DrawSection.tsx`. Renders the
 * Draw ribbon tab: the inking-tool button cluster (Select / Pen / Highlighter /
 * Eraser / Freeform) plus the pen-colour swatch and stroke-width slider. A
 * faithful, mechanical port for visual + behavioral parity — class strings are
 * copied verbatim and `cn` composes the active-tool highlight, exactly as React.
 * The shared `DRAW_TOOLS` table supplies lucide icon component refs, rendered via
 * `<component :is="…" />`.
 */
import { cn } from '../../../utils';
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
</script>

<template>
	<div :class="grp">
		<button
			v-for="(tool, i) in DRAW_TOOLS"
			:key="tool.id"
			type="button"
			:class="
				cn(
					i < DRAW_TOOLS.length - 1 ? gB : gL,
					props.activeTool === tool.id ? (tool.ac ?? 'bg-accent text-foreground') : '',
				)
			"
			:title="tool.t"
			@click="props.onSetActiveTool(tool.id)"
		>
			<component :is="tool.icon" :class="ic" />
		</button>
	</div>
	<div class="inline-flex items-center gap-2 text-xs">
		<label class="inline-flex items-center gap-1 text-muted-foreground" title="Pen colour">
			Colour
			<input
				type="color"
				:value="props.drawingColor"
				class="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
				@input="props.onSetDrawingColor(($event.target as HTMLInputElement).value)"
			/>
		</label>
		<label class="inline-flex items-center gap-1 text-muted-foreground" title="Stroke width">
			Width
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
