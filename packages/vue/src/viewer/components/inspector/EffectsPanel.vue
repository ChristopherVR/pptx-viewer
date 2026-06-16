<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * EffectsPanel — element opacity plus outer-shadow and outer-glow controls.
 *
 * Opacity is an element-level field and is emitted as a SHALLOW patch
 * (`{ opacity }`). Shadow and glow live on `element.shapeStyle` as FLAT fields
 * (core `ShapeStyle` has no nested `outerShadow`/`glow` objects — see below), so
 * those controls emit the FULL merged sub-object: `{ shapeStyle: { ...current,
 * <fields> } }`. The parent merges every patch via `ops.updateElement(id, patch)`.
 *
 * Core `ShapeStyle` field mapping (authoritative — mirrors the React renderer's
 * shape-visual-style.ts and fill-stroke effect configs):
 *   Outer shadow → `shadowColor`, `shadowOpacity`, `shadowBlur`, `shadowAngle`,
 *                  `shadowDistance` (a shadow is "on" when `shadowColor` is set
 *                  and not `'transparent'`; disabled by `shadowColor:
 *                  'transparent'`).
 *   Outer glow   → `glowColor`, `glowRadius`, `glowOpacity` (on when `glowColor`
 *                  is set and not `'transparent'`; disabled by `glowColor:
 *                  'transparent'`, `glowRadius: 0`).
 *
 * Shadow/glow controls only apply to shape-like elements
 * (core `hasShapeProperties`). For other elements a muted note is shown.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

// Defaults mirror the React effect configs.
const DEFAULT_SHADOW_COLOR = '#000000';
const DEFAULT_SHADOW_OPACITY = 0.4;
const DEFAULT_SHADOW_BLUR = 6;
const DEFAULT_SHADOW_ANGLE = 315;
const DEFAULT_SHADOW_DISTANCE = 5.66;

const DEFAULT_GLOW_COLOR = '#ffff00';
const DEFAULT_GLOW_OPACITY = 0.75;
const DEFAULT_GLOW_RADIUS = 6;

const TRANSPARENT = 'transparent';

const isShapeLike = computed(() => hasShapeProperties(props.element));

const shapeStyle = computed<ShapeStyle>(() => {
	if (hasShapeProperties(props.element)) {
		return props.element.shapeStyle ?? {};
	}
	return {};
});

function clamp(value: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, value));
}

