<script setup lang="ts">
import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
import { computed } from 'vue';

import DebouncedColorInput from './DebouncedColorInput.vue';
import ThemeColorSwatchGrid from './ThemeColorSwatchGrid.vue';

/**
 * A table cell colour field: the native colour input plus the deck's theme
 * colour grid, used for both the cell text colour (`color`/`colorRef`) and
 * the cell fill colour (`backgroundColor`/`backgroundColorRef`). Extracted
 * so `TableCellFormattingPanel.vue` (already near the 300-LOC file budget)
 * does not have to duplicate this block for both fields.
 *
 * A theme swatch commits both the resolved hex and its `PptxThemeColorRef`;
 * the native picker always clears the ref, since a plain hex has no theme
 * identity for PowerPoint to reapply.
 */
const props = defineProps<{
	label: string;
	value: string | undefined;
	fallback: string;
	selectedRef: PptxThemeColorRef | undefined;
	disabled: boolean;
	ariaLabel?: string;
}>();

const emit = defineEmits<{
	commit: [hex: string, ref: PptxThemeColorRef | undefined];
}>();

function isHex(value: string | undefined): value is string {
	return typeof value === 'string' && /^#(?<hex>[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(value);
}

const hex = computed(() => (isHex(props.value) ? props.value : props.fallback));

function onNativeCommit(next: string): void {
	emit('commit', next, undefined);
}

function onThemePick(commit: ThemeColorPickerCommit): void {
	emit('commit', commit.hex, commit.ref);
}
</script>

<template>
	<label class="flex flex-col gap-1">
		<span class="text-[11px] text-muted-foreground">{{ label }}</span>
		<DebouncedColorInput
			:value="hex"
			:disabled="disabled"
			:aria-label="ariaLabel"
			@commit="onNativeCommit"
		/>
		<ThemeColorSwatchGrid
			:disabled="disabled"
			:selected-ref="selectedRef"
			:selected-hex="hex"
			@pick="onThemePick"
		/>
	</label>
</template>
