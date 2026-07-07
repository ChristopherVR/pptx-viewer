import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuList, LuPipette } from 'react-icons/lu';

import { cn } from '../../utils';
import { ic, pill, sep } from './toolbar-constants';

export interface ViewSectionProps {
	canEdit: boolean;
	editTemplateMode: boolean;
	onSetEditTemplateMode: (mode: boolean) => void;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	showGrid: boolean;
	showRulers: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	onZoomToFit?: () => void;
}

export function ViewSection(p: ViewSectionProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<>
			{/* Presentation Views group */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-0.5'>
					<button className={pill} title={t('pptx.statusBar.normalView')}>
						{t('pptx.view.normal')}
					</button>
					{p.onToggleSlideSorter ? (
						<button
							className={pill}
							onClick={p.onToggleSlideSorter}
							title={t('pptx.view.slideSorterTooltip')}
						>
							{t('pptx.slideSorter.title')}
						</button>
					) : (
						<button className={pill} title={t('pptx.view.slideSorterTooltip')}>
							{t('pptx.slideSorter.title')}
						</button>
					)}
					<button className={pill} title={t('pptx.view.readingView')}>
						{t('pptx.view.readingView')}
					</button>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.view.presentationViews')}
				</span>
			</div>
			{sep}

			{/* Master Views group */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-0.5'>
					<button
						onClick={p.onEnterMasterView}
						disabled={!p.canEdit}
						className={pill}
						title={t('pptx.view.slideMasterTooltip')}
					>
						{t('pptx.master.title')}
					</button>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.view.masterViews')}
				</span>
			</div>
			{sep}

			{/* Zoom group */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-0.5'>
					{p.onZoomToFit && (
						<button
							className={pill}
							onClick={p.onZoomToFit}
							title={t('pptx.view.zoomToFitTooltip')}
						>
							{t('pptx.view.zoomToFit')}
						</button>
					)}
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.slideSorter.zoom')}
				</span>
			</div>
			{sep}

			<button
				onClick={() => p.onSetEditTemplateMode(!p.editTemplateMode)}
				disabled={!p.canEdit}
				className={cn(
					pill,
					p.editTemplateMode ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '',
				)}
				title={t('pptx.view.templateEditingTooltip')}
			>
				{p.editTemplateMode ? t('pptx.ribbon.templatesOn') : t('pptx.ribbon.templatesOff')}
			</button>
			{p.onToggleSelectionPane && (
				<button
					type='button'
					onClick={p.onToggleSelectionPane}
					className={cn(
						pill,
						p.isSelectionPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title={t('pptx.selectionPane.title')}
				>
					<LuList className={ic} />
					{t('pptx.view.selection')}
				</button>
			)}
			{p.onToggleEyedropper && (
				<button
					type='button'
					onClick={p.onToggleEyedropper}
					disabled={!p.canEdit}
					className={cn(
						pill,
						p.eyedropperActive ? 'bg-purple-600 hover:bg-purple-500 text-purple-50' : '',
					)}
					title={t('pptx.view.eyedropperTooltip')}
				>
					<LuPipette className={ic} />
					{t('pptx.ribbon.eyedropper')}
				</button>
			)}
			<button
				onClick={() => p.onSetShowGrid(!p.showGrid)}
				className={cn(pill, p.showGrid ? 'bg-primary text-white' : '')}
				title={t('pptx.grid.toggleGrid')}
			>
				{t('pptx.grid.grid')}
			</button>
			<button
				onClick={() => p.onSetShowRulers(!p.showRulers)}
				className={cn(pill, p.showRulers ? 'bg-primary text-white' : '')}
				title={t('pptx.ruler.toggleRulers')}
			>
				{t('pptx.ruler.rulers')}
			</button>
			<button
				onClick={() => p.onSetSnapToGrid(!p.snapToGrid)}
				className={cn(pill, p.snapToGrid ? 'bg-primary text-white' : '')}
				title={t('pptx.grid.snapToGrid')}
			>
				{t('pptx.grid.snapToGrid')}
			</button>
			<button
				onClick={() => p.onSetSnapToShape(!p.snapToShape)}
				className={cn(pill, p.snapToShape ? 'bg-primary text-white' : '')}
				title={t('pptx.grid.snapToShape')}
			>
				{t('pptx.grid.snapToShape')}
			</button>
			<button
				onClick={() => p.onAddGuide('h')}
				className={pill}
				title={t('pptx.view.addHorizontalGuide')}
			>
				{t('pptx.view.hGuide')}
			</button>
			<button
				onClick={() => p.onAddGuide('v')}
				className={pill}
				title={t('pptx.view.addVerticalGuide')}
			>
				{t('pptx.view.vGuide')}
			</button>
			<button
				onClick={() => p.onSetSpellCheckEnabled(!p.spellCheckEnabled)}
				className={cn(pill, p.spellCheckEnabled ? 'bg-primary text-white' : '')}
				title={t('pptx.view.toggleSpellCheck')}
			>
				{t('pptx.view.spell')}
			</button>
		</>
	);
}
