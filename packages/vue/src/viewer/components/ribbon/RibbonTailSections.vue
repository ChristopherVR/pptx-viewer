<script setup lang="ts">
/**
 * RibbonTailSections: the ribbon's deck-level tabs (Slide Show, Review, Record,
 * View, Help), as opposed to the content-authoring half that stays in the
 * shell.
 *
 * Split out of `RibbonToolbar.vue` so that shell stays inside the repo's
 * 300-LOC budget as the ribbon keeps growing: routing a dozen more props is the
 * one thing the shell is guaranteed to do again. It renders a fragment (no
 * wrapper element), so the shell's flex row still sees each section as a direct
 * child and the layout is byte-for-byte what it was.
 */
import { computed } from 'vue';

import { toCustomShowsControlsProps } from './custom-show-controls-props';
import HelpSection from './HelpSection.vue';
import RecordSection from './RecordSection.vue';
import ReviewSection from './ReviewSection.vue';
import type { RibbonProps } from './ribbon-types';
import SlideShowSection from './SlideShowSection.vue';
import ViewSection from './ViewSection.vue';

interface Props extends RibbonProps {}

const props = defineProps<Props>();

const s = computed(() => props.toolbarSection);
</script>

<template>
	<SlideShowSection
		v-if="s === 'slideShow'"
		:on-present="() => props.onSetMode('present')"
		:on-enter-presenter-view="props.onEnterPresenterView ?? (() => {})"
		:on-enter-rehearsal-mode="props.onEnterRehearsalMode ?? (() => {})"
		:on-open-set-up-slide-show="props.onOpenSetUpSlideShow ?? (() => {})"
		:on-toggle-hide-slide="props.onToggleHideSlide ?? (() => {})"
		:active-slide-hidden="props.activeSlideHidden ?? false"
		:on-open-broadcast-dialog="props.onOpenBroadcastDialog ?? (() => {})"
		:on-toggle-subtitles="props.onToggleSubtitles ?? (() => {})"
		:show-subtitles="props.showSubtitles ?? false"
		:on-set-mode="props.onSetMode"
		:custom-show-controls="toCustomShowsControlsProps(props)"
		:hidden-actions="props.hiddenActions"
	/>

	<ReviewSection
		v-if="s === 'review'"
		:can-edit="props.canEdit"
		:spell-check-enabled="props.spellCheckEnabled"
		:on-set-spell-check-enabled="props.onSetSpellCheckEnabled"
		:on-toggle-comments="props.onToggleComments"
		:is-comments-panel-open="props.isCommentsPanelOpen"
		:slide-comment-count="props.slideCommentCount"
		:on-compare="props.onCompare"
		:on-set-language="props.onOpenSettings"
		:on-open-accessibility-check="props.onRunAccessibilityCheck"
	/>

	<RecordSection
		v-if="s === 'record'"
		:on-record-from-beginning="props.onEnterRehearsalMode ?? (() => {})"
		:on-record-from-current="props.onEnterRehearsalMode ?? (() => {})"
	/>

	<ViewSection
		v-if="s === 'view'"
		:can-edit="props.canEdit"
		:edit-template-mode="props.editTemplateMode"
		:on-set-edit-template-mode="props.onSetEditTemplateMode"
		:spell-check-enabled="props.spellCheckEnabled"
		:on-set-spell-check-enabled="props.onSetSpellCheckEnabled"
		:show-grid="props.showGrid"
		:show-rulers="props.showRulers"
		:show-guides="props.showGuides"
		:snap-to-grid="props.snapToGrid"
		:snap-to-shape="props.snapToShape"
		:on-set-show-grid="props.onSetShowGrid"
		:on-set-show-rulers="props.onSetShowRulers"
		:on-set-show-guides="props.onSetShowGuides"
		:on-set-snap-to-grid="props.onSetSnapToGrid"
		:on-set-snap-to-shape="props.onSetSnapToShape"
		:on-add-guide="props.onAddGuide"
		:on-zoom-to-fit="props.onZoomToFit"
		:on-enter-master-view="props.onEnterMasterView"
		:is-selection-pane-open="props.isSelectionPaneOpen"
		:on-toggle-selection-pane="props.onToggleSelectionPane"
		:eyedropper-active="props.eyedropperActive"
		:on-toggle-eyedropper="props.onToggleEyedropper"
		:on-open-reading-view="props.onOpenReadingView"
		:on-open-outline-view="props.onOpenOutlineView"
	/>

	<HelpSection
		v-if="s === 'help'"
		:on-open-settings="props.onOpenSettings"
		:on-toggle-shortcuts="props.onToggleShortcuts"
		:on-run-accessibility-check="props.onRunAccessibilityCheck"
	/>
</template>
