<script setup lang="ts">
/**
 * LayoutGalleryMenu: the grid of layout thumbnails shared by the New Slide and
 * Layout menus. Vue port of React's `toolbar/LayoutGalleryMenu.tsx`.
 *
 * Both menus previously listed layout names as plain text, which is not enough
 * to tell "Title and Content" from "Two Content" in a themed deck.
 */
import type { PptxLayoutOption, PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
import { buildLayoutPreviewGeometry, isCurrentLayout } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import SlideStage from '../SlideStage.vue';
import { vAnchoredPopup } from './anchored-popup';

/** Thumbnail box size, matching PowerPoint's gallery tiles. */
const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 72;

/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
const MAX_PREVIEW_ELEMENTS = 100;

const props = defineProps<{
	layoutOptions: PptxLayoutOption[];
	/** Artwork by layout path; tiles stay name-only until it arrives. */
	previews: ReadonlyMap<string, PptxLayoutPreview>;
	/** Marks the active tile. Omitted by New Slide, which has no "current". */
	currentLayoutPath?: string;
	/** The trigger button this menu hangs below (position: fixed anchor; see `anchored-popup.ts`). */
	anchor?: HTMLElement | null;
}>();

const emit = defineEmits<{ (event: 'select', layout: PptxLayoutOption): void }>();

const { t } = useI18n();

/** No media in a layout thumbnail; images arrive already decoded as data URLs. */
const EMPTY_MEDIA = new Map<string, string>();

const tiles = computed(() =>
	props.layoutOptions.map((layout) => {
		const preview = props.previews.get(layout.path);
		const geometry = buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT);
		const slide: PptxSlide = {
			id: `layout-preview-${layout.path}`,
			rId: '',
			slideNumber: 0,
			elements: (preview?.elements ?? []).slice(0, MAX_PREVIEW_ELEMENTS),
			backgroundColor: geometry.backgroundColor,
		};
		return {
			layout,
			geometry,
			slide,
			canvasSize: { width: geometry.surfaceWidth, height: geometry.surfaceHeight },
			isCurrent: isCurrentLayout(layout, props.currentLayoutPath),
		};
	}),
);
</script>

<template>
	<div
		class="z-50 flex flex-col w-[620px] pt-1"
		data-testid="layout-gallery-menu"
		v-anchored-popup="{ anchor: props.anchor }"
	>
		<div
			class="grid grid-cols-4 gap-2 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-3 max-h-[520px] overflow-y-auto"
		>
			<p v-if="tiles.length === 0" class="col-span-4 px-2 py-3 text-xs text-muted-foreground">
				{{ t('pptx.layoutGallery.empty') }}
			</p>
			<button
				v-for="tile in tiles"
				:key="tile.layout.path"
				type="button"
				:aria-current="tile.isCurrent ? 'true' : undefined"
				:title="
					tile.isCurrent
						? `${tile.layout.name} (${t('pptx.layoutGallery.current')})`
						: tile.layout.name
				"
				:class="
					cn(
						'relative flex min-w-0 flex-col items-center gap-1 rounded border-2 p-1 text-xs text-foreground transition-colors hover:bg-muted',
						tile.isCurrent ? 'border-primary bg-primary/10' : 'border-transparent',
					)
				"
				@click="emit('select', tile.layout)"
			>
				<div
					class="relative shrink-0 overflow-hidden rounded-sm border border-border/70 shadow-sm"
					:style="{
						width: `${tile.geometry.boxWidth}px`,
						height: `${tile.geometry.boxHeight}px`,
						backgroundColor: tile.geometry.backgroundColor,
					}"
				>
					<SlideStage
						:slide="tile.slide"
						:canvas-size="tile.canvasSize"
						:media-data-urls="EMPTY_MEDIA"
						:scale="tile.geometry.scale"
					/>
					<!-- Placeholder outlines sit inside the scaled surface, so their
					     border width is pre-divided by the scale to stay visible. -->
					<div
						class="absolute left-0 top-0 origin-top-left"
						:style="{
							width: `${tile.geometry.surfaceWidth}px`,
							height: `${tile.geometry.surfaceHeight}px`,
							transform: `scale(${tile.geometry.scale})`,
						}"
					>
						<div
							v-for="frame in tile.geometry.frames"
							:key="frame.key"
							class="absolute border-dashed border-muted-foreground/70 bg-background/20"
							:style="{
								left: `${frame.left}px`,
								top: `${frame.top}px`,
								width: `${frame.width}px`,
								height: `${frame.height}px`,
								borderWidth: `${tile.geometry.frameBorderWidth}px`,
								borderStyle: 'dashed',
							}"
						/>
					</div>
				</div>
				<span class="w-full truncate text-center">{{ tile.layout.name }}</span>
			</button>
		</div>
	</div>
</template>
