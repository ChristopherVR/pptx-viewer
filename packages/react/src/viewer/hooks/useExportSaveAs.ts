import JSZip from 'jszip';
import type { PptxElement, PptxSlide, PptxSaveFormat, PptxHandler } from 'pptx-viewer-core';
import { guidePxToEmu } from 'pptx-viewer-core';
import { downloadBlob } from 'pptx-viewer-shared';
/**
 * useExportSaveAs: Save-As format and Package-for-Sharing handlers.
 */
import type { RefObject } from 'react';

import { generatePackageReadme } from '../utils/export';
import { buildSaveSlides } from '../utils/template-editing';
import type { ExportModalControls } from './export-handler-types';

export interface UseExportSaveAsInput {
	slides: PptxSlide[];
	/** Separated master/layout (template) elements, merged back at save time. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	filePath: string | undefined;
	handlerRef: RefObject<PptxHandler | null>;
	serializeSlides: () => Promise<Uint8Array | null>;
	headerFooter: Record<string, unknown>;
	presentationProperties: Record<string, unknown>;
	customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
	sections: Array<{
		id: string;
		name: string;
		color?: string;
		collapsed?: boolean;
	}>;
	coreProperties: Record<string, unknown> | null;
	appProperties: Record<string, unknown> | null;
	customProperties: Array<Record<string, unknown>>;
	tagCollections: Array<Record<string, unknown>>;
	notesMaster: Record<string, unknown> | undefined;
	handoutMaster: Record<string, unknown> | undefined;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	activeSlideIndexForGuides: number;
	modalControls: ExportModalControls;
	password?: string;
}

export interface ExportSaveAsResult {
	handlePackageForSharing: () => Promise<void>;
	handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>;
	handleSaveAsPptx: () => void;
	handleSaveAsPpsx: () => void;
	handleSaveAsPptm: () => void;
}

export function useExportSaveAs(input: UseExportSaveAsInput): ExportSaveAsResult {
	const {
		slides,
		templateElementsBySlideId,
		filePath,
		handlerRef,
		serializeSlides,
		headerFooter,
		presentationProperties,
		customShows,
		sections,
		coreProperties,
		appProperties,
		customProperties,
		tagCollections,
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndexForGuides,
		modalControls,
		password,
	} = input;

	const {
		setExportModalOpen,
		setExportModalTitle,
		setExportProgress,
		setExportStatusMessage,
		exportAbortRef,
	} = modalControls;

	const handlePackageForSharing = async () => {
		const abortCtrl = new AbortController();
		exportAbortRef.current = abortCtrl;
		setExportModalTitle('Package for Sharing');
		setExportStatusMessage('Preparing package...');
		setExportProgress(0);
		setExportModalOpen(true);
		try {
			const zip = new JSZip();
			const pkgFolder = zip.folder('presentation-package')!;

			setExportProgress(10);
			setExportStatusMessage('Adding presentation...');
			const pptxData = await serializeSlides();
			const pptxFilename = filePath
				? (filePath.replace(/\\/gu, '/').split('/').pop() ?? 'presentation.pptx')
				: 'presentation.pptx';
			if (pptxData) {
				pkgFolder.file(pptxFilename, pptxData);
			}

			setExportProgress(70);
			setExportStatusMessage('Writing README...');
			const readme = generatePackageReadme(pptxFilename);
			pkgFolder.file('README.txt', readme);

			if (abortCtrl.signal.aborted) {
				throw new DOMException('Export cancelled', 'AbortError');
			}

			setExportProgress(85);
			setExportStatusMessage('Generating ZIP...');
			const zipBlob = await zip.generateAsync({ type: 'blob' });

			setExportProgress(95);
			setExportStatusMessage('Downloading...');
			const baseName = pptxFilename.replace(/\.[^.]+$/u, '');
			downloadBlob(zipBlob, `${baseName}-package.zip`);
			setExportProgress(100);
		} catch (err) {
			if ((err as DOMException).name !== 'AbortError') {
				console.error('[PowerPointViewer] Package export failed:', err);
			}
		} finally {
			exportAbortRef.current = null;
			setExportModalOpen(false);
		}
	};

	const handleSaveAsFormat = async (format: PptxSaveFormat): Promise<void> => {
		const handler = handlerRef.current;
		if (!handler) {
			return;
		}
		const ext = format === 'ppsx' ? 'ppsx' : format === 'pptm' ? 'pptm' : 'pptx';
		const baseName = filePath
			? (filePath
					.replace(/\\/gu, '/')
					.split('/')
					.pop()
					?.replace(/\.[^.]+$/u, '') ?? 'presentation')
			: 'presentation';
		try {
			const data = await buildSaveAsData(handler, format);
			const blob = new Blob([data as BlobPart], {
				type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			});
			downloadBlob(blob, `${baseName}.${ext}`);
		} catch (err) {
			console.error(`[PowerPointViewer] Save as .${ext} failed:`, err);
		}
	};

	const buildSaveAsData = async (
		handler: PptxHandler,
		format: PptxSaveFormat,
	): Promise<Uint8Array> => {
		const slidesWithGuides = slides.map((slide, idx) => {
			if (idx !== activeSlideIndexForGuides) {
				return slide;
			}
			const pptxGuides = guides.map((g) => ({
				id: g.id,
				orientation: (g.axis === 'h' ? 'horz' : 'vert') as 'horz' | 'vert',
				positionEmu: guidePxToEmu(g.position),
			}));
			return {
				...slide,
				guides: pptxGuides.length > 0 ? pptxGuides : undefined,
			};
		});
		// Merge the separated template (master/layout) elements back so edits made
		// in edit-template mode persist into the saved package.
		const slidesToSave = buildSaveSlides(slidesWithGuides, templateElementsBySlideId);
		const saveOptions = {
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties: coreProperties ?? undefined,
			appProperties: appProperties ?? undefined,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			tags: tagCollections.length > 0 ? tagCollections : undefined,
			notesMaster,
			handoutMaster,
			outputFormat: format,
		};
		if (password) {
			return handler.saveEncrypted(
				slidesToSave,
				password,
				saveOptions as Parameters<typeof handler.save>[1],
			);
		}
		return handler.save(slidesToSave, saveOptions as Parameters<typeof handler.save>[1]);
	};

	const handleSaveAsPptx = () => {
		void handleSaveAsFormat('pptx');
	};
	const handleSaveAsPpsx = () => {
		void handleSaveAsFormat('ppsx');
	};
	const handleSaveAsPptm = () => {
		void handleSaveAsFormat('pptm');
	};

	return {
		handlePackageForSharing,
		handleSaveAsFormat,
		handleSaveAsPptx,
		handleSaveAsPpsx,
		handleSaveAsPptm,
	};
}
