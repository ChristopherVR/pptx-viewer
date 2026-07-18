<script setup lang="ts">
/**
 * TitleBarQuickAccess - the Quick Access Toolbar strip in the title bar,
 * rendering the ordered command list from File > Options > Quick Access
 * Toolbar. Icons come from the shared catalog's logical icon names, mapped to
 * lucide components here; tooltips run through the injected ScreenTip
 * resolver so Options > General > ScreenTip style applies.
 */
import {
	FileDown,
	Play,
	Plus,
	Printer,
	Redo,
	Save,
	SpellCheck,
	Undo,
	ZoomIn,
	ZoomOut,
} from 'lucide-vue-next';
import { TITLE_BAR_CLASSES as TB } from 'pptx-viewer-shared';
import type { FunctionalComponent } from 'vue';
import { inject } from 'vue';

import { ScreenTipKey } from '../../composables/useViewerOptionsStore';

export interface TitleBarQuickAccessItem {
	id: string;
	/** Translated command label. */
	label: string;
	/** Logical icon name from `QUICK_ACCESS_COMMAND_CATALOG`. */
	icon: string;
	disabled?: boolean;
}

const props = defineProps<{
	items: TitleBarQuickAccessItem[];
	/** Options > Quick Access Toolbar > "Always show command labels". */
	showLabels: boolean;
	onCommand: (id: string) => void;
}>();

const screenTip = inject(ScreenTipKey, (label: string) => label);

const ICONS: Record<string, FunctionalComponent> = {
	save: Save,
	undo: Undo,
	redo: Redo,
	play: Play,
	printer: Printer,
	fileDown: FileDown,
	plus: Plus,
	spellCheck: SpellCheck,
	zoomIn: ZoomIn,
	zoomOut: ZoomOut,
};
</script>

<template>
	<span class="pptx-vue-quick-access flex items-center gap-0.5" data-pptx-quick-access>
		<button
			v-for="item in props.items"
			:key="item.id"
			type="button"
			:class="TB.quickButton"
			:disabled="item.disabled"
			:title="screenTip(item.label)"
			:aria-label="item.label"
			@click="props.onCommand(item.id)"
		>
			<component :is="ICONS[item.icon] ?? Save" class="w-3.5 h-3.5" />
			<span v-if="props.showLabels" class="ml-1 text-[11px]">{{ item.label }}</span>
		</button>
	</span>
</template>
