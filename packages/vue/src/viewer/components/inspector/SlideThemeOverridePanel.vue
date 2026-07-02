<script setup lang="ts">
/**
 * SlideThemeOverridePanel: per-slide colour-map override editing (Vue port of
 * React's `SlideThemeOverridePanel`). Toggles and edits the slide's
 * `clrMapOverride` (`p:clrMapOvr` / `a:overrideClrMapping`), remapping each
 * logical alias (bg1/tx1/accent1/...) to a theme colour-scheme slot.
 *
 * Emits `update` with a `Partial<PptxSlide>` patch; the host applies it to the
 * active slide with history (same path as the background controls).
 */
import type { ColorMapAliasKey, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import {
	COLOR_MAP_ALIAS_KEYS,
	DEFAULT_COLOR_MAP,
	THEME_COLOR_SCHEME_KEYS,
	hasNonTrivialOverride,
} from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
	defineProps<{ slide: PptxSlide | undefined; theme?: PptxTheme; canEdit?: boolean }>(),
	{ canEdit: true },
);

const emit = defineEmits<{ update: [patch: Partial<PptxSlide>] }>();

const { t } = useI18n();

/** Friendly labels for the 12 colour-map aliases. */
const ALIAS_LABELS: Record<ColorMapAliasKey, string> = {
	bg1: 'Background 1',
	tx1: 'Text 1',
	bg2: 'Background 2',
	tx2: 'Text 2',
	accent1: 'Accent 1',
	accent2: 'Accent 2',
	accent3: 'Accent 3',
	accent4: 'Accent 4',
	accent5: 'Accent 5',
	accent6: 'Accent 6',
	hlink: 'Hyperlink',
	folHlink: 'Followed Hyperlink',
};

const override = computed<Record<string, string> | undefined>(() => props.slide?.clrMapOverride);
const isActive = computed(() => hasNonTrivialOverride(override.value));
const aliasKeys = COLOR_MAP_ALIAS_KEYS;
const slotOptions = [...THEME_COLOR_SCHEME_KEYS];

function currentTarget(alias: ColorMapAliasKey): string {
	return override.value?.[alias] ?? DEFAULT_COLOR_MAP[alias];
}

/** Resolve a theme colour slot to a `#rrggbb` value for the preview swatch. */
function slotColor(slot: string): string | undefined {
	const scheme = props.theme?.colorScheme as Record<string, string | undefined> | undefined;
	const hex = scheme?.[slot];
	return hex ? `#${hex.replace(/^#/u, '')}` : undefined;
}

function onToggle(event: Event): void {
	if ((event.target as HTMLInputElement).checked) {
		const identity: Record<string, string> = {};
		for (const key of COLOR_MAP_ALIAS_KEYS) {
			identity[key] = DEFAULT_COLOR_MAP[key];
		}
		emit('update', { clrMapOverride: identity });
	} else {
		emit('update', { clrMapOverride: undefined });
	}
}

function onAliasChange(alias: ColorMapAliasKey, event: Event): void {
	const slot = (event.target as HTMLSelectElement).value;
	const next: Record<string, string> = { ...(override.value ?? {}), [alias]: slot };
	for (const key of COLOR_MAP_ALIAS_KEYS) {
		if (!next[key]) {
			next[key] = DEFAULT_COLOR_MAP[key];
		}
	}
	emit('update', { clrMapOverride: next });
}
</script>

<template>
	<div class="space-y-2">
		<label class="inline-flex items-center gap-2 text-xs">
			<input type="checkbox" :disabled="!canEdit" :checked="isActive" @change="onToggle" />
			{{ t('pptx.themeOverride.enableOverride') }}
		</label>

		<div v-if="isActive" class="space-y-1.5">
			<div v-for="alias in aliasKeys" :key="alias" class="flex items-center gap-2 text-[11px]">
				<span class="w-24 shrink-0 truncate text-muted-foreground" :title="ALIAS_LABELS[alias]">
					{{ ALIAS_LABELS[alias] }}
				</span>
				<span
					class="h-4 w-4 shrink-0 rounded-sm border border-border"
					:style="{ backgroundColor: slotColor(currentTarget(alias)) }"
				/>
				<select
					:disabled="!canEdit"
					:value="currentTarget(alias)"
					class="flex-1 rounded border border-border bg-muted px-1 py-0.5 text-[11px]"
					:aria-label="`${ALIAS_LABELS[alias]} target slot`"
					@change="(e) => onAliasChange(alias, e)"
				>
					<option v-for="slot in slotOptions" :key="slot" :value="slot">{{ slot }}</option>
				</select>
			</div>
		</div>
	</div>
</template>
