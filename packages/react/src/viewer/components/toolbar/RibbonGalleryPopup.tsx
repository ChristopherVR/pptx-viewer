import type {
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
	RibbonGallerySection,
} from 'pptx-viewer-shared';
import {
	RIBBON_GALLERY_ITEM_ATTR,
	RIBBON_GALLERY_POPUP_ATTR,
	galleryItemLabel,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import { RibbonMenu } from './RibbonMenu';

/** `t(key)` when the dictionary has it, the English fallback otherwise. */
export function useTranslateOr(): (key: string | undefined, fallback: string) => string {
	const { t } = useTranslation();
	return (key, fallback) => {
		if (!key) {
			return fallback;
		}
		const translated = t(key);
		return translated && translated !== key ? translated : fallback;
	};
}

export interface RibbonGalleryTileProps {
	item: RibbonGalleryItem;
	disabled?: boolean;
	/** Constrains the preview to the ribbon strip's height. */
	inStrip?: boolean;
	onPick: (item: RibbonGalleryItem) => void;
}

/**
 * One gallery tile. The preview is the descriptor's ready-made `previewSvg`,
 * which shared builds only from catalogue data and theme colours (never
 * from user text), so injecting it as markup is safe.
 */
export function RibbonGalleryTile({
	item,
	disabled,
	inStrip,
	onPick,
}: RibbonGalleryTileProps): React.ReactElement {
	const { t } = useTranslation();
	const label = galleryItemLabel(item, (key, params) => t(key, params ?? {}));
	return (
		<button
			type='button'
			{...{ [RIBBON_GALLERY_ITEM_ATTR]: item.id }}
			aria-pressed={item.applied}
			aria-label={label}
			title={label}
			disabled={disabled}
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onPick(item)}
			className={cn(
				'grid shrink-0 place-items-center rounded-sm border border-transparent p-0.5 transition-colors hover:border-primary/60 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
				item.applied && 'border-primary ring-1 ring-primary/40',
				inStrip && '[&>svg]:h-[40px] [&>svg]:w-auto',
			)}
			dangerouslySetInnerHTML={{ __html: item.previewSvg }}
		/>
	);
}

function GallerySection({
	section,
	onPick,
}: {
	section: RibbonGallerySection;
	onPick: (item: RibbonGalleryItem) => void;
}): React.ReactElement | null {
	const translateOr = useTranslateOr();
	if (section.items.length === 0) {
		return null;
	}
	const heading =
		section.titleKey || section.title ? translateOr(section.titleKey, section.title ?? '') : '';
	return (
		<div className='px-2 py-1'>
			{heading && (
				<div className='pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
					{heading}
				</div>
			)}
			<div
				className='grid gap-1'
				style={{ gridTemplateColumns: `repeat(${Math.max(1, section.columns)}, max-content)` }}
			>
				{section.items.map((item) => (
					<RibbonGalleryTile key={item.id} item={item} onPick={onPick} />
				))}
			</div>
		</div>
	);
}

export interface RibbonGalleryPopupProps {
	descriptor: RibbonGalleryDescriptor;
	/** The wrapper the popup hangs below (also the outside-click boundary). */
	anchorRef: React.RefObject<HTMLElement | null>;
	label: string;
	onPick: (item: RibbonGalleryItem) => void;
}

/** The dropped-down panel: every section's heading and tile grid. */
export function RibbonGalleryPopup({
	descriptor,
	anchorRef,
	label,
	onPick,
}: RibbonGalleryPopupProps): React.ReactElement {
	return (
		<RibbonMenu anchorRef={anchorRef} className='pt-1'>
			<div
				{...{ [RIBBON_GALLERY_POPUP_ATTR]: descriptor.id }}
				role='group'
				aria-label={label}
				className='max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-2xl backdrop-blur-lg'
			>
				{descriptor.sections.map((section) => (
					<GallerySection key={section.id} section={section} onPick={onPick} />
				))}
			</div>
		</RibbonMenu>
	);
}
