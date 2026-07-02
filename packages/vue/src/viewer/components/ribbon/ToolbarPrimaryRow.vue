<script setup lang="ts">
/**
 * ToolbarPrimaryRow: Vue port of React's `toolbar/ToolbarPrimaryRow.tsx`.
 *
 * The ribbon's quick-access strip: slides-pane toggle, undo/redo, find, then a
 * right cluster of comments, mode switcher, custom-show controls, share,
 * inspector toggle, settings, and the overflow menu.
 *
 * The React row also renders inline collaboration avatars from a
 * `useCollaboration()` context; in Vue collaboration is host-instantiated (not a
 * ribbon-level context), so that purely-decorative avatar cluster is omitted;
 * the Share button still reflects/launches sharing via `onOpenShareDialog`.
 */
import {
	MessageSquare,
	PanelLeft,
	PanelRight,
	Redo,
	Search,
	Settings,
	Share2,
	Undo,
} from 'lucide-vue-next';
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
		<!-- Left: Slides pane toggle + Undo/Redo + Find -->
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
		<div :class="SEP" />
		<button
			type="button"
			:disabled="!props.canEdit || !props.canUndo"
			:class="cn(qab, 'text-muted-foreground')"
			:title="
				props.undoLabel
					? t('pptx.toolbar.undoAction', { action: props.undoLabel })
					: t('pptx.toolbar.undo')
			"
			:aria-label="t('pptx.toolbar.undo')"
			@click="props.onUndo()"
		>
			<Undo :class="ics" />
		</button>
		<button
			type="button"
			:disabled="!props.canEdit || !props.canRedo"
			:class="cn(qab, 'text-muted-foreground')"
			:title="
				props.redoLabel
					? t('pptx.toolbar.redoAction', { action: props.redoLabel })
					: t('pptx.toolbar.redo')
			"
			:aria-label="t('pptx.toolbar.redo')"
			@click="props.onRedo()"
		>
			<Redo :class="ics" />
		</button>
		<button
			v-if="props.mode === 'edit' || props.mode === 'master'"
			type="button"
			:class="
				cn(
					qab,
					'max-md:hidden',
					props.findReplaceOpen ? 'text-foreground' : 'text-muted-foreground',
				)
			"
			:title="t('pptx.findReplace.title')"
			:aria-label="t('pptx.findReplace.title')"
			@click="props.onToggleFindReplace()"
		>
			<Search :class="ics" />
		</button>

		<!-- Center spacer -->
		<div class="flex-1 min-w-2 max-md:min-w-1" />

		<!-- Right: Comments + Present + Share + Inspector + Settings + Overflow -->
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

		<!-- Share -->
		<button
			v-if="props.mode === 'edit' || props.mode === 'master'"
			type="button"
			class="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors bg-primary hover:bg-primary/90 text-white"
			:title="t('pptx.toolbar.share')"
			:aria-label="t('pptx.toolbar.share')"
			@click="(props.onOpenShareDialog ?? props.onPackageForSharing)()"
		>
			<Share2 class="w-3 h-3" />
			<span class="max-md:hidden">{{ t('pptx.toolbar.share') }}</span>
		</button>

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
