<script setup lang="ts">
/**
 * PresentationPropertiesPanel: the no-selection Properties tab body, mirroring
 * React's `inspector/PresentationPropertiesPanel.tsx` section order:
 * PRESENTATION, THEME, THEME OVERRIDE, SLIDE SIZE, NOTES & HANDOUT, DOCUMENT,
 * then a small read-only Slide info card. Also ports React's
 * `useInspectorPaneState` selected-theme-path handling (falls back to the first
 * master's theme path when the package lists no theme options).
 */
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSlide,
	PptxSlideMaster,
	PptxTheme,
	PptxThemeOption,
} from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../../types';
import DocumentPropertiesCard from './DocumentPropertiesCard.vue';
import { CARD, HEADING } from './inspector-cards';
import NotesHandoutCard from './NotesHandoutCard.vue';
import PresentationSettingsCard from './PresentationSettingsCard.vue';
import SlideSizeCard from './SlideSizeCard.vue';
import SlideThemeOverridePanel from './SlideThemeOverridePanel.vue';
import ThemeSelectorCard from './ThemeSelectorCard.vue';

const props = withDefaults(
	defineProps<{
		slide: PptxSlide | undefined;
		theme?: PptxTheme;
		presentationProperties?: PptxPresentationProperties;
		canEdit?: boolean;
		themeOptions?: PptxThemeOption[];
		slideMasters?: PptxSlideMaster[];
		canvasSize?: CanvasSize;
		notesCanvasSize?: CanvasSize;
		notesMaster?: PptxNotesMaster;
		handoutMaster?: PptxHandoutMaster;
		coreProperties?: PptxCoreProperties;
		appProperties?: PptxAppProperties;
		customProperties?: PptxCustomProperty[];
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	'presentation-update': [patch: Partial<PptxPresentationProperties>];
	'apply-theme': [path: string, allMasters: boolean];
	'slide-update': [patch: Partial<PptxSlide>];
	'canvas-size-update': [size: CanvasSize];
	'update-core-properties': [patch: Partial<PptxCoreProperties>];
	'update-app-properties': [patch: Partial<PptxAppProperties>];
	'update-custom-properties': [props: PptxCustomProperty[]];
}>();

const { t } = useI18n();

// ── Theme selection (React's useInspectorPaneState) ─────────────────────
const activeThemePath = computed(() => props.slideMasters?.[0]?.themePath);
const effectiveThemeOptions = computed<PptxThemeOption[]>(() => {
	const options = props.themeOptions ?? [];
	if (options.length > 0 || !activeThemePath.value) {
		return options;
	}
	return [{ path: activeThemePath.value, name: props.theme?.name }];
});

const selectedThemePath = ref('');
watch(
	[activeThemePath, effectiveThemeOptions],
	() => {
		selectedThemePath.value = activeThemePath.value ?? effectiveThemeOptions.value[0]?.path ?? '';
	},
	{ immediate: true },
);
</script>

<template>
	<div class="space-y-3">
		<div v-if="props.presentationProperties" :class="CARD">
			<div :class="HEADING">{{ t('pptx.slideInspector.presentation') }}</div>
			<PresentationSettingsCard
				:presentation-properties="props.presentationProperties"
				:can-edit="props.canEdit"
				@update="(patch) => emit('presentation-update', patch)"
			/>
		</div>

		<ThemeSelectorCard
			:theme-options="effectiveThemeOptions"
			:selected-theme-path="selectedThemePath"
			:can-edit="props.canEdit"
			@select-theme-path="(path) => (selectedThemePath = path)"
			@apply-theme="(path, allMasters) => emit('apply-theme', path, allMasters)"
		/>

		<div :class="CARD">
			<div :class="HEADING">{{ t('pptx.themeOverride.heading') }}</div>
			<SlideThemeOverridePanel
				:slide="props.slide"
				:theme="props.theme"
				:can-edit="props.canEdit"
				@update="(patch) => emit('slide-update', patch)"
			/>
		</div>

		<SlideSizeCard
			v-if="props.canvasSize"
			:canvas-size="props.canvasSize"
			:can-edit="props.canEdit"
			@update="(size) => emit('canvas-size-update', size)"
		/>

		<NotesHandoutCard
			:notes-canvas-size="props.notesCanvasSize"
			:notes-master="props.notesMaster"
			:handout-master="props.handoutMaster"
		/>

		<DocumentPropertiesCard
			:core-properties="props.coreProperties"
			:app-properties="props.appProperties"
			:custom-properties="props.customProperties ?? []"
			:can-edit="props.canEdit"
			@update-core="(patch) => emit('update-core-properties', patch)"
			@update-app="(patch) => emit('update-app-properties', patch)"
			@update-custom="(next) => emit('update-custom-properties', next)"
		/>

		<div v-if="props.slide" :class="[CARD, 'space-y-1']">
			<div :class="HEADING">Slide</div>
			<div class="text-[11px] text-muted-foreground">
				{{ props.slide.elements?.length ?? 0 }} elements
			</div>
		</div>
	</div>
</template>
