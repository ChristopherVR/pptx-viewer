import { BACKSTAGE_TEMPLATES, formatBackstageDate, formatBackstageSize } from 'pptx-viewer-shared';
import type { BackstageRecentFile, ToolbarActionId } from 'pptx-viewer-shared';
import React from 'react';

export interface FileSectionProps {
	fileName?: string;
	onClose: () => void;
	onCreatePresentation: (templateId: string) => void;
	onOpenFile?: () => void;
	onOpenRecentFile?: (key: string) => void;
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
	onOpenSettings?: () => void;
	onOpenShareDialog?: () => void;
	onOpenDocumentProperties?: () => void;
	onOpenPasswordProtection?: () => void;
	onOpenFontEmbedding?: () => void;
	onOpenDigitalSignatures?: () => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
}

const actionClass =
	'group flex min-h-28 items-start gap-4 border border-border bg-card p-5 text-left text-card-foreground transition hover:border-primary hover:shadow-md';

export function BackstageAction(props: {
	icon: React.ReactNode;
	title: string;
	body: string;
	onClick?: () => void;
}): React.ReactElement {
	return (
		<button type='button' className={actionClass} onClick={props.onClick}>
			<span className='mt-0.5 grid size-10 shrink-0 place-items-center bg-accent text-xl text-primary'>
				{props.icon}
			</span>
			<span>
				<strong className='block text-[15px] font-semibold'>{props.title}</strong>
				<span className='mt-1 block text-[12px] leading-5 text-muted-foreground'>{props.body}</span>
			</span>
		</button>
	);
}

export function BackstageNewGallery(props: {
	onCreate: (templateId: string) => void;
}): React.ReactElement {
	return (
		<>
			<h2 className='mt-7 text-[17px] font-semibold'>New</h2>
			<div className='mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-6'>
				{BACKSTAGE_TEMPLATES.map((template) => (
					<button
						key={template.id}
						type='button'
						className='text-left'
						onClick={() => props.onCreate(template.id)}
					>
						<span
							className='block aspect-[16/9] border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg'
							style={{ background: template.preview }}
						/>
						<strong className='mt-2 block truncate text-[12px] font-medium'>{template.name}</strong>
						<span className='block truncate text-[10px] text-muted-foreground'>
							{template.description}
						</span>
					</button>
				))}
			</div>
		</>
	);
}

export function BackstageRecentList(props: {
	files: BackstageRecentFile[];
	onOpen?: (key: string) => void;
}): React.ReactElement {
	return (
		<div className='mt-5 border-t border-border'>
			<div className='grid grid-cols-[1fr_120px_90px] px-3 py-2 text-[11px] font-semibold text-muted-foreground'>
				<span>Name</span>
				<span>Date modified</span>
				<span>Size</span>
			</div>
			{props.files.map((file) => (
				<button
					key={file.key}
					type='button'
					className='grid w-full grid-cols-[1fr_120px_90px] items-center border-t border-border px-3 py-3 text-left hover:bg-accent'
					onClick={() => props.onOpen?.(file.key)}
				>
					<span className='flex min-w-0 items-center gap-3'>
						<span className='grid size-8 shrink-0 place-items-center bg-primary font-bold text-primary-foreground'>
							P
						</span>
						<span className='min-w-0'>
							<strong className='block truncate text-[13px] font-normal'>{file.name}</strong>
							<small className='block truncate text-[11px] text-muted-foreground'>
								{file.location}
							</small>
						</span>
					</span>
					<span className='text-[11px] text-muted-foreground'>
						{formatBackstageDate(file.timestamp)}
					</span>
					<span className='text-[11px] text-muted-foreground'>
						{formatBackstageSize(file.size)}
					</span>
				</button>
			))}
			{props.files.length === 0 && (
				<div className='border-t border-border px-3 py-10 text-center text-sm text-muted-foreground'>
					No recent presentations yet. Open or autosave a file and it will appear here.
				</div>
			)}
		</div>
	);
}
