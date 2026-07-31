<script setup lang="ts">
import type { SmartArtLayoutType } from 'pptx-viewer-core';
import { SWITCHABLE_LAYOUT_TYPES } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { smartArtLayoutLabel } from '../../composables/useSmartArtEditing';

/**
 * SmartArtLayoutSwitcher: a compact grid of switchable layout categories.
 *
 * Vue port of the React `SmartArtLayoutSwitcher.tsx`. Clicking a tile asks the
 * parent to switch the SmartArt to that layout (preserving node data); the
 * parent runs core's `switchSmartArtLayout` via `useSmartArtEditing`. The
 * switchable set comes straight from core's `SWITCHABLE_LAYOUT_TYPES` so the two
 * stay in lockstep.
 */
const props = defineProps<{
	current: SmartArtLayoutType;
	canEdit: boolean;
}>();

const emit = defineEmits<{ switch: [layout: SmartArtLayoutType] }>();

const { t } = useI18n();

const layouts = computed<readonly SmartArtLayoutType[]>(() => SWITCHABLE_LAYOUT_TYPES);

/** `t` is an overloaded generic; narrow it to the plain shape the helper wants. */
function labelFor(layout: SmartArtLayoutType): string {
	return smartArtLayoutLabel(layout, (key: string) => t(key));
}

function onSwitch(layout: SmartArtLayoutType): void {
	if (!props.canEdit || layout === props.current) {
		return;
	}
	emit('switch', layout);
}
</script>

<template>
	<div class="pptx-vue-smartart-layouts space-y-1.5">
		<span class="text-[11px] text-muted-foreground">{{ t('pptx.smartart.switchLayout') }}</span>
		<div class="grid grid-cols-3 gap-1.5" data-testid="smartart-layouts">
			<button
				v-for="layout in layouts"
				:key="layout"
				type="button"
				:disabled="!canEdit"
				:data-testid="`smartart-layout-${layout}`"
				:aria-pressed="current === layout"
				class="flex flex-col items-center gap-0.5 rounded border p-1.5 text-[9px] leading-tight transition-colors"
				:class="[
					current === layout
						? 'border-primary bg-primary/15 text-primary'
						: 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
					!canEdit && 'opacity-50 cursor-not-allowed',
				]"
				:title="labelFor(layout)"
				@click="onSwitch(layout)"
			>
				<span class="truncate w-full text-center">{{ labelFor(layout) }}</span>
			</button>
		</div>
	</div>
</template>
