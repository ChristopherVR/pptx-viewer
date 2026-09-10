import type {
	OleNestedDeckSlideDetail,
	OlePptxElement,
	OleSheetGrid,
	PptxElement,
} from 'pptx-viewer-core';
import {
	applyOleDocumentParagraphEdit,
	applyOleNestedDeckElementTextEdit,
	applyOleSheetCellEdit,
	getOleDocumentParagraphs,
	getOleNestedDeckDetail,
	getOleSheetGrid,
	replaceOleFile,
} from 'pptx-viewer-core';
import { buildOleContentUpdatePatch, buildOleEditDialogDescriptor } from 'pptx-viewer-shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import { OleDeckEditor, OleDocumentEditor, OleSheetGridEditor } from './OleEditorDialogTabs';

/** Props for {@link OleEditorDialog}. */
export interface OleEditorDialogProps {
	isOpen: boolean;
	onClose: () => void;
	element: OlePptxElement;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
}

/**
 * "Edit content" dialog for an embedded OLE object: a spreadsheet grid,
 * document paragraph list, or nested-deck slide title list depending on
 * the payload kind (`buildOleEditDialogDescriptor`), plus a Replace File
 * action always available regardless of kind.
 *
 * Every edit commits through the same core `ole-edit-api.ts` functions
 * every other binding calls, and the same `onUpdateElement` patch API every
 * other inspector field already uses, so undo/history/collaboration sync
 * works exactly like a typed-field edit.
 */
