/**
 * The trigger icon of each ribbon gallery (view-layer only: which Lucide
 * glyph a dropdown trigger shows). What a gallery offers comes from shared.
 */
import {
	Brush,
	CaseSensitive,
	ChartColumn,
	Contrast,
	Image,
	LayoutGrid,
	List,
	ListOrdered,
	Network,
	Palette,
	Sparkles,
	Table,
	Type,
	WandSparkles,
} from 'lucide-vue-next';
import type { RibbonGalleryId } from 'pptx-viewer-shared';
import type { Component } from 'vue';

export const GALLERY_ICONS: Record<RibbonGalleryId, Component> = {
	shapeStyles: Brush,
	shapeEffects: Sparkles,
	wordArtStyles: Type,
	pictureStyles: Image,
	pictureCorrections: Contrast,
	pictureColor: Palette,
	pictureArtisticEffects: WandSparkles,
	bullets: List,
	numbering: ListOrdered,
	tableStyles: Table,
	chartStyles: ChartColumn,
	chartColors: Palette,
	chartQuickLayout: LayoutGrid,
	smartArtStyles: Network,
	smartArtColors: Palette,
	themeColors: Palette,
	themeFonts: CaseSensitive,
};
