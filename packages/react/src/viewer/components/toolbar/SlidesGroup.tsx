import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import { slidesHomeControls } from 'pptx-viewer-shared';
import type { HomeLayoutArtwork, RibbonHomeIntent, SlideTemplateId } from 'pptx-viewer-shared';
import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLayoutPreviews } from '../../hooks/useLayoutPreviews';
import { SlideTemplateGalleryDialog } from '../SlideTemplateGalleryDialog';
import { LayoutArtwork } from './LayoutGalleryMenu';
import { sep } from './toolbar-constants';
import { WebHomeControls } from './WebHomeControls';

export interface SlidesGroupProps {
	canEdit: boolean;
	layoutOptions: PptxLayoutOption[];
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

interface ArtworkTile {
	key: number;
	preview: PptxLayoutPreview;
	name: string;
	backgroundColor: string;
	container: HTMLElement;
}

let nextTile = 0;

/**
 * Home > Slides: the shared `pptx-ui-ribbon-home-slides` group renders the
 * split New Slide, Slide Templates, Layout, Reset and Section buttons and their
 * layout galleries. This adapter supplies the layouts, portals the real layout
 * artwork (so React context is kept) into the gallery tiles and runs the edits;
 * the template dialog stays native.
 */
export function SlidesGroup(p: SlidesGroupProps): React.ReactElement {
	const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [tiles, setTiles] = useState<readonly ArtworkTile[]>([]);
	const previews = useLayoutPreviews(p.loadLayoutPreviews, galleryOpen);
	const { layoutOptions, onInsertSlideFromLayout, onApplyLayout, onResetSlide, onAddSection } = p;

	const controls = useMemo(
		() =>
			slidesHomeControls({
				editable: p.canEdit,
				hasLayouts: layoutOptions.length > 0,
				hasSlides: true,
				showTemplates: Boolean(p.onInsertSlideFromTemplate),
				newSlideNeedsLayout: true,
				resetNeedsSlide: false,
				layouts: {
					layouts: layoutOptions.map(({ path, name }) => ({ path, name })),
					current: p.currentLayoutPath,
					previews,
				},
			}),
		[p.canEdit, layoutOptions, p.onInsertSlideFromTemplate, p.currentLayoutPath, previews],
	);
	const request = useCallback(
		(id: string, _part?: string, intent?: RibbonHomeIntent) => {
			const value = intent?.value;
			switch (id) {
				case 'home.slides.newSlide': {
					const layout =
						value === undefined ? layoutOptions[0] : layoutOptions.find((l) => l.path === value);
					if (layout) {
						onInsertSlideFromLayout(layout.path, layout.name);
					}
					break;
				}
				case 'home.slides.slideTemplates':
					setTemplateGalleryOpen(true);
					break;
				case 'home.slides.layout':
					if (value !== undefined) {
						onApplyLayout?.(String(value));
					}
					break;
				case 'home.slides.reset':
					onResetSlide?.();
					break;
				case 'home.slides.section':
					onAddSection?.();
			}
		},
		[layoutOptions, onInsertSlideFromLayout, onApplyLayout, onResetSlide, onAddSection],
	);
	const popup = useCallback((_id: string, open: boolean) => setGalleryOpen(open), []);
	const artwork = useCallback<HomeLayoutArtwork>((preview, geometry, container) => {
		const tile: ArtworkTile = {
			key: nextTile++,
			preview,
			name: preview.path,
			backgroundColor: geometry.backgroundColor,
			container,
		};
		setTiles((all) => [...all, tile]);
		return () => setTiles((all) => all.filter((entry) => entry.key !== tile.key));
	}, []);

	return (
		<>
			<WebHomeControls
				family='slides'
				controls={controls}
				onRequest={request}
				onPopup={popup}
				layoutArtwork={artwork}
			/>
			{tiles.map((tile) =>
				createPortal(
					<LayoutArtwork
						preview={tile.preview}
						name={tile.name}
						backgroundColor={tile.backgroundColor}
					/>,
					tile.container,
					String(tile.key),
				),
			)}

			{sep}

			{p.onInsertSlideFromTemplate && (
				<SlideTemplateGalleryDialog
					isOpen={templateGalleryOpen}
					onClose={() => setTemplateGalleryOpen(false)}
					onInsert={(templateId) => p.onInsertSlideFromTemplate?.(templateId)}
					scheme={p.templateScheme}
				/>
			)}
		</>
	);
}
