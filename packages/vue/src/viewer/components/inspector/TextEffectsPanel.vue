<script setup lang="ts">
import type { TextStyle } from 'pptx-viewer-core';
import { normalizeHexColor } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import {
	CLEAR_TEXT_GLOW,
	CLEAR_TEXT_REFLECTION,
	CLEAR_TEXT_SHADOW,
	clamp,
	createNumberHandler,
	DEFAULT_TEXT_GLOW,
	DEFAULT_TEXT_REFLECTION,
	DEFAULT_TEXT_SHADOW,
} from '../../composables/useTextEffects';

/**
 * TextEffectsPanel: shadow / glow / reflection authoring controls for text
 * runs, mirroring the React `TextEffectsPanel`. Each control emits an `update`
 * carrying a PARTIAL `TextStyle` patch; the parent (`TextPanel`) merges it onto
 * the current `textStyle` and forwards the full sub-object.
 */
const props = defineProps<{
	ts: TextStyle | undefined;
}>();

const emit = defineEmits<{
	update: [patch: Partial<TextStyle>];
}>();

const { t } = useI18n();
const recentColors = injectRecentColors();

function apply(patch: Partial<TextStyle>): void {
	emit('update', patch);
}

function onColorCommit(event: Event): void {
	recentColors?.push((event.target as HTMLInputElement).value);
}

const numChange = createNumberHandler(apply);

const hasShadow = computed(() =>
	Boolean(
		props.ts?.textShadowColor ||
		(typeof props.ts?.textShadowBlur === 'number' && props.ts.textShadowBlur > 0),
	),
);
const hasGlow = computed(() =>
	Boolean(
		props.ts?.textGlowColor ||
		(typeof props.ts?.textGlowRadius === 'number' && props.ts.textGlowRadius > 0),
	),
);
const hasReflection = computed(() => Boolean(props.ts?.textReflection));

function toggleShadow(checked: boolean): void {
	apply(checked ? { ...DEFAULT_TEXT_SHADOW } : { ...CLEAR_TEXT_SHADOW });
}
function toggleGlow(checked: boolean): void {
	apply(checked ? { ...DEFAULT_TEXT_GLOW } : { ...CLEAR_TEXT_GLOW });
}
function toggleReflection(checked: boolean): void {
	apply(checked ? { ...DEFAULT_TEXT_REFLECTION } : { ...CLEAR_TEXT_REFLECTION });
}

const INPUT_CLS = 'bg-muted border border-border rounded px-2 py-1';
const COLOR_CLS = 'h-8 bg-muted border border-border rounded px-1';
</script>

