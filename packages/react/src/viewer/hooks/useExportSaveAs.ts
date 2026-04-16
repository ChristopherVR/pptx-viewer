import JSZip from 'jszip';
import type { PptxSlide, PptxSaveFormat, PptxHandler } from 'pptx-viewer-core';
import { guidePxToEmu } from 'pptx-viewer-core';
/**
 * useExportSaveAs — Save-As format and Package-for-Sharing handlers.
 */
import type { RefObject } from 'react';

import { generatePackageReadme } from '../utils/export';
import type { ExportModalControls } from './export-handler-types';

export interface UseExportSaveAsInput {
	slides: PptxSlide[];
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
	notesMaster: Record<string, unknown> | undefined;
	handoutMaster: Record<string, unknown> | undefined;
	guides: Array<{ id: string; axis: 'h' | 'v'; position: number }>;
	activeSlideIndexForGuides: number;
	modalControls: ExportModalControls;
}

export interface ExportSaveAsResult {
	handlePackageForSharing: () => Promise<void>;
	handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>;
	handleSaveAsPptx: () => void;
	handleSaveAsPpsx: () => void;
	handleSaveAsPptm: () => void;
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 200);
}

export function useExportSaveAs(input: UseExportSaveAsInput): ExportSaveAsResult {
	const {
		slides,
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
		notesMaster,
		handoutMaster,
		guides,
		activeSlideIndexForGuides,
		modalControls,
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
				? (filePath.replace(/\\/g, '/').split('/').pop() ?? 'presentation.pptx')
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
			const baseName = pptxFilename.replace(/\.[^.]+$/, '');
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
					.replace(/\\/g, '/')
					.split('/')
					.pop()
					?.replace(/\.[^.]+$/, '') ?? 'presentation')
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
		const saveOptions = {
			headerFooter,
			presentationProperties,
			customShows: customShows.length > 0 ? customShows : undefined,
			sections: sections.length > 0 ? sections : undefined,
			coreProperties: coreProperties ?? undefined,
			appProperties: appProperties ?? undefined,
			customProperties: customProperties.length > 0 ? customProperties : undefined,
			notesMaster,
			handoutMaster,
			outputFormat: format,
		};
		return handler.save(slidesWithGuides, saveOptions as Parameters<typeof handler.save>[1]);
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
