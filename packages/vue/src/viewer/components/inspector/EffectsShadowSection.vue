<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import {
	disableInnerShadowPatch,
	disableOuterShadowPatch,
	effectsStateOf,
	enableInnerShadowPatch,
	enableOuterShadowPatch,
	updateInnerShadowPatch,
	updateOuterShadowPatch,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';

/**
 * EffectsShadowSection: the outer-shadow and inner-shadow halves of
 * {@link EffectsPanel}, split out to keep that file under this repo's
 * 300-LOC-per-file budget. State extraction and patch-building both come from
 * shared's `effects-shadow-helpers.ts` (`outerShadowStateOf`/`innerShadowStateOf`
 * via `effectsStateOf`, `enable*Patch`/`disable*Patch`/`update*Patch`); this
 * component only maps DOM events onto those pure functions.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

const state = computed(() => effectsStateOf(props.element));

function toNumber(value: string): number | undefined {
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, value));
}

// ---------------------------------------------------------------------------
// Outer shadow
// ---------------------------------------------------------------------------

function onToggleShadow(checked: boolean): void {
	emit(
		'update',
		checked
			? enableOuterShadowPatch(props.element, state.value.outerShadow)
			: disableOuterShadowPatch(props.element),
	);
}
function onShadowColor(value: string): void {
	emit('update', updateOuterShadowPatch(props.element, { color: value }));
}
function onShadowColorCommit(value: string): void {
	recentColors?.push(value);
}
function onShadowBlur(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateOuterShadowPatch(props.element, { blur: clamp(n, 0, 96) }));
	}
}
function onShadowDistance(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateOuterShadowPatch(props.element, { distance: clamp(n, 0, 96) }));
	}
}
function onShadowAngle(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateOuterShadowPatch(props.element, { angle: ((n % 360) + 360) % 360 }));
	}
}
function onShadowRotateWithShape(checked: boolean): void {
	emit('update', updateOuterShadowPatch(props.element, { rotateWithShape: checked }));
}

// ---------------------------------------------------------------------------
// Inner shadow
// ---------------------------------------------------------------------------

function onToggleInnerShadow(checked: boolean): void {
	emit(
		'update',
		checked
			? enableInnerShadowPatch(props.element, state.value.innerShadow)
			: disableInnerShadowPatch(props.element),
	);
}
function onInnerShadowColor(value: string): void {
	emit('update', updateInnerShadowPatch(props.element, { color: value }));
}
function onInnerShadowColorCommit(value: string): void {
	recentColors?.push(value);
}
function onInnerShadowBlur(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateInnerShadowPatch(props.element, { blur: clamp(n, 0, 96) }));
	}
}
function onInnerShadowOffsetX(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateInnerShadowPatch(props.element, { offsetX: clamp(n, -96, 96) }));
	}
}
function onInnerShadowOffsetY(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateInnerShadowPatch(props.element, { offsetY: clamp(n, -96, 96) }));
	}
}
</script>

<template>
	<!-- Outer shadow -->
	<div
		class="pptx-vue-effects-section flex flex-col gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
	>
		<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
			<input
				type="checkbox"
				data-testid="fx-outer-shadow-toggle"
				:checked="state.outerShadow.enabled"
				@change="onToggleShadow(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.effects.outerShadow') }}
		</label>
		<div v-if="state.outerShadow.enabled" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.color')
				}}</span>
				<input
					type="color"
					class="pptx-vue-effects-color h-7 w-full rounded border border-border bg-muted p-0"
					:value="state.outerShadow.color"
					@input="onShadowColor(($event.target as HTMLInputElement).value)"
					@change="onShadowColorCommit(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.blur')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="96"
					:value="Math.round(state.outerShadow.blur)"
					@input="onShadowBlur(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.distance')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="96"
					:value="Math.round(state.outerShadow.distance * 10) / 10"
					@input="onShadowDistance(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.angle')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="360"
					:value="Math.round(state.outerShadow.angle) % 360"
					@input="onShadowAngle(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label
				class="pptx-vue-effects-check col-span-2 inline-flex items-center gap-2 text-foreground"
			>
				<input
					type="checkbox"
					data-testid="fx-outer-shadow-rotate-with-shape"
					:checked="state.outerShadow.rotateWithShape"
					@change="onShadowRotateWithShape(($event.target as HTMLInputElement).checked)"
				/>
				{{ t('pptx.effects.rotateWithShape') }}
			</label>
		</div>
	</div>

	<!-- Inner shadow -->
	<div
		class="pptx-vue-effects-section flex flex-col gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
	>
		<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
			<input
				type="checkbox"
				data-testid="fx-inner-shadow-toggle"
				:checked="state.innerShadow.enabled"
				@change="onToggleInnerShadow(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.effects.innerShadow') }}
		</label>
		<div v-if="state.innerShadow.enabled" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.color')
				}}</span>
				<input
					type="color"
					class="pptx-vue-effects-color h-7 w-full rounded border border-border bg-muted p-0"
					:value="state.innerShadow.color"
					@input="onInnerShadowColor(($event.target as HTMLInputElement).value)"
					@change="onInnerShadowColorCommit(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.blur')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="96"
					:value="Math.round(state.innerShadow.blur)"
					@input="onInnerShadowBlur(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.offsetX')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="-96"
					max="96"
					:value="Math.round(state.innerShadow.offsetX)"
					@input="onInnerShadowOffsetX(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.offsetY')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="-96"
					max="96"
					:value="Math.round(state.innerShadow.offsetY)"
					@input="onInnerShadowOffsetY(($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>
	</div>
</template>
