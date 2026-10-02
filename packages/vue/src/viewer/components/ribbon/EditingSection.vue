<script setup lang="ts">
/**
 * EditingSection: Find, Replace, and Select controls for the Home ribbon tab.
 * Vue port matching the React EditingSection component.
 */
import { editingHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
import { computed } from 'vue';
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

const editingState = computed(() => ({
	controls: editingHomeControls(),
	translate: homeSnapshotTranslator(['editing'], t),
}));

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
			<!-- Find and Replace: the shared Editing strip; both open the find panel. -->
			<pptx-ui-ribbon-home-editing
				:state.prop="editingState"
				@home-request="props.onToggleFindReplace()"
			/>
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
