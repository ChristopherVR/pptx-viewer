import { applyRibbonGalleryItem, buildRibbonGallery } from 'pptx-viewer-shared';
import type {
	PptxUiRibbonGalleryElement,
	RibbonGalleryPickEvent,
	RibbonGalleryPlacement,
} from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useRibbonGalleryCommands } from '../ribbon-gallery-context';

export interface RibbonGalleryProps {
	placement: RibbonGalleryPlacement;
	icon?: React.ReactNode;
	chevronOnly?: boolean;
	tagControl?: boolean;
}
/** Native mutations/history stay in the host; shared owns the entire gallery view. */
export function RibbonGallery({
	placement,
	chevronOnly = false,
	tagControl = true,
}: RibbonGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiRibbonGalleryElement>(null);
	const commands = useRibbonGalleryCommands();
	const context = commands?.context;
	const descriptor = useMemo(
		() => buildRibbonGallery(placement.gallery, context ?? { element: null }),
		[placement.gallery, context],
	);
	useEffect(() => {
		const host = ref.current;
		if (host) {
			host.descriptor = descriptor;
			host.translateLabel = t;
			host.disabled = !commands?.editable;
		}
	}, [descriptor, t, commands?.editable]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const pick = (event: Event) => {
			if (!commands?.editable) {
				return;
			}
			const result = applyRibbonGalleryItem(
				placement.gallery,
				(event as RibbonGalleryPickEvent).detail.itemId,
				commands.context,
			);
			if (result) {
				commands.dispatch(result);
			}
		};
		host.addEventListener('gallery-pick', pick);
		return () => host.removeEventListener('gallery-pick', pick);
	}, [commands, placement.gallery]);
	return (
		<pptx-ui-ribbon-gallery
			ref={ref}
			label={descriptor.label}
			mode={placement.mode}
			chevron-only={chevronOnly || undefined}
			data-ribbon-control={tagControl ? placement.control : undefined}
		/>
	);
}