export function OleEditorDialog({
	isOpen,
	onClose,
	element,
	onUpdateElement,
}: OleEditorDialogProps): React.ReactElement | null {
	const { t } = useTranslation();
	const dialogRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const descriptor = buildOleEditDialogDescriptor(element);

	const [grid, setGrid] = useState<OleSheetGrid | undefined>(undefined);
	const [paragraphs, setParagraphs] = useState<string[] | undefined>(undefined);
	const [deckSlides, setDeckSlides] = useState<OleNestedDeckSlideDetail[] | undefined>(undefined);
	const [loading, setLoading] = useState(false);
	const [saveError, setSaveError] = useState(false);

	// Async edit/save handlers below settle after their own awaits, which can
	// outlive the component (dialog closed, or unmounted entirely) if the OLE
	// round-trip is slow. Guard every post-await setState with this so a late
	// resolution never dispatches into an unmounted tree.
	const mountedRef = useRef(true);
	useEffect(
		() => () => {
			mountedRef.current = false;
		},
		[],
	);

	useEffect(() => {
		if (!isOpen || !descriptor.contentTab) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		const kind = descriptor.contentTab.kind;
		const load = async () => {
			if (kind === 'sheet') {
				const value = await getOleSheetGrid(element);
				if (!cancelled) {
					setGrid(value);
				}
			} else if (kind === 'document') {
				const value = await getOleDocumentParagraphs(element);
				if (!cancelled) {
					setParagraphs(value);
				}
			} else if (kind === 'deck') {
				const value = await getOleNestedDeckDetail(element);
				if (!cancelled) {
					setDeckSlides(value);
				}
			}
			if (!cancelled) {
				setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only on open/element identity, not on every render
	}, [isOpen, element]);

	const commit = useCallback(
		(updated: OlePptxElement) => {
			if (!updated.oleContentDirty) {
				return;
			}
			onUpdateElement(buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
		},
		[onUpdateElement],
	);

	const handleCellEdit = useCallback(
		async (row: number, col: number, value: string) => {
			try {
				const updated = await applyOleSheetCellEdit(element, { row, col, value });
				commit(updated);
				const refreshed = await getOleSheetGrid(updated);
				if (mountedRef.current) {
					setGrid(refreshed);
				}
			} catch {
				if (mountedRef.current) {
					setSaveError(true);
				}
			}
		},
		[element, commit],
	);

	const handleParagraphEdit = useCallback(
		async (index: number, text: string) => {
			try {
				const updated = await applyOleDocumentParagraphEdit(element, index, text);
				commit(updated);
				const refreshed = await getOleDocumentParagraphs(updated);
				if (mountedRef.current) {
					setParagraphs(refreshed);
				}
			} catch {
				if (mountedRef.current) {
					setSaveError(true);
				}
			}
		},
		[element, commit],
	);

	const handleDeckElementEdit = useCallback(
		async (slideIndex: number, deckElementId: string, text: string) => {
			try {
				const updated = await applyOleNestedDeckElementTextEdit(
					element,
					slideIndex,
					deckElementId,
					text,
				);
				commit(updated);
				const refreshed = await getOleNestedDeckDetail(updated);
				if (mountedRef.current) {
					setDeckSlides(refreshed);
				}
			} catch {
				if (mountedRef.current) {
					setSaveError(true);
				}
			}
		},
		[element, commit],
	);

	const handleReplaceFile = useCallback(
		async (file: File) => {
			try {
				const bytes = new Uint8Array(await file.arrayBuffer());
				const updated = await replaceOleFile(element, bytes, file.name);
				commit(updated);
				if (mountedRef.current) {
					onClose();
				}
			} catch {
				if (mountedRef.current) {
					setSaveError(true);
				}
			}
		},
		[element, commit, onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		},
		[onClose],
	);

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm'
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
			onKeyDown={handleKeyDown}
		>
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation only */}
			<div
				ref={dialogRef}
				className='bg-background border border-border rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden'
				onClick={(e) => e.stopPropagation()}
				role='dialog'
				aria-modal='true'
				tabIndex={-1}
				aria-label={t(descriptor.titleKey)}
			>
				<div className='flex items-center justify-between px-5 py-3 border-b border-border'>
					<h2 className='text-sm font-semibold text-foreground'>{t(descriptor.titleKey)}</h2>
					<button
						type='button'
						onClick={onClose}
						className='p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors'
						aria-label={t('pptx.settings.close')}
					>
						<LuX className='w-4 h-4' />
					</button>
				</div>

				<div className='flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm'>
					{loading && (
						<p className='text-muted-foreground text-xs'>{t('pptx.ole.editDialog.loading')}</p>
					)}
					{saveError && (
						<p className='text-destructive text-xs'>{t('pptx.ole.editDialog.saveError')}</p>
					)}

					{!loading && descriptor.contentTab?.kind === 'sheet' && (
						<OleSheetGridEditor grid={grid} onCellEdit={handleCellEdit} t={t} />
					)}
					{!loading && descriptor.contentTab?.kind === 'document' && (
						<OleDocumentEditor paragraphs={paragraphs} onEdit={handleParagraphEdit} t={t} />
					)}
					{!loading && descriptor.contentTab?.kind === 'deck' && (
						<OleDeckEditor slides={deckSlides} onEdit={handleDeckElementEdit} t={t} />
					)}
					{!descriptor.contentTab && (
						<p className='text-muted-foreground text-xs'>{t('pptx.ole.editDialog.unsupported')}</p>
					)}
				</div>

				<div className='flex items-center justify-between gap-2 px-5 py-3 border-t border-border'>
					<input
						ref={fileInputRef}
						type='file'
						className='hidden'
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) {
								void handleReplaceFile(file);
							}
						}}
					/>
					<button
						type='button'
						onClick={() => fileInputRef.current?.click()}
						className='px-3 py-1.5 rounded-lg text-xs text-foreground border border-border hover:bg-accent transition-colors'
					>
						{t('pptx.ole.editDialog.replaceFile')}
					</button>
					<button
						type='button'
						onClick={onClose}
						className='px-4 py-1.5 rounded-lg text-xs font-medium bg-primary hover:bg-primary/80 text-white transition-colors'
					>
						{t('pptx.ole.editDialog.save')}
					</button>
				</div>
			</div>
		</div>
	);
}
