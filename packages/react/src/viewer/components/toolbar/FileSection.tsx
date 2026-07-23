import { BACKSTAGE_NAV, listBackstageRecentFiles } from 'pptx-viewer-shared';
import type { BackstagePage, BackstageRecentFile } from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useState } from 'react';
import {
	LuArrowLeft,
	LuBox,
	LuCopy,
	LuDownload,
	LuFileImage,
	LuFileText,
	LuFolderOpen,
	LuInfo,
	LuLock,
	LuPackage,
	LuPlay,
	LuPrinter,
	LuSearch,
	LuSettings,
	LuShare2,
	LuShieldAlert,
	LuType,
	LuVideo,
} from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { AccountPage } from './AccountPage';
import { BackstageNavIcon } from './file-backstage-icons';
import {
	BackstageAction as Action,
	BackstageNewGallery,
	BackstageRecentList,
} from './file-backstage-parts';
import type { FileSectionProps } from './file-backstage-parts';

export function FileSection(p: FileSectionProps): React.ReactElement {
	const [page, setPage] = useState<BackstagePage>('home');
	const [query, setQuery] = useState('');
	const [recent, setRecent] = useState<BackstageRecentFile[]>([]);
	const { isHidden } = useToolbarVisibility(p.hiddenActions);
	const exportHidden = isHidden('export');
	useEffect(() => {
		void listBackstageRecentFiles().then(setRecent);
	}, []);
	const visibleRecent = useMemo(() => {
		const q = query.trim().toLowerCase();
		return q
			? recent.filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(q))
			: recent;
	}, [query, recent]);

	const run = (action?: () => void) => {
		action?.();
		if (action) {
			p.onClose();
		}
	};
	const title = BACKSTAGE_NAV.find((item) => item.id === page)?.label ?? 'Home';
	return (
		<div
			className='fixed inset-0 z-[200] flex bg-background font-[Aptos,Segoe_UI,sans-serif] text-foreground max-md:flex-col'
			role='dialog'
			aria-modal='true'
			aria-label='File'
		>
			<aside className='flex w-[148px] shrink-0 flex-col border-r border-border bg-secondary max-md:w-full max-md:flex-row max-md:items-center max-md:overflow-x-auto max-md:border-r-0 max-md:border-b'>
				<button
					type='button'
					aria-label='Back to presentation'
					onClick={p.onClose}
					className='grid h-47px min-h-[48px] place-items-center border-b border-border text-xl hover:bg-accent max-md:min-w-[48px] max-md:shrink-0 max-md:border-b-0 max-md:border-r'
				>
					<LuArrowLeft />
				</button>
				<nav className='flex min-h-0 flex-1 flex-col py-2 max-md:flex-row max-md:items-center max-md:py-0'>
					{BACKSTAGE_NAV.filter(
						(item) => !item.group && !(item.id === 'export' && exportHidden),
					).map((item) => (
						<button
							key={item.id}
							type='button'
							onClick={() =>
								item.id === 'close'
									? p.onClose()
									: item.id === 'save'
										? run(p.onSaveAsPptx)
										: setPage(item.id)
							}
							className={`flex min-h-10 items-center gap-3 border-l-2 px-4 text-left text-[12px] max-md:shrink-0 max-md:whitespace-nowrap max-md:border-l-0 max-md:border-b-2 max-md:px-3 ${page === item.id ? 'border-primary bg-card text-primary' : 'border-transparent hover:bg-accent'}`}
						>
							<BackstageNavIcon page={item.id} />
							{item.label}
						</button>
					))}
					<div className='flex-1 max-md:hidden' />
					{BACKSTAGE_NAV.filter((item) => item.group).map((item) => (
						<button
							key={item.id}
							type='button'
							onClick={() =>
								item.id === 'options' && p.onOpenSettings ? run(p.onOpenSettings) : setPage(item.id)
							}
							className={`flex min-h-10 items-center gap-3 border-l-2 px-4 text-left text-[12px] max-md:shrink-0 max-md:whitespace-nowrap max-md:border-l-0 max-md:border-b-2 max-md:px-3 ${page === item.id ? 'border-primary bg-card text-primary' : 'border-transparent hover:bg-accent'}`}
						>
							<BackstageNavIcon page={item.id} />
							{item.label}
						</button>
					))}
				</nav>
			</aside>
			<main className='min-w-0 flex-1 overflow-y-auto bg-background px-[clamp(32px,4vw,72px)] py-5 max-md:px-4 max-md:py-4'>
				<h1 className='text-[24px] font-semibold'>{page === 'home' ? 'Good evening' : title}</h1>
				{(page === 'home' || page === 'new') && (
					<BackstageNewGallery
						onCreate={(templateId) => run(() => p.onCreatePresentation(templateId))}
					/>
				)}
				{(page === 'home' || page === 'open') && (
					<>
						<div className='mt-8 flex max-w-[540px] items-center border border-input bg-card px-3 focus-within:border-ring'>
							<LuSearch className='text-muted-foreground' />
							<input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder='Search recent presentations'
								className='h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none'
							/>
						</div>
						{page === 'open' && (
							<button
								type='button'
								className='mt-4 inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90'
								onClick={() => run(p.onOpenFile)}
							>
								<LuFolderOpen /> Browse this device
							</button>
						)}
						<h2 className='mt-6 text-[16px] font-semibold'>Recent</h2>
						<BackstageRecentList
							files={visibleRecent}
							onOpen={(key) => run(() => p.onOpenRecentFile?.(key))}
						/>
					</>
				)}
				{page === 'info' && (
					<div className='mt-8 grid max-w-[900px] grid-cols-2 gap-5'>
						<Action
							icon={<LuLock />}
							title='Protect Presentation'
							body='Control what changes people can make to this presentation.'
							onClick={() => run(p.onOpenPasswordProtection)}
						/>
						<Action
							icon={<LuInfo />}
							title='Inspect Presentation'
							body='Review document properties, accessibility, and hidden content.'
							onClick={() => run(p.onOpenDocumentProperties)}
						/>
						<Action
							icon={<LuType />}
							title='Embed Fonts'
							body='Keep typography consistent when the file moves between devices.'
							onClick={() => run(p.onOpenFontEmbedding)}
						/>
						<Action
							icon={<LuShieldAlert />}
							title='Digital Signatures'
							body='View and manage signatures attached to this presentation.'
							onClick={() => run(p.onOpenDigitalSignatures)}
						/>
					</div>
				)}
				{page === 'saveAs' && (
					<div className='mt-8 grid max-w-[900px] grid-cols-2 gap-5'>
						<Action
							icon={<LuDownload />}
							title='PowerPoint Presentation'
							body='Save an editable .pptx copy.'
							onClick={() => run(p.onSaveAsPptx)}
						/>
						<Action
							icon={<LuPlay />}
							title='PowerPoint Show'
							body='Save a .ppsx file that opens directly in slide show.'
							onClick={() => run(p.onSaveAsPpsx)}
						/>
						{p.hasMacros && (
							<Action
								icon={<LuFileText />}
								title='Macro-Enabled Presentation'
								body='Preserve VBA content in a .pptm file.'
								onClick={() => run(p.onSaveAsPptm)}
							/>
						)}
						<Action
							icon={<LuPackage />}
							title='Package for Sharing'
							body='Bundle the presentation and linked assets.'
							onClick={() => run(p.onPackageForSharing)}
						/>
					</div>
				)}
				{page === 'export' && !exportHidden && (
					<div className='mt-8 grid max-w-[900px] grid-cols-2 gap-5'>
						<Action
							icon={<LuFileText />}
							title='Create PDF'
							body='Publish a portable document with one page per slide.'
							onClick={() => run(p.onExportPdf)}
						/>
						<Action
							icon={<LuFileImage />}
							title='Export current slide'
							body='Create a high-quality PNG image.'
							onClick={() => run(p.onExportPng)}
						/>
						<Action
							icon={<LuVideo />}
							title='Create a Video'
							body='Export slide timings and animations as WebM.'
							onClick={() => run(p.onExportVideo)}
						/>
						<Action
							icon={<LuBox />}
							title='Create an Animated GIF'
							body='Make a compact looping preview.'
							onClick={() => run(p.onExportGif)}
						/>
						<Action
							icon={<LuCopy />}
							title='Copy as Image'
							body='Copy the current slide to the clipboard.'
							onClick={() => run(p.onCopySlideAsImage)}
						/>
					</div>
				)}
				{page === 'print' && (
					<div className='mt-8 max-w-[700px]'>
						<Action
							icon={<LuPrinter />}
							title='Print Presentation'
							body='Choose a printer, layout, copies, and output settings in your browser print dialog.'
							onClick={() => run(p.onPrint)}
						/>
					</div>
				)}
				{page === 'share' && (
					<div className='mt-8 grid max-w-[900px] grid-cols-2 gap-5'>
						<Action
							icon={<LuShare2 />}
							title='Share with People'
							body='Invite collaborators and work on the presentation together.'
							onClick={() => run(p.onOpenShareDialog)}
						/>
						<Action
							icon={<LuPackage />}
							title='Package for Sharing'
							body='Download a self-contained package for offline sharing.'
							onClick={() => run(p.onPackageForSharing)}
						/>
					</div>
				)}
				{page === 'account' && <AccountPage />}
				{page === 'options' && (
					<div className='mt-8 max-w-[760px] border border-border bg-card p-7 text-card-foreground'>
						<LuSettings className='text-3xl text-primary' />
						<h2 className='mt-4 text-lg font-semibold'>PowerPoint Options</h2>
						<p className='mt-2 text-sm text-muted-foreground'>
							Configure autosave, proofing, grid, rulers, language, theme, and keyboard shortcuts.
						</p>
						<button
							type='button'
							className='mt-6 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90'
							onClick={() => run(p.onOpenSettings)}
						>
							Open Options
						</button>
					</div>
				)}
				<p className='mt-12 text-[11px] text-muted-foreground'>
					{p.fileName || 'Untitled Presentation.pptx'} · Saved to this browser
				</p>
			</main>
		</div>
	);
}