<template>
	<div class="pptx-vue-texteffects mt-2 rounded border border-border bg-card p-2 space-y-2">
		<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.textEffects.title') }}
		</div>

		<!-- Text Shadow -->
		<div class="space-y-1.5">
			<label class="inline-flex items-center gap-2 text-foreground">
				<input
					type="checkbox"
					:checked="hasShadow"
					@change="toggleShadow(($event.target as HTMLInputElement).checked)"
				/>
				{{ t('pptx.textEffects.shadow') }}
			</label>
			<div v-if="hasShadow" class="grid grid-cols-2 gap-2 pl-4">
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.color') }}</span>
					<input
						type="color"
						:class="COLOR_CLS"
						:value="normalizeHexColor(ts?.textShadowColor, '#000000')"
						@input="apply({ textShadowColor: ($event.target as HTMLInputElement).value })"
						@change="onColorCommit"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.opacity') }}</span>
					<input
						type="number"
						min="0"
						max="1"
						step="0.05"
						:class="INPUT_CLS"
						:value="Number(ts?.textShadowOpacity ?? 0.5).toFixed(2)"
						@input="numChange((v) => ({ textShadowOpacity: clamp(v, 0, 1) }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.blur') }}</span>
					<input
						type="number"
						min="0"
						max="50"
						step="1"
						:class="INPUT_CLS"
						:value="Math.round(ts?.textShadowBlur ?? 4)"
						@input="numChange((v) => ({ textShadowBlur: clamp(v, 0, 50) }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.offsetX') }}</span>
					<input
						type="number"
						min="-50"
						max="50"
						step="1"
						:class="INPUT_CLS"
						:value="Math.round(ts?.textShadowOffsetX ?? 2)"
						@input="numChange((v) => ({ textShadowOffsetX: v }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.offsetY') }}</span>
					<input
						type="number"
						min="-50"
						max="50"
						step="1"
						:class="INPUT_CLS"
						:value="Math.round(ts?.textShadowOffsetY ?? 2)"
						@input="numChange((v) => ({ textShadowOffsetY: v }))($event)"
					/>
				</label>
			</div>
		</div>

		<!-- Text Glow -->
		<div class="space-y-1.5">
			<label class="inline-flex items-center gap-2 text-foreground">
				<input
					type="checkbox"
					:checked="hasGlow"
					@change="toggleGlow(($event.target as HTMLInputElement).checked)"
				/>
				{{ t('pptx.textEffects.glow') }}
			</label>
			<div v-if="hasGlow" class="grid grid-cols-2 gap-2 pl-4">
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.color') }}</span>
					<input
						type="color"
						:class="COLOR_CLS"
						:value="normalizeHexColor(ts?.textGlowColor, '#ffff00')"
						@input="apply({ textGlowColor: ($event.target as HTMLInputElement).value })"
						@change="onColorCommit"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.opacity') }}</span>
					<input
						type="number"
						min="0"
						max="1"
						step="0.05"
						:class="INPUT_CLS"
						:value="Number(ts?.textGlowOpacity ?? 0.6).toFixed(2)"
						@input="numChange((v) => ({ textGlowOpacity: clamp(v, 0, 1) }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.size') }}</span>
					<input
						type="number"
						min="1"
						max="50"
						step="1"
						:class="INPUT_CLS"
						:value="Math.round(ts?.textGlowRadius ?? 6)"
						@input="numChange((v) => ({ textGlowRadius: clamp(v, 1, 50) }))($event)"
					/>
				</label>
			</div>
		</div>

		<!-- Text Reflection -->
		<div class="space-y-1.5">
			<label class="inline-flex items-center gap-2 text-foreground">
				<input
					type="checkbox"
					:checked="hasReflection"
					@change="toggleReflection(($event.target as HTMLInputElement).checked)"
				/>
				{{ t('pptx.textEffects.reflection') }}
			</label>
			<div v-if="hasReflection" class="grid grid-cols-2 gap-2 pl-4">
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.blur') }}</span>
					<input
						type="number"
						min="0"
						max="20"
						step="0.5"
						:class="INPUT_CLS"
						:value="Number(ts?.textReflectionBlur ?? 1).toFixed(1)"
						@input="numChange((v) => ({ textReflectionBlur: clamp(v, 0, 20) }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.offset') }}</span>
					<input
						type="number"
						min="0"
						max="20"
						step="1"
						:class="INPUT_CLS"
						:value="Math.round(ts?.textReflectionOffset ?? 3)"
						@input="numChange((v) => ({ textReflectionOffset: clamp(v, 0, 20) }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.startOpacity') }}</span>
					<input
						type="number"
						min="0"
						max="1"
						step="0.05"
						:class="INPUT_CLS"
						:value="Number(ts?.textReflectionStartOpacity ?? 0.5).toFixed(2)"
						@input="numChange((v) => ({ textReflectionStartOpacity: clamp(v, 0, 1) }))($event)"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-muted-foreground">{{ t('pptx.textEffects.endOpacity') }}</span>
					<input
						type="number"
						min="0"
						max="1"
						step="0.05"
						:class="INPUT_CLS"
						:value="Number(ts?.textReflectionEndOpacity ?? 0).toFixed(2)"
						@input="numChange((v) => ({ textReflectionEndOpacity: clamp(v, 0, 1) }))($event)"
					/>
				</label>
			</div>
		</div>
	</div>
</template>
