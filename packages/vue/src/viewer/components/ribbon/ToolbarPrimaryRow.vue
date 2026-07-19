<script setup lang="ts">
/**
 * ToolbarPrimaryRow: Vue port of React's `toolbar/ToolbarPrimaryRow.tsx`.
 *
 * The ribbon's quick-access strip: slides-pane toggle, then a right cluster of
 * comments, mode switcher, custom-show controls, inspector toggle, settings,
 * read-only badge, and the overflow menu.
 *
 * Undo/Redo and the Find button now live in the title bar; the Share button
 * moved to the tab row (`TabRowActions`), mirroring React's PowerPoint chrome.
 *
 * The React row also renders inline collaboration avatars from a
 * `useCollaboration()` context; in Vue collaboration is host-instantiated (not a
 * ribbon-level context), so that purely-decorative avatar cluster is omitted.
 */
import { MessageSquare, PanelLeft, PanelRight, Settings, Sparkles } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import CustomShowsControls from './CustomShowsControls.vue';
import ModeSwitcher from './ModeSwitcher.vue';
import OverflowMenu from './OverflowMenu.vue';
import { ic, ics, SEP } from './ribbon-constants';
import type { RibbonProps } from './ribbon-types';

interface Props extends RibbonProps {}

const props = defineProps<Props>();
const { t } = useI18n();

const qab =
	'p-1 max-md:p-2 max-md:min-h-[40px] max-md:min-w-[40px] rounded-sm transition-colors hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 active:opacity-70';
</script>

<template>
	<div class="flex items-center gap-0.5 max-md:gap-0 px-1.5 py-0.5 max-md:px-1">
		<!-- Left: Slides pane toggle -->
		<button
			v-if="props.mode !== 'present'"
			type="button"
			:class="cn(qab, !props.isSidebarCollapsed ? 'text-foreground' : 'text-muted-foreground')"
			:title="t('pptx.toolbar.toggleSlidesPanel')"
			:aria-label="t('pptx.toolbar.toggleSlidesPanel')"
			@click="props.onToggleSidebar()"
		>
			<PanelLeft :class="ic" />
		</button>

		<!-- Center spacer -->
		<div class="flex-1 min-w-2 max-md:min-w-1" />

		<!-- Right: Comments + Present + Inspector + Settings + Overflow -->
		<button
			v-if="props.mode === 'edit' || props.mode === 'master'"
			type="button"
			:class="
				cn(
					qab,
					'relative max-md:hidden',
					props.isCommentsPanelOpen ? 'text-foreground' : 'text-muted-foreground',
				)
			"
			:title="t('pptx.toolbar.comments')"
			:aria-label="t('pptx.toolbar.comments')"
			@click="props.onToggleComments?.()"
		>
			<MessageSquare :class="ics" />
			<span
				v-if="(props.slideCommentCount ?? 0) > 0"
				class="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary text-[8px] text-white leading-none"
			>
				{{ props.slideCommentCount }}
			</span>
		</button>

		<ModeSwitcher
			:mode="props.mode"
			:on-set-mode="props.onSetMode"
			:on-close-master-view="props.onCloseMasterView"
			:on-enter-presenter-view="props.onEnterPresenterView"
			:on-enter-rehearsal-mode="props.onEnterRehearsalMode"
			:on-open-set-up-slide-show="props.onOpenSetUpSlideShow"
			:on-open-broadcast-dialog="props.onOpenBroadcastDialog"
			:on-toggle-subtitles="props.onToggleSubtitles"
			:show-subtitles="props.showSubtitles"
		/>

		<CustomShowsControls
			:custom-shows="props.customShows"
			:active-custom-show-id="props.activeCustomShowId"
			:can-edit="props.canEdit"
			:is-current-slide-in-active-show="props.isCurrentSlideInActiveShow"
			:on-set-active-custom-show-id="props.onSetActiveCustomShowId"
			:on-create-custom-show="props.onCreateCustomShow"
			:on-rename-active-custom-show="props.onRenameActiveCustomShow"
			:on-delete-active-custom-show="props.onDeleteActiveCustomShow"
			:on-toggle-current-slide-in-active-show="props.onToggleCurrentSlideInActiveShow"
		/>

		<div :class="SEP" />

		<button
			v-if="props.mode === 'edit' || props.mode === 'master'"
			type="button"
			:class="cn(qab, props.isInspectorPaneOpen ? 'text-foreground' : 'text-muted-foreground')"
			:title="t('pptx.toolbar.toggleInspector')"
			:aria-label="t('pptx.toolbar.toggleInspector')"
			@click="props.onToggleInspector()"
		>
			<PanelRight :class="ic" />
		</button>

		<!-- AI assistant: only rendered when the host opts in via the `ai` prop -->
		<button
			v-if="props.aiEnabled && (props.mode === 'edit' || props.mode === 'master')"
			type="button"
			:class="cn(qab, props.isAiPanelOpen ? 'text-primary' : 'text-muted-foreground')"
			:title="t('pptx.toolbar.toggleAiAssistant')"
			:aria-label="t('pptx.toolbar.toggleAiAssistant')"
			@click="props.onToggleAiPanel?.()"
		>
			<Sparkles :class="ic" />
		</button>

		<!-- Settings -->
		<button
			type="button"
			:class="cn(qab, 'text-muted-foreground')"
			:title="t('pptx.toolbar.settingsShortcuts')"
			:aria-label="t('pptx.toolbar.settings')"
			@click="(props.onOpenSettings ?? props.onToggleShortcuts)()"
		>
			<Settings :class="ics" />
		</button>

		<span
			v-if="!props.canEdit"
			class="inline-flex items-center px-2 py-0.5 rounded-sm bg-amber-600/90 text-[10px] text-amber-50"
		>
			{{ t('pptx.toolbar.readOnly') }}
		</span>
		<OverflowMenu v-bind="props" />
	</div>
</template>
