import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuCopy,
	LuMonitor,
	LuPaintBucket,
	LuPalette,
	LuPanelRight,
	LuPencil,
	LuPlay,
} from 'react-icons/lu';

import { cn } from '../../utils';
import { ic, ics, pill, sep } from './toolbar-constants';

/* ── Design ────────────────────────────────────────────── */

export interface DesignSectionProps {
	canEdit: boolean;
	onToggleThemeGallery: () => void;
	isThemeGalleryOpen: boolean;
	onToggleThemeEditor: () => void;
	isThemeEditorOpen: boolean;
	onOpenDocumentProperties?: () => void;
	onToggleInspector?: () => void;
	isInspectorPaneOpen?: boolean;
}

export function DesignSection(p: DesignSectionProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<>
			{/* Themes */}
			<button
				onClick={p.onToggleThemeGallery}
				disabled={!p.canEdit}
				className={cn(
					pill,
					p.isThemeGalleryOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
				)}
				title={t('pptx.ribbon.browseThemesTitle')}
			>
				<LuPalette className={ics} />
				{t('pptx.ribbon.browseThemes')}
			</button>
			<button
				onClick={p.onToggleThemeEditor}
				disabled={!p.canEdit}
				className={cn(pill, p.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')}
				title={t('pptx.ribbon.editThemeTitle')}
			>
				<LuPencil className={ics} />
				{t('pptx.ribbon.editTheme')}
			</button>

			{sep}

			{/* Customize */}
			{p.onOpenDocumentProperties && (
				<button
					onClick={p.onOpenDocumentProperties}
					className={pill}
					title={t('pptx.ribbon.slideSizeTitle')}
				>
					<LuMonitor className={ics} />
					{t('pptx.ribbon.slideSize')}
				</button>
			)}
			{p.onToggleInspector && (
				<button
					onClick={p.onToggleInspector}
					className={cn(
						pill,
						p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title={t('pptx.ribbon.formatBackgroundTitle')}
				>
					<LuPaintBucket className={ics} />
					{t('pptx.ribbon.formatBackground')}
				</button>
			)}
		</>
	);
}

/* ── Transitions ───────────────────────────────────────── */

const TRANSITION_PRESETS = [
	{ value: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ value: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ value: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ value: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ value: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ value: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ value: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ value: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ value: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
] as const;

export interface TransitionsSectionProps {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
}

export function TransitionsSection(p: TransitionsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [selected, setSelected] = React.useState('none');
	const [duration, setDuration] = React.useState('00.50');
	const [advanceOnClick, setAdvanceOnClick] = React.useState(true);
	const [advanceAfter, setAdvanceAfter] = React.useState(false);
	const [advanceAfterSeconds, setAdvanceAfterSeconds] = React.useState('00:00.00');

	return (
		<>
			{/* Preview */}
			<button type='button' className={pill} title={t('pptx.ribbon.previewTransition')}>
				<LuPlay className={ics} />
				{t('pptx.ribbon.preview')}
			</button>

			{sep}

			{/* Transition preset gallery */}
			<div className='inline-flex items-center gap-0.5 overflow-x-auto max-w-[420px]'>
				{TRANSITION_PRESETS.map((preset) => (
					<button
						key={preset.value}
						type='button'
						onClick={() => setSelected(preset.value)}
						className={cn(
							'flex-shrink-0 px-2 py-1 max-md:min-h-[44px] rounded border text-[11px] leading-tight transition-colors',
							selected === preset.value
								? 'border-primary bg-primary/10 text-primary font-medium'
								: 'border-border bg-muted hover:bg-accent text-foreground',
						)}
						title={t('pptx.ribbon.transitionTitle', { name: t(preset.labelKey) })}
					>
						{t(preset.labelKey)}
					</button>
				))}
			</div>

			{sep}

			{/* Duration */}
			<label className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
				<span className='whitespace-nowrap'>{t('pptx.ribbon.duration')}</span>
				<input
					type='text'
					value={duration}
					onChange={(e) => setDuration(e.target.value)}
					className='w-14 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground text-center'
					title={t('pptx.ribbon.transitionDurationTitle')}
				/>
			</label>

			{sep}

			{/* Sound */}
			<label className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
				<span className='whitespace-nowrap'>{t('pptx.ribbon.sound')}</span>
				<select
					className='w-24 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground'
					defaultValue='none'
				>
					<option value='none'>{t('pptx.ribbon.soundNone')}</option>
				</select>
			</label>

			{sep}

			{/* Apply to All */}
			<button type='button' className={pill} title={t('pptx.ribbon.applyTransitionToAll')}>
				<LuCopy className={ics} />
				{t('pptx.headerFooter.applyToAll')}
			</button>

			{sep}

			{/* Advance Slide group */}
			<div className='inline-flex flex-col gap-1 text-xs text-muted-foreground'>
				<span className='text-[10px] font-medium text-foreground'>
					{t('pptx.ribbon.advanceSlide')}
				</span>
				<label className='inline-flex items-center gap-1.5 cursor-pointer'>
					<input
						type='checkbox'
						checked={advanceOnClick}
						onChange={(e) => setAdvanceOnClick(e.target.checked)}
						className='accent-primary h-3 w-3'
					/>
					<span className='whitespace-nowrap'>{t('pptx.ribbon.onMouseClick')}</span>
				</label>
				<label className='inline-flex items-center gap-1.5 cursor-pointer'>
					<input
						type='checkbox'
						checked={advanceAfter}
						onChange={(e) => setAdvanceAfter(e.target.checked)}
						className='accent-primary h-3 w-3'
					/>
					<span className='whitespace-nowrap'>{t('pptx.ribbon.afterDuration')}</span>
					<input
						type='text'
						value={advanceAfterSeconds}
						onChange={(e) => setAdvanceAfterSeconds(e.target.value)}
						disabled={!advanceAfter}
						className='w-16 px-1 py-0.5 rounded border border-border bg-muted text-xs text-foreground text-center disabled:opacity-50'
						title={t('pptx.ribbon.advanceAfterSeconds')}
					/>
				</label>
			</div>

			{sep}

			{/* Inspector */}
			<button
				type='button'
				onClick={p.onToggleInspector}
				className={cn(
					pill,
					p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
				)}
				title={t('pptx.ribbon.openInspectorTransitions')}
			>
				<LuPanelRight className={ic} />
				{t('pptx.ribbon.inspector')}
			</button>
		</>
	);
}
