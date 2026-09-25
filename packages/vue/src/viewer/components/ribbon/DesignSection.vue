<script setup lang="ts">
/**
 * DesignSection: the Vue 3 port of React's `DesignSection` from
 * `toolbar/DesignTransitionsReviewSection.tsx`. Renders the Design ribbon tab's
 * Themes (Browse/Edit Theme), Variants (theme Colors / Fonts galleries) and
 * Customize (Slide Size / Format Background) groups. A faithful, mechanical
 * port for visual + behavioral parity: class strings are copied verbatim,
 * callbacks arrive as function props.
 */
import { Monitor, PaintBucket, Palette, Pencil } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { GROUP_LABEL, ics, pill, SEP } from './ribbon-constants';
import RibbonGallery from './RibbonGallery.vue';

interface Props {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	/**
	 * Design > Slide Size: reveal the inspector's SLIDE SIZE card, which is the
	 * only slide-size control this binding has. The button used to run
	 * `onOpenDocumentProperties`, a dialog with no slide-size control in it at
	 * all - the same mis-wiring Angular, Vanilla and Svelte each shipped.
	 */
	onOpenSlideSize?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

const props = defineProps<Props>();

const { t } = useI18n();
</script>

<template>
	<!-- Themes -->
	<div class="contents [&>*]:shrink-0" data-ribbon-group="design.themes">
		<button
			data-ribbon-control="design.themes.browseThemes"
			:disabled="!props.canEdit"
			:class="cn(pill, props.isThemeGalleryOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
			:title="t('pptx.ribbon.browseThemesTitle')"
			@click="props.onToggleThemeGallery()"
		>
			<Palette :class="ics" />
			{{ t('pptx.ribbon.browseThemes') }}
		</button>
		<button
			data-ribbon-control="design.themes.editTheme"
			:disabled="!props.canEdit"
			:class="cn(pill, props.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')"
			:title="t('pptx.design.editThemeTooltip')"
			@click="props.onToggleThemeEditor()"
		>
			<Pencil :class="ics" />
			{{ t('pptx.ribbon.editTheme') }}
		</button>
	</div>

	<div :class="SEP" />

	<!-- Variants: the theme Colors / Fonts galleries (shared descriptors) -->
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="design.variants">
		<div class="flex items-center gap-1">
			<RibbonGallery gallery="themeColors" control="design.variants.colors" mode="dropdown" />
			<RibbonGallery gallery="themeFonts" control="design.variants.fonts" mode="dropdown" />
		</div>
		<span :class="GROUP_LABEL">{{ t('pptx.ribbon.groupVariants') }}</span>
	</div>

	<div :class="SEP" />

	<!-- Customize -->
	<div class="contents [&>*]:shrink-0" data-ribbon-group="design.customize">
		<button
			v-if="props.onOpenSlideSize ?? props.onOpenDocumentProperties"
			data-ribbon-control="design.customize.slideSize"
			:class="pill"
			:title="t('pptx.design.slideSizeTooltip')"
			@click="(props.onOpenSlideSize ?? props.onOpenDocumentProperties)?.()"
		>
			<Monitor :class="ics" />
			{{ t('pptx.ribbon.slideSize') }}
		</button>
		<button
			v-if="props.onToggleInspector"
			data-ribbon-control="design.customize.formatBackground"
			:class="
				cn(pill, props.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')
			"
			:title="t('pptx.design.formatBackgroundTooltip')"
			@click="props.onToggleInspector()"
		>
			<PaintBucket :class="ics" />
			{{ t('pptx.ribbon.formatBackground') }}
		</button>
	</div>
</template>
