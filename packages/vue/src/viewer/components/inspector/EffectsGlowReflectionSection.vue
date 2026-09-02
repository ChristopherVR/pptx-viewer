<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import {
	disableGlowPatch,
	disableReflectionPatch,
	disableSoftEdgePatch,
	effectsStateOf,
	enableGlowPatch,
	enableReflectionPatch,
	enableSoftEdgePatch,
	updateGlowPatch,
	updateReflectionPatch,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * EffectsGlowReflectionSection: the outer-glow, reflection, and soft-edge
 * thirds of {@link EffectsPanel}, split out to keep that file under this
 * repo's 300-LOC-per-file budget. State extraction and patch-building both
 * come from shared's `effects-helpers.ts` (`effectsStateOf`,
 * `enable*Patch`/`disable*Patch`/`update*Patch`); this component only maps DOM
 * events onto those pure functions.
 */
const props = defineProps<{
	element: PptxElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<PptxElement>];
}>();

const { t } = useI18n();

const state = computed(() => effectsStateOf(props.element));

function toNumber(value: string): number | undefined {
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, value));
}

// ---------------------------------------------------------------------------
// Outer glow
// ---------------------------------------------------------------------------

function onToggleGlow(checked: boolean): void {
	emit(
		'update',
		checked ? enableGlowPatch(props.element, state.value.glow) : disableGlowPatch(props.element),
	);
}
function onGlowColor(value: string): void {
	emit('update', updateGlowPatch(props.element, { color: value }));
}
function onGlowRadius(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateGlowPatch(props.element, { radius: clamp(n, 0, 96) }));
	}
}
function onGlowOpacity(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateGlowPatch(props.element, { opacity: clamp(n, 0, 100) / 100 }));
	}
}

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------

function onToggleReflection(checked: boolean): void {
	emit(
		'update',
		checked
			? enableReflectionPatch(props.element, state.value.reflection)
			: disableReflectionPatch(props.element),
	);
}
function onReflectionField(
	field: 'blurRadius' | 'startOpacity' | 'endOpacity' | 'distance' | 'direction',
	value: string,
): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', updateReflectionPatch(props.element, { [field]: n }));
	}
}

// ---------------------------------------------------------------------------
// Soft edge
// ---------------------------------------------------------------------------

function onToggleSoftEdge(checked: boolean): void {
	emit(
		'update',
		checked
			? enableSoftEdgePatch(props.element, state.value.softEdge.radius || 6)
			: disableSoftEdgePatch(props.element),
	);
}
function onSoftEdgeRadius(value: string): void {
	const n = toNumber(value);
	if (n !== undefined) {
		emit('update', enableSoftEdgePatch(props.element, clamp(n, 0, 96)));
	}
}
</script>

<template>
	<!-- Outer glow -->
	<div
		class="pptx-vue-effects-section flex flex-col gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
	>
		<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
			<input
				type="checkbox"
				data-testid="fx-glow-toggle"
				:checked="state.glow.enabled"
				@change="onToggleGlow(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.effects.outerGlow') }}
		</label>
		<div v-if="state.glow.enabled" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.color')
				}}</span>
				<input
					type="color"
					class="pptx-vue-effects-color h-7 w-full rounded border border-border bg-muted p-0"
					:value="state.glow.color"
					@input="onGlowColor(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.radius')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="96"
					:value="Math.round(state.glow.radius)"
					@input="onGlowRadius(($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.inspector.opacity')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="100"
					:value="Math.round(state.glow.opacity * 100)"
					@input="onGlowOpacity(($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>
	</div>

	<!-- Reflection -->
	<div
		class="pptx-vue-effects-section flex flex-col gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
	>
		<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
			<input
				type="checkbox"
				data-testid="fx-reflection-toggle"
				:checked="state.reflection.enabled"
				@change="onToggleReflection(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.effects.reflection') }}
		</label>
		<div v-if="state.reflection.enabled" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.blur')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="20"
					step="0.5"
					:value="state.reflection.blurRadius"
					@input="onReflectionField('blurRadius', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.startPercent')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="100"
					:value="Math.round(state.reflection.startOpacity)"
					@input="onReflectionField('startOpacity', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.endPercent')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="100"
					:value="Math.round(state.reflection.endOpacity)"
					@input="onReflectionField('endOpacity', ($event.target as HTMLInputElement).value)"
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
					max="50"
					:value="Math.round(state.reflection.distance)"
					@input="onReflectionField('distance', ($event.target as HTMLInputElement).value)"
				/>
			</label>
			<label class="pptx-vue-effects-field col-span-2 flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.direction')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="360"
					:value="Math.round(state.reflection.direction)"
					@input="onReflectionField('direction', ($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>
	</div>

	<!-- Soft edge -->
	<div
		class="pptx-vue-effects-section flex flex-col gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
	>
		<label class="pptx-vue-effects-check inline-flex items-center gap-2 text-foreground">
			<input
				type="checkbox"
				data-testid="fx-soft-edge-toggle"
				:checked="state.softEdge.enabled"
				@change="onToggleSoftEdge(($event.target as HTMLInputElement).checked)"
			/>
			{{ t('pptx.effects.softEdge') }}
		</label>
		<div v-if="state.softEdge.enabled" class="pptx-vue-effects-grid grid grid-cols-2 gap-2">
			<label class="pptx-vue-effects-field flex flex-col gap-1">
				<span class="pptx-vue-effects-label text-muted-foreground">{{
					t('pptx.effects.radius')
				}}</span>
				<input
					type="number"
					class="pptx-vue-effects-input rounded border border-border bg-muted px-2 py-1"
					min="0"
					max="96"
					:value="Math.round(state.softEdge.radius)"
					@input="onSoftEdgeRadius(($event.target as HTMLInputElement).value)"
				/>
			</label>
		</div>
	</div>
</template>
