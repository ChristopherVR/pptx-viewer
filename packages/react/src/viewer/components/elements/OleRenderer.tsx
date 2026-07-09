import type { OlePptxElement } from 'pptx-viewer-core';
import { formatBytes, isBrowserOpenableMime, openUrlInNewTab } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
	getOleAriaLabel,
	getOleIcon,
	getOleTypeColor,
	getOleTypeLabel,
	renderOleBadge,
	resolveOleType,
} from './InkGroupRenderers';

/**
 * Resolved, display-ready info about an embedded OLE payload, derived from the
 * core-extracted `oleEmbedded*` fields plus the object's type / progId.
 */
interface OleEmbedInfo {
	/** Best available file name (embedded name preferred over the OLE name). */
	fileName?: string;
	/** Human-readable byte size, when known. */
	readableSize?: string;
	/** Source application ProgID (e.g. "Excel.Sheet.12"), when known. */
	progId?: string;
	/** Human-readable object-type label (e.g. "Excel Spreadsheet"). */
	typeLabel: string;
	/** True when an embedded data-URL is present and can be downloaded. */
	canDownload: boolean;
	/** True when the payload can be opened directly in a browser tab. */
	canOpenInBrowser: boolean;
}

/** Build the display info from an OLE element's recovered embedded fields. */
function buildEmbedInfo(el: OlePptxElement): OleEmbedInfo {
	const canDownload = Boolean(el.oleEmbeddedData);
	return {
		fileName: el.oleEmbeddedFileName ?? el.fileName,
		readableSize: formatBytes(el.oleEmbeddedByteSize),
		progId: el.oleProgId,
		typeLabel: getOleTypeLabel(resolveOleType(el)),
		canDownload,
		canOpenInBrowser: canDownload && isBrowserOpenableMime(el.oleEmbeddedMimeType),
	};
}

/** Assemble a compact tooltip describing the embedded object. */
function buildTooltip(info: OleEmbedInfo): string {
	const parts = [info.fileName ?? info.typeLabel, info.typeLabel];
	if (info.readableSize) {
		parts.push(info.readableSize);
	}
	if (info.progId) {
		parts.push(info.progId);
	}
	// De-duplicate (file name may equal the type label when no name is known).
	return Array.from(new Set(parts)).join(' · ');
}

/**
 * Stop pointer events on the action footer from bubbling to the element, so a
 * click on Download / Open does not start a selection or drag in the editor.
 */
function stopPointer(e: React.PointerEvent | React.MouseEvent): void {
	e.stopPropagation();
}

interface OleActionFooterProps {
	el: OlePptxElement;
	info: OleEmbedInfo;
}

/**
 * Hover-revealed footer over the OLE preview: shows the embedded file name +
 * size and offers keyboard-accessible Download / Open actions. A browser cannot
 * launch the native desktop application, so the actions are labelled "Download"
 * / "Open", never "Edit".
 */
function OleActionFooter({ el, info }: OleActionFooterProps): React.ReactNode {
	const { t } = useTranslation();
	if (!info.canDownload || !el.oleEmbeddedData) {
		return null;
	}
	const downloadName = info.fileName ?? 'embedded-object';
	const sizeSuffix = info.readableSize ? ` (${info.readableSize})` : '';

	return (
		<div
			className='absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 px-2 py-1 bg-black/70 text-white text-[10px] opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100'
			onPointerDown={stopPointer}
			onMouseDown={stopPointer}
			onClick={stopPointer}
		>
			<span className='min-w-0 truncate' title={downloadName}>
				{downloadName}
				{sizeSuffix}
			</span>
			<span className='flex shrink-0 items-center gap-1'>
				<a
					href={el.oleEmbeddedData}
					download={downloadName}
					className='rounded px-1.5 py-0.5 bg-white/15 hover:bg-white/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white'
					title={`Download ${downloadName}`}
				>
					{t('pptx.ole.download')}
				</a>
				{info.canOpenInBrowser && el.oleEmbeddedData && (
					<button
						type='button'
						onClick={() => openUrlInNewTab(el.oleEmbeddedData as string)}
						className='rounded px-1.5 py-0.5 bg-white/15 hover:bg-white/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white'
						title={`Open ${downloadName} in a new tab`}
					>
						{t('pptx.ole.open')}
					</button>
				)}
			</span>
		</div>
	);
}

export interface OleRendererProps {
	element: OlePptxElement;
}

/**
 * Render an embedded OLE object: the authored preview image (or a type-specific
 * styled placeholder) as the visual, an object-type badge, a richer info
 * tooltip, and - when the embedded payload was recovered on load - an
 * unobtrusive hover footer with Download / Open actions.
 */
export function OleRenderer({ element: el }: OleRendererProps): React.ReactNode {
	const oleType = resolveOleType(el);
	const ariaLabel = getOleAriaLabel(el);
	const info = buildEmbedInfo(el);
	const tooltip = buildTooltip(info);

	if (el.previewImageData) {
		return (
			<div
				className='group relative w-full h-full'
				role='img'
				aria-label={ariaLabel}
				title={tooltip}
			>
				<img
					src={el.previewImageData}
					alt={ariaLabel}
					className='pointer-events-none select-none w-full h-full object-contain'
					draggable={false}
				/>
				{renderOleBadge(oleType)}
				<OleActionFooter el={el} info={info} />
			</div>
		);
	}

	// No preview image; render a type-specific styled placeholder.
	const color = getOleTypeColor(oleType);
	const label = getOleTypeLabel(oleType);
	const displayName = info.fileName ?? label;

	return (
		<div
			className='group relative w-full h-full flex flex-col items-center justify-center'
			role='img'
			aria-label={ariaLabel}
			title={tooltip}
			style={{
				border: `2px solid ${color}33`,
				borderRadius: 6,
				backgroundColor: `${color}0D`,
			}}
		>
			{getOleIcon(oleType, color, 36)}
			<span className='mt-2 text-[12px] font-medium max-w-[90%] truncate' style={{ color }}>
				{displayName}
			</span>
			<span className='mt-0.5 text-[10px] text-white/50 max-w-[90%] truncate'>
				{info.readableSize ? `${label} · ${info.readableSize}` : label}
			</span>
			<OleActionFooter el={el} info={info} />
		</div>
	);
}
