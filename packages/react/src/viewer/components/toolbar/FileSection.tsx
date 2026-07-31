import { BACKSTAGE_NAV, listBackstageRecentFiles } from 'pptx-viewer-shared';
import type { BackstagePage, BackstageRecentFile } from 'pptx-viewer-shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft, LuFolderOpen, LuSearch, LuSettings } from 'react-icons/lu';

import { useToolbarVisibility } from '../../hooks/useToolbarVisibility';
import { AccountPage } from './AccountPage';
import { BackstageCards } from './file-backstage-cards';
import { BackstageNavIcon } from './file-backstage-icons';
import { BackstageNewGallery, BackstageRecentList } from './file-backstage-parts';
import type { FileSectionProps } from './file-backstage-parts';

export function FileSection(p: FileSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [page, setPage] = useState<BackstagePage>('home');
	const [query, setQuery] = useState('');
	const [recent, setRecent] = useState<BackstageRecentFile[]>([]);
	const { isHidden } = useToolbarVisibility(p.hiddenActions);
	const exportHidden = isHidden('export');
	useEffect(() => {
		void listBackstageRecentFiles(t).then(setRecent);
	}, [t]);
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
	const current = BACKSTAGE_NAV.find((item) => item.id === page);
	const title = current
		? t(current.labelKey, { defaultValue: current.label })
		: t('pptx.backstage.nav.home');
	return (
		<div
			className='fixed inset-0 z-[200] flex bg-background font-[Aptos,Segoe_UI,sans-serif] text-foreground max-md:flex-col'
			role='dialog'
			aria-modal='true'
			aria-label={t('pptx.backstage.title')}
		>
			<aside className='flex w-[148px] shrink-0 flex-col border-r border-border bg-secondary max-md:w-full max-md:flex-row max-md:items-center max-md:overflow-x-auto max-md:border-r-0 max-md:border-b'>
				<button
					type='button'
					aria-label={t('pptx.backstage.back')}
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
							{t(item.labelKey, { defaultValue: item.label })}
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
							{t(item.labelKey, { defaultValue: item.label })}
						</button>
					))}
				</nav>
			</aside>
			<main className='min-w-0 flex-1 overflow-y-auto bg-background px-[clamp(32px,4vw,72px)] py-5 max-md:px-4 max-md:py-4'>
				<h1 className='text-[24px] font-semibold'>
					{page === 'home' ? t('pptx.backstage.greeting') : title}
				</h1>
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
								placeholder={t('pptx.backstage.searchPlaceholder')}
								className='h-10 min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none'
							/>
						</div>
						{page === 'open' && (
							<button
								type='button'
								className='mt-4 inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90'
								onClick={() => run(p.onOpenFile)}
							>
								<LuFolderOpen /> {t('pptx.backstage.browseDevice')}
							</button>
						)}
						<h2 className='mt-6 text-[16px] font-semibold'>{t('pptx.backstage.recentHeading')}</h2>
						<BackstageRecentList
							files={visibleRecent}
							onOpen={(key) => run(() => p.onOpenRecentFile?.(key))}
						/>
					</>
				)}
				{!(page === 'export' && exportHidden) && <BackstageCards page={page} props={p} run={run} />}
				{page === 'account' && <AccountPage />}
				{page === 'options' && (
					<div className='mt-8 max-w-[760px] border border-border bg-card p-7 text-card-foreground'>
						<LuSettings className='text-3xl text-primary' />
						<h2 className='mt-4 text-lg font-semibold'>{t('pptx.backstage.optionsTitle')}</h2>
						<p className='mt-2 text-sm text-muted-foreground'>{t('pptx.backstage.optionsBody')}</p>
						<button
							type='button'
							className='mt-6 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90'
							onClick={() => run(p.onOpenSettings)}
						>
							{t('pptx.backstage.openOptions')}
						</button>
					</div>
				)}
				<p className='mt-12 text-[11px] text-muted-foreground'>
					{p.fileName || t('pptx.backstage.untitled')} · {t('pptx.backstage.savedToBrowser')}
				</p>
			</main>
		</div>
	);
}
