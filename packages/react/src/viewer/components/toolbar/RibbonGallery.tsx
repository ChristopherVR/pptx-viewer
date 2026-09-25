import type {
	RibbonGalleryContext,
	RibbonGalleryItem,
	RibbonGalleryPlacement,
} from 'pptx-viewer-shared';
import {
	RIBBON_CONTROL_ATTR,
	RIBBON_GALLERY_ATTR,
	applyRibbonGalleryItem,
	buildRibbonGallery,
	galleryHasItems,
	inlineGalleryItems,
} from 'pptx-viewer-shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown } from 'react-icons/lu';

import { useRibbonGalleryCommands } from '../ribbon-gallery-context';
import { RibbonGalleryPopup, RibbonGalleryTile, useTranslateOr } from './RibbonGalleryPopup';
import { pill } from './toolbar-constants';
import { useRibbonDropdown } from './useRibbonDropdown';

const EMPTY_CONTEXT: RibbonGalleryContext = { element: null };

export interface RibbonGalleryProps {
	placement: RibbonGalleryPlacement;
	/** Trigger icon for a dropdown gallery. */
	icon?: React.ReactNode;
	/**
	 * Chevron-only trigger (Home > Paragraph's Bullets / Numbering libraries,
	 * which sit right after their toggle buttons).
	 */
	chevronOnly?: boolean;
	/**
	 * False when an outer wrapper already carries `data-ribbon-control` (a
	 * toggle + chevron pair), so the id is not tagged twice.
	 */
	tagControl?: boolean;
}

/**
 * A ribbon style gallery, in either of PowerPoint's two shapes: a dropdown
 * trigger, or an in-ribbon strip of the first tiles plus a "more" button.
 * Everything it shows comes from the shared descriptor, so a gallery lights
 * up here the moment shared gives it items.
 */
export function RibbonGallery({
	placement,
	icon,
	chevronOnly = false,
	tagControl = true,
}: RibbonGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	const translateOr = useTranslateOr();
	const commands = useRibbonGalleryCommands();
	const ctx = commands?.context ?? EMPTY_CONTEXT;
	const { gallery, control, mode } = placement;
	const descriptor = useMemo(() => buildRibbonGallery(gallery, ctx), [gallery, ctx]);
	const dropdown = useRibbonDropdown();
	const title = translateOr(descriptor.labelKey, descriptor.label);
	const disabled = !commands?.editable || descriptor.disabled || !galleryHasItems(descriptor);
	const open = dropdown.open && !disabled;

	const pick = (item: RibbonGalleryItem): void => {
		const result = applyRibbonGalleryItem(gallery, item.id, ctx);
		if (result) {
			commands?.dispatch(result);
		}
		dropdown.setOpen(false);
	};
	const controlAttrs = tagControl ? { [RIBBON_CONTROL_ATTR]: control } : {};
	const galleryAttrs = { [RIBBON_GALLERY_ATTR]: gallery };
	const popup = open && (
		<RibbonGalleryPopup
			descriptor={descriptor}
			anchorRef={dropdown.ref}
			label={title}
			onPick={pick}
		/>
	);

	if (mode === 'inline') {
		const moreLabel = t('pptx.gallery.more', { name: title });
		return (
			<div
				ref={dropdown.ref}
				{...controlAttrs}
				className='relative inline-flex items-stretch rounded border border-border/60 bg-background/40'
			>
				<div className='flex items-center gap-0.5 p-0.5'>
					{inlineGalleryItems(descriptor).map((item) => (
						<RibbonGalleryTile
							key={item.id}
							item={item}
							disabled={disabled}
							inStrip
							onPick={pick}
						/>
					))}
				</div>
				<button
					type='button'
					{...galleryAttrs}
					aria-label={moreLabel}
					aria-haspopup='true'
					aria-expanded={open}
					title={moreLabel}
					disabled={disabled}
					onClick={() => dropdown.setOpen((v) => !v)}
					className='inline-flex items-center border-l border-border/60 px-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40'
				>
					<LuChevronDown className='h-3 w-3' />
				</button>
				{popup}
			</div>
		);
	}

	return (
		<div ref={dropdown.ref} {...controlAttrs} className='relative inline-flex items-center'>
			<button
				type='button'
				{...galleryAttrs}
				aria-haspopup='true'
				aria-expanded={open}
				aria-label={title}
				title={title}
				disabled={disabled}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => dropdown.setOpen((v) => !v)}
				className={
					chevronOnly
						? 'inline-flex items-center self-stretch px-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40'
						: pill
				}
			>
				{!chevronOnly && icon}
				{!chevronOnly && <span className='whitespace-nowrap'>{title}</span>}
				<LuChevronDown className='h-3 w-3' />
			</button>
			{popup}
		</div>
	);
}
