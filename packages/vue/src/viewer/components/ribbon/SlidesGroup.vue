<script setup lang="ts">
/**
 * SlidesGroup: New Slide split button, Layout (apply to current), Reset, and
 * Section controls. Extracted from HomeSection to keep it under 300 LOC.
 * Vue port of React's `toolbar/SlidesGroup.tsx`.
 */
import { ChevronDown, FolderPlus, LayoutGrid, Plus, RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, MENU_ITEM, MENU_PANEL, pill } from './ribbon-constants';
import type { LayoutOption } from './ribbon-types';
import { useDropdown } from './use-dropdown';

interface Props {
	canEdit: boolean;
	layoutOptions: LayoutOption[];
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const layoutMenu = useDropdown();
const layoutApplyMenu = useDropdown();

function handleNewSlide(): void {
	if (props.layoutOptions.length > 0) {
		const first = props.layoutOptions[0];
		props.onInsertSlideFromLayout(first.path, first.name);
	}
}

function handlePickLayout(lo: LayoutOption): void {
	props.onInsertSlideFromLayout(lo.path, lo.name);
	layoutMenu.close();
}

function handleApplyLayout(lo: LayoutOption): void {
	props.onApplyLayout?.(lo.path);
	layoutApplyMenu.close();
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<!-- New Slide split button -->
			<div :ref="layoutMenu.root" class="relative inline-flex items-center">
				<button
					type="button"
					:disabled="!props.canEdit || props.layoutOptions.length === 0"
					:class="
						cn(pill, 'whitespace-nowrap', props.layoutOptions.length > 0 ? 'rounded-r-none' : '')
					"
					:title="t('pptx.home.newSlide')"
					@click="handleNewSlide()"
				>
					<Plus :class="ic" />
					{{ t('pptx.home.newSlide') }}
				</button>
				<button
					v-if="props.layoutOptions.length > 0"
					type="button"
					:disabled="!props.canEdit"
					class="inline-flex items-center justify-center self-stretch px-1 rounded-r bg-muted hover:bg-accent text-xs transition-colors border-l border-border/40 active:scale-95 active:opacity-80"
					:title="t('pptx.home.chooseLayout')"
					@click="layoutMenu.toggle()"
				>
					<ChevronDown class="w-3 h-3" />
				</button>
				<div
					v-if="layoutMenu.open.value"
					class="absolute left-0 top-full z-50 flex flex-col w-48 pt-1"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="lo in props.layoutOptions"
							:key="lo.path"
							type="button"
							:class="MENU_ITEM"
							@click="handlePickLayout(lo)"
						>
							{{ lo.name }}
						</button>
					</div>
				</div>
			</div>

			<!-- Layout (apply to current slide) -->
			<div :ref="layoutApplyMenu.root" class="relative inline-flex items-center">
				<button
					type="button"
					:disabled="!props.canEdit || props.layoutOptions.length === 0"
					:class="pill"
					title="Layout"
					@click="layoutApplyMenu.toggle()"
				>
					<LayoutGrid :class="ic" />
					Layout
				</button>
				<div
					v-if="layoutApplyMenu.open.value"
					class="absolute left-0 top-full z-50 flex flex-col w-48 pt-1"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="lo in props.layoutOptions"
							:key="lo.path"
							type="button"
							:class="MENU_ITEM"
							@click="handleApplyLayout(lo)"
						>
							{{ lo.name }}
						</button>
					</div>
				</div>
			</div>

			<!-- Reset -->
			<button
				type="button"
				:disabled="!props.canEdit"
				:class="pill"
				title="Reset Slide"
				@click="props.onResetSlide?.()"
			>
				<RotateCcw :class="ic" />
				Reset
			</button>

			<!-- Section -->
			<button
				type="button"
				:disabled="!props.canEdit"
				:class="pill"
				title="Add Section"
				@click="props.onAddSection?.()"
			>
				<FolderPlus :class="ic" />
				Section
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.sections.slides')
		}}</span>
	</div>
</template>
