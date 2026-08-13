import type { PptxLayoutOption, PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
import { buildLayoutPreviewGeometry, isCurrentLayout } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { StaticElementRenderer } from '../StaticElementRenderer';
import { RibbonMenu } from './RibbonMenu';

/** Thumbnail box size, matching PowerPoint's gallery tiles. */
const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 72;

/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
const MAX_PREVIEW_ELEMENTS = 100;

export interface LayoutGalleryMenuProps {
	anchorRef: React.RefObject<HTMLDivElement | null>;
	layoutOptions: readonly PptxLayoutOption[];
	/** Artwork by layout path; entries render as name-only tiles until it arrives. */
	previews: ReadonlyMap<string, PptxLayoutPreview>;
	/** Marks the active tile. Omitted by the New Slide menu, which has no "current". */
	currentLayoutPath?: string;
	onSelect: (layout: PptxLayoutOption) => void;
}

/**
 * The grid of layout thumbnails shared by the New Slide and Layout menus.
 *
 * Both menus previously listed layout names as plain text, which is not enough
 * to tell "Title and Content" from "Two Content" in a themed deck.
 */
export function LayoutGalleryMenu(p: LayoutGalleryMenuProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<RibbonMenu anchorRef={p.anchorRef} className='flex flex-col w-[620px] pt-1'>
			<div className='grid grid-cols-4 gap-2 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-3 max-h-[520px] overflow-y-auto'>
				{p.layoutOptions.length === 0 && (
					<p className='col-span-4 px-2 py-3 text-xs text-muted-foreground'>
						{t('pptx.layoutGallery.empty')}
					</p>
				)}
				{p.layoutOptions.map((layout) => {
					const isCurrent = isCurrentLayout(layout, p.currentLayoutPath);
					return (
						<button
							key={layout.path}
							type='button'
							aria-current={isCurrent ? 'true' : undefined}
							title={
								isCurrent ? `${layout.name} (${t('pptx.layoutGallery.current')})` : layout.name
							}
							className={cn(
								'relative flex min-w-0 flex-col items-center gap-1 rounded border-2 p-1 text-xs text-foreground transition-colors hover:bg-muted',
								isCurrent ? 'border-primary bg-primary/10' : 'border-transparent',
							)}
							onClick={() => p.onSelect(layout)}
						>
							<LayoutThumbnail preview={p.previews.get(layout.path)} name={layout.name} />
							<span className='w-full truncate text-center'>{layout.name}</span>
						</button>
					);
				})}
			</div>
		</RibbonMenu>
	);
}

interface LayoutThumbnailProps {
	preview: PptxLayoutPreview | undefined;
	name: string;
}

/**
 * One layout rendered at slide scale inside a thumbnail box.
 *
 * The artwork is drawn full size on an inner surface and scaled down as a
 * whole, so element positions need no conversion; the shared geometry helper
 * decides the scale and pre-divides the placeholder outline width so it does
 * not shrink to an invisible hairline.
 */
function LayoutThumbnail({ preview, name }: LayoutThumbnailProps): React.ReactElement {
	const geometry = buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT);

	// StaticElementRenderer resolves colours and fills against a slide, so the
	// layout's artwork is handed one standing in for the thumbnail.
	const slide: PptxSlide = {
		id: `layout-preview-${preview?.path ?? name}`,
		rId: '',
		slideNumber: 0,
		elements: preview?.elements ?? [],
		backgroundColor: geometry.backgroundColor,
	};

	return (
		<div
			className='relative shrink-0 overflow-hidden rounded-sm border border-border/70 shadow-sm'
			style={{
				width: geometry.boxWidth,
				height: geometry.boxHeight,
				backgroundColor: geometry.backgroundColor,
			}}
		>
			<div
				className='absolute left-0 top-0 origin-top-left overflow-hidden'
				style={{
					width: geometry.surfaceWidth,
					height: geometry.surfaceHeight,
					transform: `scale(${geometry.scale})`,
					backgroundColor: geometry.backgroundColor,
				}}
			>
				{(preview?.elements ?? []).slice(0, MAX_PREVIEW_ELEMENTS).map((element, index) => (
					<StaticElementRenderer
						key={element.id}
						element={element}
						activeSlide={slide}
						allSlides={[slide]}
						zIndex={index}
					/>
				))}
				{geometry.frames.map((frame) => (
					<div
						key={frame.key}
						className='absolute border-dashed border-muted-foreground/70 bg-background/20'
						style={{
							left: frame.left,
							top: frame.top,
							width: frame.width,
							height: frame.height,
							borderWidth: geometry.frameBorderWidth,
							borderStyle: 'dashed',
						}}
					/>
				))}
			</div>
		</div>
	);
}
