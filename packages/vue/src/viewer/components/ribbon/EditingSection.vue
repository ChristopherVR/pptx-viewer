<script setup lang="ts">
/**
 * EditingSection: Find, Replace, and Select controls for the Home ribbon tab.
 * Vue port matching the React EditingSection component.
 */
import { ArrowRightLeft, ChevronDown, Search } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { vAnchoredPopup } from './anchored-popup';
import { ic, MENU_ITEM, MENU_PANEL, pill, SEP } from './ribbon-constants';
import { useDropdown } from './use-dropdown';

interface Props {
	onToggleFindReplace: () => void;
	onSelectAll?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

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
				:title="t('pptx.editing.find')"
				@mousedown.prevent
				@click="props.onToggleFindReplace()"
			>
				<Search :class="ic" />
			</button>

			<!-- Replace -->
			<button
				type="button"
				:class="pill"
				:title="t('pptx.ribbon.replace')"
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
					:title="t('pptx.ribbon.tool.select')"
					@mousedown.prevent
					@click="selectMenu.toggle()"
				>
					{{ t('pptx.ribbon.tool.select') }}
					<ChevronDown class="w-3 h-3" />
				</button>
				<div
					v-if="selectMenu.open.value"
					class="z-50 flex flex-col w-32 pt-1"
					v-anchored-popup="{ anchor: selectMenu.root.value, alignRight: true }"
				>
					<div :class="MENU_PANEL">
						<!-- `mousedown.prevent` is load-bearing, and its absence is why this
						     item did nothing once a producer was finally supplied: without it
						     the click blurs the canvas, and the deselect-on-outside-click
						     handler wipes the selection the command has just made. React's
						     item has always prevented it. -->
						<button type="button" :class="MENU_ITEM" @mousedown.prevent @click="handleSelectAll">
							{{ t('pptx.editing.selectAll') }}
						</button>
					</div>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.shortcuts.group.editing')
		}}</span>
	</div>
</template>
