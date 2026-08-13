import type {
	PptxSlideMaster,
	PptxNotesMaster,
	PptxHandoutMaster,
	MasterViewTab,
} from 'pptx-viewer-core';
import { masterViewBackgroundColor } from 'pptx-viewer-shared';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPanelLeftClose } from 'react-icons/lu';

import type { CanvasSize } from '../types';
import { cn } from '../utils';
import { HandoutMasterPanel } from './HandoutMasterPanel';
import { NotesMasterPanel } from './NotesMasterPanel';
import { SlideMastersList } from './SlideMastersList';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: { key: MasterViewTab; labelKey: string }[] = [
	{ key: 'slides', labelKey: 'pptx.sections.slides' },
	{ key: 'notes', labelKey: 'pptx.notes.title' },
	{ key: 'handout', labelKey: 'pptx.masterView.tabHandout' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MasterViewSidebarProps {
	slideMasters: PptxSlideMaster[];
	activeMasterIndex: number;
	activeLayoutIndex: number | null;
	canvasSize: CanvasSize;
	masterViewTab: MasterViewTab;
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	handoutSlidesPerPage: number;
	/** Editing affordances are offered only on an editable deck. */
	canEdit?: boolean;
	onSelectMaster: (index: number) => void;
	onSelectLayout: (masterIndex: number, layoutIndex: number) => void;
	onCollapse: () => void;
	onTabChange: (tab: MasterViewTab) => void;
	onHandoutSlidesPerPageChange: (count: number) => void;
	onNotesMasterBackgroundChange: (color: string) => void;
	onHandoutMasterBackgroundChange: (color: string) => void;
	/** Format Background for the selected slide master or layout. */
	onSlidesBackgroundChange: (color: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MasterViewSidebar({
	slideMasters,
	activeMasterIndex,
	activeLayoutIndex,
	canvasSize,
	masterViewTab,
	notesMaster,
	handoutMaster,
	handoutSlidesPerPage,
	canEdit,
	onSelectMaster,
	onSelectLayout,
	onCollapse,
	onTabChange,
	onHandoutSlidesPerPageChange,
	onNotesMasterBackgroundChange,
	onHandoutMasterBackgroundChange,
	onSlidesBackgroundChange,
}: MasterViewSidebarProps): React.ReactElement {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();

	// Which part's background the swatch shows, decided by the same shared rule
	// that decides where a colour is written.
	const slidesBackground = masterViewBackgroundColor(
		{ slideMasters },
		{ tab: 'slides', masterIndex: activeMasterIndex, layoutIndex: activeLayoutIndex },
	);

	const handleMasterClick = useCallback(
		(index: number) => {
			onSelectMaster(index);
		},
		[onSelectMaster],
	);

	const handleLayoutClick = useCallback(
		(masterIdx: number, layoutIdx: number) => {
			onSelectLayout(masterIdx, layoutIdx);
		},
		[onSelectLayout],
	);

	return (
		<aside
			aria-label={t('pptx.view.masterViews')}
			className='flex h-full flex-col border-r border-border/80 bg-background/70 backdrop-blur-sm w-56'
		>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2'>
				<span className='text-xs uppercase tracking-wide text-muted-foreground'>
					{masterViewTab === 'slides'
						? t('pptx.master.title')
						: masterViewTab === 'notes'
							? t('pptx.master.notesMasterTitle')
							: t('pptx.master.handoutMasterTitle')}
				</span>
				<button
					type='button'
					className='rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground'
					title={t('pptx.master.collapseMasterPane')}
					onClick={onCollapse}
				>
					<LuPanelLeftClose className='h-3.5 w-3.5' />
				</button>
			</div>

			{/* Tabs */}
			<div
				role='tablist'
				aria-label={t('pptx.mode.masterView')}
				className='flex border-b border-border/60 px-1'
			>
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type='button'
						role='tab'
						aria-selected={masterViewTab === tab.key}
						className={cn(
							'flex-1 px-1 py-1.5 text-[10px] font-medium transition-colors border-b-2',
							masterViewTab === tab.key
								? 'border-amber-500 text-amber-400'
								: 'border-transparent text-muted-foreground hover:text-foreground',
						)}
						onClick={() => onTabChange(tab.key)}
					>
						{t(tab.labelKey)}
					</button>
				))}
			</div>

			{/* Scrollable content per tab */}
			<div ref={scrollRef} className='flex-1 space-y-2 overflow-y-auto px-1.5 pb-2 pt-1'>
				{masterViewTab === 'slides' && canEdit && (
					<section className='space-y-1.5 rounded-md border border-border/60 p-2'>
						<div className='text-[11px] text-muted-foreground'>
							{t('pptx.master.notesMasterBackground')}
						</div>
						<input
							type='color'
							aria-label={t('pptx.master.backgroundColorLabel')}
							className='h-7 w-full cursor-pointer rounded border border-border/60 bg-transparent'
							value={slidesBackground ?? '#ffffff'}
							onChange={(event) => onSlidesBackgroundChange(event.target.value)}
						/>
					</section>
				)}

				{masterViewTab === 'slides' && (
					<SlideMastersList
						slideMasters={slideMasters}
						activeMasterIndex={activeMasterIndex}
						activeLayoutIndex={activeLayoutIndex}
						canvasSize={canvasSize}
						onSelectMaster={handleMasterClick}
						onSelectLayout={handleLayoutClick}
					/>
				)}

				{masterViewTab === 'notes' && (
					<NotesMasterPanel
						notesMaster={notesMaster}
						onBackgroundChange={onNotesMasterBackgroundChange}
					/>
				)}

				{masterViewTab === 'handout' && (
					<HandoutMasterPanel
						handoutMaster={handoutMaster}
						slidesPerPage={handoutSlidesPerPage}
						onSlidesPerPageChange={onHandoutSlidesPerPageChange}
						onBackgroundChange={onHandoutMasterBackgroundChange}
					/>
				)}
			</div>
		</aside>
	);
}
