<script setup lang="ts">
/**
 * EditingSection: Find, Replace, and Select controls for the Home ribbon tab.
 * Vue port matching the React EditingSection component.
 */
import { ArrowRightLeft, ChevronDown, Search } from 'lucide-vue-next';

import { ic, MENU_ITEM, MENU_PANEL, pill, SEP } from './ribbon-constants';
import { useDropdown } from './use-dropdown';

interface Props {
	onToggleFindReplace: () => void;
	onSelectAll?: () => void;
}

const props = defineProps<Props>();

const selectMenu = useDropdown();

function handleSelectAll(): void {
	props.onSelectAll?.();
	selectMenu.close();
}
</script>

<template>
	<div :class="SEP" />

	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<!-- Find -->
			<button
				type="button"
				:class="pill"
				title="Find"
				@mousedown.prevent
				@click="props.onToggleFindReplace()"
			>
				<Search :class="ic" />
			</button>

			<!-- Replace -->
			<button
				type="button"
				:class="pill"
				title="Replace"
				@mousedown.prevent
				@click="props.onToggleFindReplace()"
			>
				<ArrowRightLeft :class="ic" />
			</button>

			<!-- Select dropdown -->
			<div :ref="selectMenu.root" class="relative">
				<button
					type="button"
					:class="pill"
					title="Select"
					@mousedown.prevent
					@click="selectMenu.toggle()"
				>
					Select
					<ChevronDown class="w-3 h-3" />
				</button>
				<div
					v-if="selectMenu.open.value"
					class="absolute right-0 top-full z-50 flex flex-col w-32 pt-1"
				>
					<div :class="MENU_PANEL">
						<button type="button" :class="MENU_ITEM" @click="handleSelectAll">Select All</button>
					</div>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Editing</span>
	</div>
</template>