function toNumber(value: string): number | undefined {
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function emitShapeStyle(next: Partial<ShapeStyle>): void {
	emit('update', {
		shapeStyle: { ...shapeStyle.value, ...next },
	} as Partial<PptxElement>);
}

// ---------------------------------------------------------------------------
// Opacity (element-level, shallow patch)
// ---------------------------------------------------------------------------

const opacityPercent = computed(() => Math.round((props.element.opacity ?? 1) * 100));

function onOpacity(value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emit('update', { opacity: clamp(n, 0, 100) / 100 });
}

// ---------------------------------------------------------------------------
// Outer shadow
// ---------------------------------------------------------------------------

const shadowOn = computed(
	() => Boolean(shapeStyle.value.shadowColor) && shapeStyle.value.shadowColor !== TRANSPARENT,
);

const shadowColor = computed(() => {
	const c = shapeStyle.value.shadowColor;
	return c && c !== TRANSPARENT ? c : DEFAULT_SHADOW_COLOR;
});
const shadowBlur = computed(() => Math.round(shapeStyle.value.shadowBlur ?? DEFAULT_SHADOW_BLUR));
const shadowDistance = computed(
	() => Math.round((shapeStyle.value.shadowDistance ?? DEFAULT_SHADOW_DISTANCE) * 10) / 10,
);
const shadowAngle = computed(
	() => Math.round(shapeStyle.value.shadowAngle ?? DEFAULT_SHADOW_ANGLE) % 360,
);

function onToggleShadow(checked: boolean): void {
	if (checked) {
		emitShapeStyle({
			shadowColor: shadowColor.value,
			shadowOpacity: shapeStyle.value.shadowOpacity ?? DEFAULT_SHADOW_OPACITY,
			shadowBlur: shapeStyle.value.shadowBlur ?? DEFAULT_SHADOW_BLUR,
			shadowAngle: shapeStyle.value.shadowAngle ?? DEFAULT_SHADOW_ANGLE,
			shadowDistance: shapeStyle.value.shadowDistance ?? DEFAULT_SHADOW_DISTANCE,
		});
	} else {
		emitShapeStyle({ shadowColor: TRANSPARENT });
	}
}

function onShadowColor(value: string): void {
	emitShapeStyle({ shadowColor: value });
}

function onShadowBlur(value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emitShapeStyle({ shadowBlur: clamp(n, 0, 96) });
}

function onShadowDistance(value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emitShapeStyle({ shadowDistance: clamp(n, 0, 96) });
}

function onShadowAngle(value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emitShapeStyle({ shadowAngle: ((n % 360) + 360) % 360 });
}

// ---------------------------------------------------------------------------
// Outer glow
// ---------------------------------------------------------------------------

const glowOn = computed(
	() => Boolean(shapeStyle.value.glowColor) && shapeStyle.value.glowColor !== TRANSPARENT,
);

const glowColor = computed(() => {
	const c = shapeStyle.value.glowColor;
	return c && c !== TRANSPARENT ? c : DEFAULT_GLOW_COLOR;
});
const glowRadius = computed(() => Math.round(shapeStyle.value.glowRadius ?? DEFAULT_GLOW_RADIUS));

function onToggleGlow(checked: boolean): void {
	if (checked) {
		emitShapeStyle({
			glowColor: glowColor.value,
			glowOpacity: shapeStyle.value.glowOpacity ?? DEFAULT_GLOW_OPACITY,
			glowRadius: shapeStyle.value.glowRadius ?? DEFAULT_GLOW_RADIUS,
		});
	} else {
		emitShapeStyle({ glowColor: TRANSPARENT, glowRadius: 0 });
	}
}

function onGlowColor(value: string): void {
	emitShapeStyle({ glowColor: value });
}

function onGlowRadius(value: string): void {
	const n = toNumber(value);
	if (n === undefined) {
		return;
	}
	emitShapeStyle({ glowRadius: clamp(n, 0, 96) });
}
</script>

<template>
	<div class="pptx-vue-effects flex flex-col gap-3 text-xs">
		<label class="pptx-vue-effects-field flex flex-col gap-1">
			<span class="pptx-vue-effects-label text-muted-foreground"
				>Opacity ({{ opacityPercent }}%)</span
			>
			<input
				type="range"
				class="pptx-vue-effects-range w-full accent-primary"
				min="0"
				max="100"
				:value="opacityPercent"
				@input="onOpacity(($event.target as HTMLInputElement).value)"
			/>
		</label>

		<template v-if="isShapeLike">
			<div class="pptx-vue-effects-section flex flex-col gap-2">
				<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
					<input
						type="checkbox"
						:checked="shadowOn"
						@change="onToggleShadow(($event.target as HTMLInputElement).checked)"
					/>
					Outer Shadow
				</label>

				<div v-if="shadowOn" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
					<label class="pptx-vue-effects-field flex flex-col gap-1">
						<span class="pptx-vue-effects-label text-muted-foreground">Color</span>
						<input
							type="color"
							class="pptx-vue-effects-color w-full h-7 p-0 bg-muted border border-border rounded"
							:value="shadowColor"
							@input="onShadowColor(($event.target as HTMLInputElement).value)"
						/>
					</label>
					<label class="pptx-vue-effects-field flex flex-col gap-1">
						<span class="pptx-vue-effects-label text-muted-foreground">Blur</span>
						<input
							type="number"
							class="pptx-vue-effects-input bg-muted border border-border rounded px-2 py-1"
							min="0"
							max="96"
							:value="shadowBlur"
							@input="onShadowBlur(($event.target as HTMLInputElement).value)"
						/>
					</label>
					<label class="pptx-vue-effects-field flex flex-col gap-1">
						<span class="pptx-vue-effects-label text-muted-foreground">Distance</span>
						<input
							type="number"
							class="pptx-vue-effects-input bg-muted border border-border rounded px-2 py-1"
							min="0"
							max="96"
							:value="shadowDistance"
							@input="onShadowDistance(($event.target as HTMLInputElement).value)"
						/>
					</label>
					<label class="pptx-vue-effects-field flex flex-col gap-1">
						<span class="pptx-vue-effects-label text-muted-foreground">Angle</span>
						<input
							type="number"
							class="pptx-vue-effects-input bg-muted border border-border rounded px-2 py-1"
							min="0"
							max="360"
							:value="shadowAngle"
							@input="onShadowAngle(($event.target as HTMLInputElement).value)"
						/>
					</label>
				</div>
			</div>

			<div class="pptx-vue-effects-section flex flex-col gap-2">
				<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
					<input
						type="checkbox"
						:checked="glowOn"
						@change="onToggleGlow(($event.target as HTMLInputElement).checked)"
					/>
					Outer Glow
				</label>

				<div v-if="glowOn" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
					<label class="pptx-vue-effects-field flex flex-col gap-1">
						<span class="pptx-vue-effects-label text-muted-foreground">Color</span>
						<input
							type="color"
							class="pptx-vue-effects-color w-full h-7 p-0 bg-muted border border-border rounded"
							:value="glowColor"
							@input="onGlowColor(($event.target as HTMLInputElement).value)"
						/>
					</label>
					<label class="pptx-vue-effects-field flex flex-col gap-1">
						<span class="pptx-vue-effects-label text-muted-foreground">Radius</span>
						<input
							type="number"
							class="pptx-vue-effects-input bg-muted border border-border rounded px-2 py-1"
							min="0"
							max="96"
							:value="glowRadius"
							@input="onGlowRadius(($event.target as HTMLInputElement).value)"
						/>
					</label>
				</div>
			</div>
		</template>

		<p v-else class="pptx-vue-effects-note text-muted-foreground italic">
			Shadow and glow are only available on shape-like elements.
		</p>
	</div>
</template>
