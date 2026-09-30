<script setup lang="ts">
/**
 * EditingSection: Find, Replace, and Select controls for the Home ribbon tab.
 * Vue port matching the React EditingSection component.
 */
import { useI18n } from 'vue-i18n';

import { vAnchoredPopup } from './anchored-popup';
import { ic, MENU_ITEM, MENU_PANEL, pill, SEP } from './ribbon-constants';
import RibbonIcon from './RibbonIcon';
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

	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.editing">
		<div class="flex items-center gap-1" data-pptx-chrome="editing-controls">
			<div data-pptx-chrome="control-cluster">
				<!-- Find -->
				<button
					type="button"
					data-ribbon-control="home.editing.find"
					:class="pill"
					:title="t('pptx.editing.find')"
					@mousedown.prevent
					@click="props.onToggleFindReplace()"
				>
					<RibbonIcon name="home.editing.find" :class="ic" />
				</button>

				<!-- Replace -->
				<button
					type="button"
					data-ribbon-control="home.editing.replace"
					:class="pill"
					:title="t('pptx.ribbon.replace')"
					@mousedown.prevent
					@click="props.onToggleFindReplace()"
				>
					<RibbonIcon name="home.editing.replace" :class="ic" />
				</button>
			</div>
			<!-- Select dropdown -->
			<div :ref="selectMenu.root" class="relative" data-ribbon-control="home.editing.select">
				<button
					type="button"
					:class="pill"
					:title="t('pptx.ribbon.tool.select')"
					@mousedown.prevent
					@click="selectMenu.toggle()"
				>
					<RibbonIcon name="home.editing.select" :class="ic" />
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
