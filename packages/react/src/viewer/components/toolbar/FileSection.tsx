import React from 'react';
import {
	LuCopy,
	LuDownload,
	LuFileText,
	LuFolderOpen,
	LuImage,
	LuInfo,
	LuLock,
	LuPlay,
	LuPrinter,
	LuShieldAlert,
	LuType,
	LuVideo,
} from 'react-icons/lu';

import { ic, pill, sep } from './toolbar-constants';

export interface FileSectionProps {
	onExportPng: () => void;
	onExportPdf: () => void;
	onExportVideo: () => void;
	onExportGif: () => void;
	onPackageForSharing: () => void;
	onSaveAsPptx: () => void;
	onSaveAsPpsx: () => void;
	onSaveAsPptm: () => void;
	hasMacros: boolean;
	onCopySlideAsImage: () => void;
	onPrint: () => void;
	onOpenDocumentProperties?: () => void;
	onOpenPasswordProtection?: () => void;
	onOpenFontEmbedding?: () => void;
	onOpenDigitalSignatures?: () => void;
}

export function FileSection(p: FileSectionProps): React.ReactElement {
	return (
		<>
			{/* Save & Export */}
			<button onClick={p.onSaveAsPptx} className={pill} title='Save as Presentation (.pptx)'>
				<LuDownload className={ic} />
				Save .pptx
			</button>
			<button onClick={p.onSaveAsPpsx} className={pill} title='Save as Slide Show (.ppsx)'>
				<LuPlay className={ic} />
				Save .ppsx
			</button>
			{p.hasMacros && (
				<button onClick={p.onSaveAsPptm} className={pill} title='Save as Macro-Enabled (.pptm)'>
					<LuFileText className={ic} />
					Save .pptm
				</button>
			)}
			<button onClick={p.onPackageForSharing} className={pill} title='Package for Sharing'>
				<LuFolderOpen className={ic} />
				Package
			</button>

			{sep}

			{/* Export */}
			<button onClick={p.onExportPng} className={pill} title='Export as PNG'>
				<LuDownload className={ic} />
				PNG
			</button>
			<button onClick={p.onExportPdf} className={pill} title='Export as PDF'>
				<LuFileText className={ic} />
				PDF
			</button>
			<button onClick={p.onExportVideo} className={pill} title='Export as Video'>
				<LuVideo className={ic} />
				Video
			</button>
			<button onClick={p.onExportGif} className={pill} title='Export as GIF'>
				<LuImage className={ic} />
				GIF
			</button>
			<button onClick={p.onCopySlideAsImage} className={pill} title='Copy Slide as Image'>
				<LuCopy className={ic} />
				Copy Image
			</button>

			{sep}

			{/* Print */}
			<button onClick={p.onPrint} className={pill} title='Print'>
				<LuPrinter className={ic} />
				Print
			</button>

			{sep}

			{/* Info */}
			{p.onOpenDocumentProperties && (
				<button onClick={p.onOpenDocumentProperties} className={pill} title='Document Properties'>
					<LuInfo className={ic} />
					Properties
				</button>
			)}
			{p.onOpenPasswordProtection && (
				<button onClick={p.onOpenPasswordProtection} className={pill} title='Protect Presentation'>
					<LuLock className={ic} />
					Protect
				</button>
			)}
			{p.onOpenFontEmbedding && (
				<button onClick={p.onOpenFontEmbedding} className={pill} title='Embed Fonts'>
					<LuType className={ic} />
					Fonts
				</button>
			)}
			{p.onOpenDigitalSignatures && (
				<button onClick={p.onOpenDigitalSignatures} className={pill} title='Digital Signatures'>
					<LuShieldAlert className={ic} />
					Signatures
				</button>
			)}
		</>
	);
}
