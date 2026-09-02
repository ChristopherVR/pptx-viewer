<script setup lang="ts">
/**
 * SlideInspector: the right inspector shown when no element is selected,
 * mirroring React's `InspectorPane.tsx` no-selection state: an
 * [Elements | Properties | Comments] tab strip (Properties active by default),
 * with the Properties tab hosting `PresentationPropertiesPanel` (PRESENTATION,
 * THEME, THEME OVERRIDE, SLIDE SIZE, NOTES & HANDOUT, DOCUMENT) followed by the
 * Background card (`SlideBackgroundPanel`), matching React's section order.
 *
 * Slide transitions are edited from BOTH the ribbon's Transitions tab and the
 * SLIDE TRANSITION card `PresentationPropertiesPanel` renders, exactly as in
 * React. An earlier comment here claimed the ribbon owned them exclusively;
 * the ribbon was inert at the time and `SlideTransitionSection` was mounted
 * nowhere, so Vue had no transition-authoring path at all.
 */
import type {
	PptxAppProperties,
	PptxComment,
	PptxCommentMention,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandoutMaster,
	PptxModernCommentAuthor,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSlide,
	PptxSlideMaster,
	PptxTagCollection,
	PptxTheme,
	PptxThemeOption,
} from 'pptx-viewer-core';
import type { SlideSizeEmu } from 'pptx-viewer-shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../../types';
import CommentsPanel from '../CommentsPanel.vue';
import type { InspectorTab } from './inspector-cards';
import InspectorElementsTab from './InspectorElementsTab.vue';
import InspectorTabs from './InspectorTabs.vue';
import PresentationPropertiesPanel from './PresentationPropertiesPanel.vue';
import SlideBackgroundPanel from './SlideBackgroundPanel.vue';

const props = withDefaults(
	defineProps<{
		slide: PptxSlide | undefined;
		theme?: PptxTheme;
		presentationProperties?: PptxPresentationProperties;
		mobile?: boolean;
		canEdit?: boolean;
		editTemplateMode?: boolean;
		themeOptions?: PptxThemeOption[];
		slideMasters?: PptxSlideMaster[];
		canvasSize?: CanvasSize;
		/** The deck's `p:sldSz` in EMU, for the Slide Size card's preset match. */
		slideSize?: SlideSizeEmu;
		notesCanvasSize?: CanvasSize;
		notesMaster?: PptxNotesMaster;
		handoutMaster?: PptxHandoutMaster;
		coreProperties?: PptxCoreProperties;
		appProperties?: PptxAppProperties;
		customProperties?: PptxCustomProperty[];
		tagCollections?: PptxTagCollection[];
		comments?: PptxComment[];
		authorName?: string;
		/** Modern comment authors (`ppt/commentAuthors.xml`), for the `@`-mention typeahead. */
		modernCommentAuthors?: PptxModernCommentAuthor[];
		/** Read a layout/master's current background colour (template-edit mode). */
		getTemplateBackgroundColor?: (path: string) => string | undefined;
	}>(),
	{ canEdit: true, authorName: 'You' },
);

const emit = defineEmits<{
	'slide-update': [patch: Partial<PptxSlide>];
	'presentation-update': [patch: Partial<PptxPresentationProperties>];
	'apply-theme': [path: string, allMasters: boolean];
	'canvas-size-update': [size: CanvasSize];
	'slide-size-update': [size: SlideSizeEmu, canvas: CanvasSize];
	'update-core-properties': [patch: Partial<PptxCoreProperties>];
	'update-app-properties': [patch: Partial<PptxAppProperties>];
	'update-custom-properties': [props: PptxCustomProperty[]];
	'update-tag-collections': [next: PptxTagCollection[]];
	'set-template-background': [path: string, backgroundColor: string];
	'select-element': [id: string];
	'comment-add': [payload: { text: string; mentions?: PptxCommentMention[] }];
	'comment-remove': [id: string];
	'comment-resolve': [id: string];
	'comment-reply': [payload: { parentId: string; text: string; mentions?: PptxCommentMention[] }];
	close: [];
}>();

const { t } = useI18n();

/** Active tab; Properties by default, matching React's initial inspector tab. */
const activeTab = ref<InspectorTab>('properties');
</script>

<template>
	<aside
		:data-pptx-inspector="mobile ? undefined : ''"
		class="pptx-vue-inspector flex flex-col overflow-hidden bg-background box-border text-xs text-foreground"
		:class="mobile ? 'w-full' : 'w-72 flex-[0_0_18rem] border-l border-border'"
		:aria-label="t('pptx.viewer.slideProperties')"
	>
		<InspectorTabs
			:active-tab="activeTab"
			@set-tab="(tab) => (activeTab = tab)"
			@close="emit('close')"
		/>

		<div class="flex-1 overflow-y-auto p-3 space-y-3">
			<!-- Elements -->
			<InspectorElementsTab
				v-if="activeTab === 'elements'"
				:slide="slide"
				@select-element="(id) => emit('select-element', id)"
			/>

			<!-- Properties (no selection): presentation-level cards + background -->
			<template v-else-if="activeTab === 'properties'">
				<PresentationPropertiesPanel
					:slide="slide"
					:theme="theme"
					:presentation-properties="presentationProperties"
					:can-edit="canEdit"
					:theme-options="themeOptions"
					:slide-masters="slideMasters"
					:canvas-size="canvasSize"
					:slide-size="slideSize"
					:notes-canvas-size="notesCanvasSize"
					:notes-master="notesMaster"
					:handout-master="handoutMaster"
					:core-properties="coreProperties"
					:app-properties="appProperties"
					:custom-properties="customProperties"
					:tag-collections="tagCollections"
					@presentation-update="(patch) => emit('presentation-update', patch)"
					@apply-theme="(path, allMasters) => emit('apply-theme', path, allMasters)"
					@slide-update="(patch) => emit('slide-update', patch)"
					@canvas-size-update="(size) => emit('canvas-size-update', size)"
					@slide-size-update="(size, canvas) => emit('slide-size-update', size, canvas)"
					@update-core-properties="(patch) => emit('update-core-properties', patch)"
					@update-app-properties="(patch) => emit('update-app-properties', patch)"
					@update-custom-properties="(next) => emit('update-custom-properties', next)"
					@update-tag-collections="(next) => emit('update-tag-collections', next)"
				/>

				<SlideBackgroundPanel
					v-if="slide"
					:slide="slide"
					:can-edit="canEdit"
					:edit-template-mode="editTemplateMode"
					:slide-masters="slideMasters"
					:get-template-background-color="getTemplateBackgroundColor"
					@update="(patch) => emit('slide-update', patch)"
					@set-template-background="(path, color) => emit('set-template-background', path, color)"
				/>
			</template>

			<!-- Comments -->
			<CommentsPanel
				v-else
				class="!border-l-0"
				:comments="comments ?? []"
				:author-name="authorName"
				:modern-comment-authors="modernCommentAuthors ?? []"
				@add="(payload) => emit('comment-add', payload)"
				@remove="(id) => emit('comment-remove', id)"
				@resolve="(id) => emit('comment-resolve', id)"
				@reply="(payload) => emit('comment-reply', payload)"
			/>
		</div>
	</aside>
</template>
