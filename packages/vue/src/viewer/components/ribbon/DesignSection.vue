<script setup lang="ts">
/**
 * DesignSection: the Vue 3 port of React's `DesignSection` from
 * `toolbar/DesignTransitionsReviewSection.tsx`. Renders the Design ribbon tab's
 * Themes (Browse/Edit Theme) and Customize (Slide Size / Format Background)
 * buttons. A faithful, mechanical port for visual + behavioral parity: class
 * strings are copied verbatim, callbacks arrive as function props.
 */
import { Monitor, PaintBucket, Palette, Pencil } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ics, pill, SEP } from './ribbon-constants';

interface Props {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

const props = defineProps<Props>();

const { t } = useI18n();
</script>

<template>
	<!-- Themes -->
	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.isThemeGalleryOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.ribbon.browseThemesTitle')"
		@click="props.onToggleThemeGallery()"
	>
		<Palette :class="ics" />
		{{ t('pptx.ribbon.browseThemes') }}
	</button>
	<button
		:disabled="!props.canEdit"
		:class="cn(pill, props.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.design.editThemeTooltip')"
		@click="props.onToggleThemeEditor()"
	>
		<Pencil :class="ics" />
		{{ t('pptx.ribbon.editTheme') }}
	</button>

	<div :class="SEP" />

	<!-- Customize -->
	<button
		v-if="props.onOpenDocumentProperties"
		:class="pill"
		:title="t('pptx.design.slideSizeTooltip')"
		@click="props.onOpenDocumentProperties()"
	>
		<Monitor :class="ics" />
		{{ t('pptx.ribbon.slideSize') }}
	</button>
	<button
		v-if="props.onToggleInspector"
		:class="cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
		:title="t('pptx.design.formatBackgroundTooltip')"
		@click="props.onToggleInspector()"
	>
		<PaintBucket :class="ics" />
		{{ t('pptx.ribbon.formatBackground') }}
	</button>
</template>
