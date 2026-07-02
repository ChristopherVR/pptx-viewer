<script setup lang="ts">
import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { FILL_MODE_OPTIONS, GRADIENT_TYPE_OPTIONS, PATTERN_OPTIONS } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * TableCellAdvancedFill: Vue port of React's inspector
 * `TableCellAdvancedFill.tsx`. Advanced (gradient / pattern) cell fill controls
 * plus cell margins. Fill-mode, gradient-type and pattern-preset option lists
 * come from `pptx-viewer-shared` (`render/table-advanced-fill.ts`); the i18n
 * keys are mapped to plain English labels to match the Vue viewer's copy.
 */
const props = defineProps<{
	cellStyle: PptxTableCellStyle;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxTableCellStyle>];
}>();

const FILL_MODE_LABELS: Record<string, string> = {
	'pptx.table.fillSolid': 'Solid',
	'pptx.table.fillGradient': 'Gradient',
	'pptx.table.fillPattern': 'Pattern',
	'pptx.table.fillNone': 'None',
};

const GRADIENT_TYPE_LABELS: Record<string, string> = {
	'pptx.table.gradientLinear': 'Linear',
	'pptx.table.gradientRadial': 'Radial',
};

const MARGIN_FIELDS: Array<[keyof PptxTableCellStyle, string]> = [
	['marginTop', 'Top'],
	['marginBottom', 'Bottom'],
	['marginLeft', 'Left'],
	['marginRight', 'Right'],
];

const fillMode = computed(() => props.cellStyle.fillMode ?? 'solid');
const gradientType = computed(() => props.cellStyle.gradientFillType ?? 'linear');
const gradientAngle = computed(() => props.cellStyle.gradientFillAngle ?? 90);
const gradientStops = computed(() => props.cellStyle.gradientFillStops ?? []);

function onFillModeChange(event: Event): void {
	const next = (event.target as HTMLSelectElement).value as PptxTableCellStyle['fillMode'];
	if (next === 'gradient') {
		emit('update', {
			fillMode: 'gradient',
			gradientFillType: props.cellStyle.gradientFillType ?? 'linear',
			gradientFillAngle: props.cellStyle.gradientFillAngle ?? 90,
			gradientFillStops: props.cellStyle.gradientFillStops ?? [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 100 },
			],
		});
	} else if (next === 'pattern') {
		emit('update', {
			fillMode: 'pattern',
			patternFillPreset: props.cellStyle.patternFillPreset ?? 'ltDnDiag',
			patternFillForeground: props.cellStyle.patternFillForeground ?? '#000000',
			patternFillBackground: props.cellStyle.patternFillBackground ?? '#FFFFFF',
		});
	} else {
		emit('update', { fillMode: next });
	}
}

function updateStop(index: number, patch: Partial<{ color: string; position: number }>): void {
	const next = gradientStops.value.map((s, i) => (i === index ? { ...s, ...patch } : s));
	emit('update', { gradientFillStops: next });
}

