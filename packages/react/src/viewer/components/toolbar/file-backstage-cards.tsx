import { backstageCardsFor } from 'pptx-viewer-shared';
import type { BackstageCardId, BackstagePage } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import {
	LuBox,
	LuClock3,
	LuCopy,
	LuDownload,
	LuFileImage,
	LuFileJson,
	LuFileText,
	LuInfo,
	LuLock,
	LuPlay,
	LuPrinter,
	LuShare2,
	LuShieldAlert,
	LuType,
	LuVideo,
} from 'react-icons/lu';

import { BackstageAction } from './file-backstage-parts';
import type { FileSectionProps } from './file-backstage-parts';

const ICONS: Record<BackstageCardId, IconType> = {
	protect: LuLock,
	inspect: LuInfo,
	embedFonts: LuType,
	signatures: LuShieldAlert,
	versionHistory: LuClock3,
	saveAsPptx: LuDownload,
	saveAsPpsx: LuPlay,
	saveAsPptm: LuFileText,
	pdf: LuFileText,
	png: LuFileImage,
	video: LuVideo,
	gif: LuBox,
	json: LuFileJson,
	copyImage: LuCopy,
	print: LuPrinter,
	share: LuShare2,
};

/**
 * The backstage action cards for one page.
 *
 * Titles, bodies and ordering all come from `pptx-viewer-shared`, so this file
 * only decides which glyph and which callback each card gets. That is what
 * keeps the five bindings in step: a card cannot be worded differently here
 * than it is in Vue or Svelte, because none of them own the wording.
 */
export function BackstageCards({
	page,
	props,
	run,
}: {
	page: BackstagePage;
	props: FileSectionProps;
	run: (action?: () => void) => void;
}): React.ReactElement | null {
	const { t } = useTranslation();
	const handlers: Record<BackstageCardId, (() => void) | undefined> = {
		protect: props.onOpenPasswordProtection,
		inspect: props.onOpenDocumentProperties,
		embedFonts: props.onOpenFontEmbedding,
		signatures: props.onOpenDigitalSignatures,
		versionHistory: props.onOpenVersionHistory,
		saveAsPptx: props.onSaveAsPptx,
		saveAsPpsx: props.onSaveAsPpsx,
		saveAsPptm: props.onSaveAsPptm,
		pdf: props.onExportPdf,
		png: props.onExportPng,
		video: props.onExportVideo,
		gif: props.onExportGif,
		json: props.onExportJson,
		copyImage: props.onCopySlideAsImage,
		print: props.onPrint,
		share: props.onOpenShareDialog,
	};
	// The macro format is offered only when the open deck actually carries VBA,
	// matching PowerPoint's own Save As list.
	const cards = backstageCardsFor(page).filter(
		(card) => card.id !== 'saveAsPptm' || props.hasMacros,
	);
	if (cards.length === 0) {
		return null;
	}
	const single = cards.length === 1;
	return (
		<div className={`mt-8 grid gap-5 ${single ? 'max-w-[700px]' : 'max-w-[900px] grid-cols-2'}`}>
			{cards.map((card) => {
				const Icon = ICONS[card.id];
				return (
					<BackstageAction
						key={card.id}
						icon={<Icon />}
						title={t(card.titleKey, { defaultValue: card.title })}
						body={t(card.bodyKey, { defaultValue: card.body })}
						onClick={() => run(handlers[card.id])}
					/>
				);
			})}
		</div>
	);
}
