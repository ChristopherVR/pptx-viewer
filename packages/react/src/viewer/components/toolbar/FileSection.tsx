import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuCopy,
	LuDownload,
	LuFileText,
	LuFolderOpen,
	LuImage,
	LuInfo,
	LuLock,
	LuPackage,
	LuPlay,
	LuPrinter,
	LuShieldAlert,
	LuType,
	LuVideo,
} from 'react-icons/lu';

import { ic, pill, sep } from './toolbar-constants';

export interface FileSectionProps {
	/** Open another presentation. Hidden when not provided. */
	onOpenFile?: () => void;
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
	const { t } = useTranslation();
	return (
		<>
			{/* Open another presentation */}
			{p.onOpenFile && (
				<>
					<button
						onClick={p.onOpenFile}
						className={pill}
						title={t('pptx.ribbon.openAnotherPresentation')}
					>
						<LuFolderOpen className={ic} />
						{t('pptx.ribbon.open')}
					</button>
					{sep}
				</>
			)}

			{/* Save & Export */}
			<button onClick={p.onSaveAsPptx} className={pill} title={t('pptx.file.saveAsPptxTooltip')}>
				<LuDownload className={ic} />
				{t('pptx.file.saveAsPptx')}
			</button>
			<button onClick={p.onSaveAsPpsx} className={pill} title={t('pptx.file.saveAsPpsxTooltip')}>
				<LuPlay className={ic} />
				{t('pptx.file.saveAsPpsx')}
			</button>
			{p.hasMacros && (
				<button onClick={p.onSaveAsPptm} className={pill} title={t('pptx.file.saveAsPptmTooltip')}>
					<LuFileText className={ic} />
					{t('pptx.file.saveAsPptm')}
				</button>
			)}
			<button
				onClick={p.onPackageForSharing}
				className={pill}
				title={t('pptx.file.packageTooltip')}
			>
				<LuPackage className={ic} />
				{t('pptx.file.package')}
			</button>

			{sep}

			{/* Export */}
			<button onClick={p.onExportPng} className={pill} title={t('pptx.mobileMenu.exportPng')}>
				<LuDownload className={ic} />
				{t('pptx.file.png')}
			</button>
			<button onClick={p.onExportPdf} className={pill} title={t('pptx.mobileMenu.exportPdf')}>
				<LuFileText className={ic} />
				{t('pptx.file.pdf')}
			</button>
			<button onClick={p.onExportVideo} className={pill} title={t('pptx.mobileMenu.exportVideo')}>
				<LuVideo className={ic} />
				{t('pptx.file.video')}
			</button>
			<button onClick={p.onExportGif} className={pill} title={t('pptx.ribbon.exportGifTitle')}>
				<LuImage className={ic} />
				{t('pptx.file.gif')}
			</button>
			<button
				onClick={p.onCopySlideAsImage}
				className={pill}
				title={t('pptx.file.copyImageTooltip')}
			>
				<LuCopy className={ic} />
				{t('pptx.file.copyImage')}
			</button>

			{sep}

			{/* Print */}
			<button onClick={p.onPrint} className={pill} title={t('pptx.print.title')}>
				<LuPrinter className={ic} />
				{t('pptx.print.printButton')}
			</button>

			{sep}

			{/* Info */}
			{p.onOpenDocumentProperties && (
				<button
					onClick={p.onOpenDocumentProperties}
					className={pill}
					title={t('pptx.ribbon.documentProperties')}
				>
					<LuInfo className={ic} />
					{t('pptx.ribbon.properties')}
				</button>
			)}
			{p.onOpenPasswordProtection && (
				<button
					onClick={p.onOpenPasswordProtection}
					className={pill}
					title={t('pptx.password.title')}
				>
					<LuLock className={ic} />
					{t('pptx.ribbon.protect')}
				</button>
			)}
			{p.onOpenFontEmbedding && (
				<button
					onClick={p.onOpenFontEmbedding}
					className={pill}
					title={t('pptx.ribbon.embedFonts')}
				>
					<LuType className={ic} />
					{t('pptx.file.fonts')}
				</button>
			)}
			{p.onOpenDigitalSignatures && (
				<button
					onClick={p.onOpenDigitalSignatures}
					className={pill}
					title={t('pptx.digitalSignatures.title')}
				>
					<LuShieldAlert className={ic} />
					{t('pptx.ribbon.signatures')}
				</button>
			)}
		</>
	);
}
