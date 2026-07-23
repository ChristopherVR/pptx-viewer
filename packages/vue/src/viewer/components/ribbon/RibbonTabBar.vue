<script setup lang="ts">
/**
 * RibbonTabBar: the ribbon's tab row (File / Home / Insert / … / Help tab
 * buttons, the Record + Share cluster, and the collapse toggle). Extracted
 * from `RibbonToolbar.vue` to keep that file under the repo's ~300 LOC
 * convention; this is purely a template split, the props are the same
 * `RibbonToolbar` already reads off `RibbonProps`.
 */
import { ChevronDown, ChevronUp } from 'lucide-vue-next';
import type { ToolbarActionId, ToolbarTabDefinition } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import type { ToolbarSection, ViewerMode } from './ribbon-types';
import TabRowActions from './TabRowActions.vue';

interface Props {
	toolbarSection: ToolbarSection;
	visibleTabs: ToolbarTabDefinition[];
	onSetToolbarSection: (section: ToolbarSection) => void;
	canEdit: boolean;
	onEnterRehearsalMode?: () => void;
	onSetMode: (mode: ViewerMode) => void;
	onOpenShareDialog?: () => void;
	onPackageForSharing?: () => void;
	isCollaborating?: boolean;
	collaboratorCount?: number;
	hiddenActions?: ToolbarActionId[];
	isCompactToolbarOpen: boolean;
	onToggleCompactToolbar: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<div
		role="tablist"
		class="flex items-center border-b border-border/60 px-1 max-md:overflow-x-auto max-md:scrollbar-none"
	>
		<button
			v-for="sec in props.visibleTabs"
			:key="sec.id"
			type="button"
			role="tab"
			:aria-selected="props.toolbarSection === sec.id"
			:class="
				cn(
					'relative px-3.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors max-md:min-h-[36px] max-md:px-3',
					props.toolbarSection === sec.id
						? sec.id === 'file'
							? 'text-white bg-primary/80 rounded-sm'
							: 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
						: sec.id === 'file'
							? 'text-primary hover:bg-primary/15 rounded-sm'
							: 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
				)
			"
			@click="props.onSetToolbarSection(sec.id)"
		>
			{{ t(sec.labelKey) }}
		</button>
		<div class="flex-1" />
		<TabRowActions
			:on-enter-rehearsal-mode="
				props.canEdit
					? (props.onEnterRehearsalMode ?? (() => props.onSetMode('present')))
					: undefined
			"
			:on-open-share-dialog="props.onOpenShareDialog"
			:on-package-for-sharing="props.onPackageForSharing"
			:is-collaborating="props.isCollaborating"
			:collaborator-count="props.collaboratorCount"
			:hidden-actions="props.hiddenActions"
		/>
		<button
			type="button"
			class="mr-1 inline-flex items-center justify-center rounded px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
			:aria-pressed="!props.isCompactToolbarOpen"
			:aria-label="
				props.isCompactToolbarOpen ? t('pptx.ribbon.collapseRibbon') : t('pptx.ribbon.expandRibbon')
			"
			:title="
				props.isCompactToolbarOpen ? t('pptx.ribbon.collapseRibbon') : t('pptx.ribbon.expandRibbon')
			"
			@click="props.onToggleCompactToolbar"
		>
			<component
				:is="props.isCompactToolbarOpen ? ChevronUp : ChevronDown"
				class="h-3.5 w-3.5"
				aria-hidden="true"
			/>
		</button>
	</div>
</template>
