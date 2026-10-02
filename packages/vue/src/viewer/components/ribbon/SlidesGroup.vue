<script setup lang="ts">
/**
 * SlidesGroup: New Slide split button, Slide Templates, Layout (apply to
 * current), Reset and Section. All of it, including the layout thumbnail
 * galleries, is the shared `pptx-ui-ribbon-home-slides` element. The host only
 * draws each tile's real artwork (SlideStage, teleported into the tile so
 * provide/inject keeps working), loads the previews when a gallery opens, and
 * runs the edits. The Slide Templates dialog stays native.
 */
import type { PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
import type {
	HomeLayoutArtwork,
	RibbonHomeLayoutModel,
	RibbonHomePopupEvent,
	RibbonHomeRequestEvent,
	SlideTemplateId,
} from 'pptx-viewer-shared';
import { homeSnapshotTranslator, slidesHomeControls } from 'pptx-viewer-shared';
import { computed, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import SlideStage from '../SlideStage.vue';
import SlideTemplateGalleryDialog from '../SlideTemplateGalleryDialog.vue';
import type { LayoutOption } from './ribbon-types';

interface Props {
	canEdit: boolean;
	layoutOptions: LayoutOption[];
	/** Marks the active tile in the Layout menu. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	/** Deck scheme map so template previews show the deck's theme colours. */
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();

/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
const MAX_PREVIEW_ELEMENTS = 100;
/** No media in a layout thumbnail; images arrive already decoded as data URLs. */
const EMPTY_MEDIA = new Map<string, string>();

const previews = ref<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
const layouts = computed<RibbonHomeLayoutModel>(() => ({
	layouts: props.layoutOptions,
	current: props.currentLayoutPath,
	previews: previews.value,
}));

const state = computed(() => ({
	controls: slidesHomeControls({
		editable: props.canEdit,
		hasLayouts: props.layoutOptions.length > 0,
		hasSlides: true,
		showTemplates: Boolean(props.onInsertSlideFromTemplate),
		newSlideNeedsLayout: true,
		resetNeedsSlide: false,
		layouts: layouts.value,
	}),
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	translate: homeSnapshotTranslator(['slides'], t),
}));

/** Tiles the shared gallery asked this host to fill with artwork. */
interface Artwork {
	key: number;
	container: HTMLElement;
	slide: PptxSlide;
	width: number;
	height: number;
	scale: number;
}
const artworks = shallowRef<Artwork[]>([]);
let nextKey = 0;
const drawArtwork: HomeLayoutArtwork = (preview, geometry, container) => {
	const entry: Artwork = {
		key: nextKey++,
		container,
		slide: {
			id: `layout-preview-${preview.path}`,
			rId: '',
			slideNumber: 0,
			elements: preview.elements.slice(0, MAX_PREVIEW_ELEMENTS),
			backgroundColor: geometry.backgroundColor,
		},
		width: geometry.surfaceWidth,
		height: geometry.surfaceHeight,
		scale: 1,
	};
	artworks.value = [...artworks.value, entry];
	return () => {
		artworks.value = artworks.value.filter((item) => item !== entry);
	};
};

/**
 * Layout artwork, fetched the first time either gallery opens: parsing every
 * layout part is only worth doing once the user asks to see the thumbnails.
 */
function onPopup(event: Event): void {
	const { open } = (event as RibbonHomePopupEvent).detail;
	const load = props.loadLayoutPreviews;
	if (!open || !load) {
		return;
	}
	void load()
		.then((loaded) => {
			previews.value = new Map(loaded.map((preview) => [preview.path, preview]));
			return undefined;
		})
		// A layout that will not parse costs the user a name-only tile, not a broken menu.
		.catch(() => undefined);
}

const templateGalleryOpen = ref(false);

function request(event: RibbonHomeRequestEvent): void {
	const { id, value } = event.detail;
	switch (id) {
		case 'home.slides.newSlide': {
			const layout =
				value === undefined
					? props.layoutOptions[0]
					: props.layoutOptions.find((option) => option.path === value);
			if (layout) {
				props.onInsertSlideFromLayout(layout.path, layout.name);
			}
			break;
		}
		case 'home.slides.slideTemplates':
			templateGalleryOpen.value = true;
			break;
		case 'home.slides.layout':
			props.onApplyLayout?.(String(value));
			break;
		case 'home.slides.reset':
			props.onResetSlide?.();
			break;
		case 'home.slides.section':
			props.onAddSection?.();
	}
}
</script>

<template>
	<pptx-ui-ribbon-home-slides
		:state.prop="state"
		:layoutArtwork.prop="drawArtwork"
		@home-request="request"
		@home-popup="onPopup"
	/>
	<Teleport v-for="art in artworks" :key="art.key" :to="art.container">
		<SlideStage
			:slide="art.slide"
			:canvas-size="{ width: art.width, height: art.height }"
			:media-data-urls="EMPTY_MEDIA"
			:scale="art.scale"
		/>
	</Teleport>
	<SlideTemplateGalleryDialog
		v-if="props.onInsertSlideFromTemplate"
		:open="templateGalleryOpen"
		:scheme="props.templateScheme"
		@insert="props.onInsertSlideFromTemplate?.($event)"
		@close="templateGalleryOpen = false"
	/>
</template>
