import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import { slidesHomeControls } from 'pptx-viewer-shared';
import type { PptxUiRibbonHomeElement, SlideTemplateId } from 'pptx-viewer-shared';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLayoutPreviews } from '../../hooks/useLayoutPreviews';
import { SlideTemplateGalleryDialog } from '../SlideTemplateGalleryDialog';
import { LayoutGalleryMenu } from './LayoutGalleryMenu';
import { sep } from './toolbar-constants';
import { useHomeAnchor, useHomePopover, WebHomeControls } from './WebHomeControls';

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

/**
 * Home > Slides: the shared `pptx-ui-ribbon-home-slides` group renders the
 * split New Slide, Slide Templates, Layout, Reset and Section buttons. The
 * layout galleries and the template dialog stay native and are anchored on the
 * shared wrappers.
 */
export function SlidesGroup(p: SlidesGroupProps): React.ReactElement {
	const elementRef = useRef<PptxUiRibbonHomeElement | null>(null);
	const newSlide = useHomePopover(useHomeAnchor(elementRef, 'home.slides.newSlide'));
	const layout = useHomePopover(useHomeAnchor(elementRef, 'home.slides.layout'));
	const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
	const previews = useLayoutPreviews(p.loadLayoutPreviews, newSlide.open || layout.open);
	const { layoutOptions, onInsertSlideFromLayout, onResetSlide, onAddSection } = p;
	const { setOpen: setNewSlideOpen } = newSlide;
	const { setOpen: setLayoutOpen } = layout;

	const controls = useMemo(
		() =>
			slidesHomeControls({
				editable: p.canEdit,
				hasLayouts: layoutOptions.length > 0,
				hasSlides: true,
				showTemplates: Boolean(p.onInsertSlideFromTemplate),
				newSlideNeedsLayout: true,
				resetNeedsSlide: false,
				newSlideOpen: newSlide.open,
				layoutOpen: layout.open,
			}),
		[p.canEdit, layoutOptions.length, p.onInsertSlideFromTemplate, newSlide.open, layout.open],
	);
	const request = useCallback(
		(id: string, part?: string) => {
			switch (id) {
				case 'home.slides.newSlide':
					if (part === 'caret') {
						setNewSlideOpen((v) => !v);
					} else if (layoutOptions.length > 0) {
						onInsertSlideFromLayout(layoutOptions[0].path, layoutOptions[0].name);
					}
					break;
				case 'home.slides.slideTemplates':
					setTemplateGalleryOpen(true);
					break;
				case 'home.slides.layout':
					setLayoutOpen((v) => !v);
					break;
				case 'home.slides.reset':
					onResetSlide?.();
					break;
				case 'home.slides.section':
					onAddSection?.();
			}
		},
		[
			layoutOptions,
			onInsertSlideFromLayout,
			onResetSlide,
			onAddSection,
			setNewSlideOpen,
			setLayoutOpen,
		],
	);

	return (
		<>
			<WebHomeControls
				family='slides'
				controls={controls}
				onRequest={request}
				elementRef={elementRef}
			/>
			{newSlide.open &&
				newSlide.anchorRef.current &&
				createPortal(
					<LayoutGalleryMenu
						anchorRef={newSlide.anchorRef}
						layoutOptions={layoutOptions}
						previews={previews}
						onSelect={(l) => {
							onInsertSlideFromLayout(l.path, l.name);
							setNewSlideOpen(false);
						}}
					/>,
					newSlide.anchorRef.current,
				)}
			{layout.open &&
				layout.anchorRef.current &&
				createPortal(
					<LayoutGalleryMenu
						anchorRef={layout.anchorRef}
						layoutOptions={layoutOptions}
						previews={previews}
						currentLayoutPath={p.currentLayoutPath}
						onSelect={(l) => {
							p.onApplyLayout?.(l.path);
							setLayoutOpen(false);
						}}
					/>,
					layout.anchorRef.current,
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