function addStop(): void {
	emit('update', {
		gradientFillStops: [...gradientStops.value, { color: '#888888', position: 50 }],
	});
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<label class="flex flex-col gap-1">
			<span class="text-[11px] text-muted-foreground">Fill type</span>
			<select
				class="w-full rounded border border-border bg-muted px-2 py-1 text-[11px]"
				:disabled="!canEdit"
				:value="fillMode"
				@change="onFillModeChange"
			>
				<option v-for="opt in FILL_MODE_OPTIONS" :key="opt.value ?? ''" :value="opt.value ?? ''">
					{{ FILL_MODE_LABELS[opt.i18nKey] ?? opt.i18nKey }}
				</option>
			</select>
		</label>

		<!-- Gradient controls -->
		<div v-if="fillMode === 'gradient'" class="flex flex-col gap-1.5">
			<div class="grid grid-cols-2 gap-1.5">
				<label class="flex flex-col gap-0.5">
					<span class="text-[11px] text-muted-foreground">Gradient</span>
					<select
						class="w-full rounded border border-border bg-muted px-2 py-1 text-[11px]"
						:disabled="!canEdit"
						:value="gradientType"
						@change="
							emit('update', {
								gradientFillType: ($event.target as HTMLSelectElement).value as 'linear' | 'radial',
							})
						"
					>
						<option v-for="o in GRADIENT_TYPE_OPTIONS" :key="o.value" :value="o.value">
							{{ GRADIENT_TYPE_LABELS[o.i18nKey] ?? o.i18nKey }}
						</option>
					</select>
				</label>
				<label v-if="gradientType === 'linear'" class="flex flex-col gap-0.5">
					<span class="text-[11px] text-muted-foreground">Angle</span>
					<input
						type="number"
						class="w-full rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
						:disabled="!canEdit"
						min="0"
						max="360"
						:value="gradientAngle"
						@input="
							emit('update', {
								gradientFillAngle: Number(($event.target as HTMLInputElement).value),
							})
						"
					/>
				</label>
			</div>

			<span class="text-[11px] text-muted-foreground">Colour stops</span>
			<div v-for="(stop, idx) in gradientStops" :key="idx" class="flex items-center gap-1">
				<input
					type="color"
					class="h-6 w-6 cursor-pointer rounded border border-border"
					:disabled="!canEdit"
					:value="stop.color"
					@input="updateStop(idx, { color: ($event.target as HTMLInputElement).value })"
				/>
				<input
					type="number"
					class="flex-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
					:disabled="!canEdit"
					min="0"
					max="100"
					:value="Math.round(stop.position)"
					@input="updateStop(idx, { position: Number(($event.target as HTMLInputElement).value) })"
				/>
				<span class="text-[10px] text-muted-foreground">%</span>
			</div>
			<button
				type="button"
				class="self-start text-[10px] text-primary hover:underline disabled:opacity-50"
				:disabled="!canEdit"
				@click="addStop"
			>
				Add stop
			</button>
		</div>

		<!-- Pattern controls -->
		<div v-else-if="fillMode === 'pattern'" class="flex flex-col gap-1.5">
			<label class="flex flex-col gap-0.5">
				<span class="text-[11px] text-muted-foreground">Pattern</span>
				<select
					class="w-full rounded border border-border bg-muted px-2 py-1 text-[11px]"
					:disabled="!canEdit"
					:value="cellStyle.patternFillPreset ?? 'ltDnDiag'"
					@change="
						emit('update', { patternFillPreset: ($event.target as HTMLSelectElement).value })
					"
				>
					<option v-for="p in PATTERN_OPTIONS" :key="p" :value="p">{{ p }}</option>
				</select>
			</label>
			<div class="grid grid-cols-2 gap-1.5">
				<label class="flex flex-col gap-0.5">
					<span class="text-[11px] text-muted-foreground">Foreground</span>
					<input
						type="color"
						class="h-7 w-full cursor-pointer rounded border border-border bg-transparent"
						:disabled="!canEdit"
						:value="cellStyle.patternFillForeground ?? '#000000'"
						@input="
							emit('update', { patternFillForeground: ($event.target as HTMLInputElement).value })
						"
					/>
				</label>
				<label class="flex flex-col gap-0.5">
					<span class="text-[11px] text-muted-foreground">Background</span>
					<input
						type="color"
						class="h-7 w-full cursor-pointer rounded border border-border bg-transparent"
						:disabled="!canEdit"
						:value="cellStyle.patternFillBackground ?? '#FFFFFF'"
						@input="
							emit('update', { patternFillBackground: ($event.target as HTMLInputElement).value })
						"
					/>
				</label>
			</div>
		</div>

		<!-- Cell margins -->
		<div class="flex flex-col gap-1">
			<span class="text-[11px] uppercase tracking-wide text-muted-foreground">Margins</span>
			<div class="grid grid-cols-2 gap-1.5">
				<label v-for="[key, label] in MARGIN_FIELDS" :key="key" class="flex flex-col gap-0.5">
					<span class="text-[11px] text-muted-foreground">{{ label }}</span>
					<input
						type="number"
						class="w-full rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
						:disabled="!canEdit"
						min="0"
						max="200"
						:value="(cellStyle[key] as number | undefined) ?? 0"
						@input="emit('update', { [key]: Number(($event.target as HTMLInputElement).value) })"
					/>
				</label>
			</div>
		</div>
	</div>
</template>
