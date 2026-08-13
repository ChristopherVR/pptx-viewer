<script setup lang="ts">
import type { PptxElement, ShapeStyle, StrokeDashType } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * StrokePanel: line/border inspector for the Vue `pptx-vue-viewer` editor.
 *
 * Exposes the three core stroke properties (`strokeColor`, `strokeWidth`,
 * `strokeDash`) read from `element.shapeStyle`. Each control emits a SHALLOW
 * `update` patch carrying the FULL merged `shapeStyle` sub-object so the parent
 * can forward it verbatim to `ops.updateElement(id, patch)`.
 *
 * Only shape-like elements (`hasShapeProperties`) expose editable controls;
 * other element types show a muted note instead.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const DASH_OPTIONS: ReadonlyArray<{ value: StrokeDashType; i18nKey: string }> = [
	{ value: 'solid', i18nKey: 'pptx.stroke.dashSolid' },
	{ value: 'dash', i18nKey: 'pptx.stroke.dashDash' },
	{ value: 'dot', i18nKey: 'pptx.stroke.dashDot' },
	{ value: 'dashDot', i18nKey: 'pptx.stroke.dashDashDot' },
	{ value: 'sysDash', i18nKey: 'pptx.stroke.dashSysDash' },
	{ value: 'sysDot', i18nKey: 'pptx.stroke.dashSysDot' },
];

const applicable = computed(() => hasShapeProperties(props.element));

const shapeStyle = computed<ShapeStyle | undefined>(() =>
	hasShapeProperties(props.element) ? props.element.shapeStyle : undefined,
);

const strokeColor = computed<string>(() => shapeStyle.value?.strokeColor ?? '#000000');
const strokeWidth = computed<number>(() => shapeStyle.value?.strokeWidth ?? 1);
const strokeDash = computed<StrokeDashType>(() => shapeStyle.value?.strokeDash ?? 'solid');

function patchShapeStyle(next: Partial<ShapeStyle>): void {
	emit('update', { shapeStyle: { ...shapeStyle.value, ...next } } as Partial<PptxElement>);
}

function onColor(event: Event): void {
	patchShapeStyle({ strokeColor: (event.target as HTMLInputElement).value });
}

function onWidth(event: Event): void {
	const raw = Number.parseFloat((event.target as HTMLInputElement).value);
	patchShapeStyle({ strokeWidth: Number.isFinite(raw) ? Math.max(0, raw) : 0 });
}

function onDash(event: Event): void {
	patchShapeStyle({ strokeDash: (event.target as HTMLSelectElement).value as StrokeDashType });
}
</script>

<template>
	<div class="pptx-vue-stroke-panel flex flex-col gap-2 p-2">
		<h3
			class="pptx-vue-stroke-title text-xs font-semibold uppercase tracking-wide text-muted-foreground"
		>
			{{ t('pptx.inspector.line') }}
		</h3>

		<p v-if="!applicable" class="pptx-vue-stroke-muted text-xs text-muted-foreground">
			{{ t('pptx.stroke.noBorderProperties') }}
		</p>

		<div v-else class="pptx-vue-stroke-fields flex flex-col gap-2">
			<label class="pptx-vue-stroke-field flex flex-col gap-1">
				<span class="pptx-vue-stroke-label text-muted-foreground">{{
					t('pptx.inspector.color')
				}}</span>
				<input
					type="color"
					class="pptx-vue-stroke-color w-full h-8 bg-muted border border-border rounded p-0.5"
					:value="strokeColor"
					@input="onColor"
				/>
			</label>

			<label class="pptx-vue-stroke-field flex flex-col gap-1">
				<span class="pptx-vue-stroke-label text-muted-foreground">{{
					t('pptx.stroke.widthPx')
				}}</span>
				<input
					type="number"
					class="pptx-vue-stroke-input w-full bg-muted border border-border rounded px-2 py-1"
					min="0"
					step="0.5"
					:value="strokeWidth"
					@input="onWidth"
				/>
			</label>

			<label class="pptx-vue-stroke-field flex flex-col gap-1">
				<span class="pptx-vue-stroke-label text-muted-foreground">{{ t('pptx.stroke.dash') }}</span>
				<select
					:aria-label="t('pptx.stroke.dash')"
					class="pptx-vue-stroke-input w-full bg-muted border border-border rounded px-2 py-1"
					:value="strokeDash"
					@change="onDash"
				>
					<option v-for="opt in DASH_OPTIONS" :key="opt.value" :value="opt.value">
						{{ t(opt.i18nKey) }}
					</option>
				</select>
			</label>
		</div>
	</div>
</template>
