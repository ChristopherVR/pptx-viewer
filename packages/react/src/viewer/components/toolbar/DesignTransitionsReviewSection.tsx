import React from 'react';
import {
	LuCopy,
	LuGitCompare,
	LuMessageSquare,
	LuMonitor,
	LuPaintBucket,
	LuPalette,
	LuPanelRight,
	LuPencil,
	LuPlay,
	LuSpellCheck,
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
				title='Browse and apply built-in themes'
			>
				<LuPalette className={ics} />
				Browse Themes
			</button>
			<button
				onClick={p.onToggleThemeEditor}
				disabled={!p.canEdit}
				className={cn(pill, p.isThemeEditorOpen ? 'bg-primary hover:bg-primary/80 text-white' : '')}
				title='Edit presentation theme colors and fonts'
			>
				<LuPencil className={ics} />
				Edit Theme
			</button>

			{sep}

			{/* Customize */}
			{p.onOpenDocumentProperties && (
				<button
					onClick={p.onOpenDocumentProperties}
					className={pill}
					title='Change slide dimensions (16:9, 4:3, custom)'
				>
					<LuMonitor className={ics} />
					Slide Size
				</button>
			)}
			{p.onToggleInspector && (
				<button
					onClick={p.onToggleInspector}
					className={cn(
						pill,
						p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title='Open inspector to edit slide background'
				>
					<LuPaintBucket className={ics} />
					Format Background
				</button>
			)}
		</>
	);
}

/* ── Transitions ───────────────────────────────────────── */

const TRANSITION_PRESETS = [
	{ value: 'none', label: 'None' },
	{ value: 'fade', label: 'Fade' },
	{ value: 'push', label: 'Push' },
	{ value: 'wipe', label: 'Wipe' },
	{ value: 'split', label: 'Split' },
	{ value: 'reveal', label: 'Reveal' },
	{ value: 'cut', label: 'Cut' },
	{ value: 'cover', label: 'Cover' },
	{ value: 'uncover', label: 'Uncover' },
] as const;

export interface TransitionsSectionProps {
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
}

export function TransitionsSection(p: TransitionsSectionProps): React.ReactElement {
	const [selected, setSelected] = React.useState('none');
	const [duration, setDuration] = React.useState('00.50');

	return (
		<>
			{/* Preview */}
			<button type='button' className={pill} title='Preview transition'>
				<LuPlay className={ics} />
				Preview
			</button>

			{sep}

			{/* Transition preset gallery */}
			<div className='inline-flex items-center gap-0.5 overflow-x-auto max-w-[420px]'>
				{TRANSITION_PRESETS.map((t) => (
					<button
						key={t.value}
						type='button'
						onClick={() => setSelected(t.value)}
						className={cn(
							'flex-shrink-0 px-2 py-1 max-md:min-h-[44px] rounded border text-[11px] leading-tight transition-colors',
							selected === t.value
								? 'border-primary bg-primary/10 text-primary font-medium'
								: 'border-border bg-muted hover:bg-accent text-foreground',
						)}
						title={`${t.label} transition`}
					>
						{t.label}
					</button>
				))}
			</div>

			{sep}

			{/* Duration */}
			<label className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
				<span className='whitespace-nowrap'>Duration:</span>
				<input
					type='text'
					value={duration}
					onChange={(e) => setDuration(e.target.value)}
					className='w-14 px-1.5 py-1 rounded border border-border bg-muted text-xs text-foreground text-center'
					title='Transition duration in seconds'
				/>
			</label>

			{sep}

			{/* Apply to All */}
			<button type='button' className={pill} title='Apply transition to all slides'>
				<LuCopy className={ics} />
				Apply to All
			</button>

			{sep}

			{/* Inspector */}
			<button
				type='button'
				onClick={p.onToggleInspector}
				className={cn(
					pill,
					p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
				)}
				title='Open Inspector for full transition options'
			>
				<LuPanelRight className={ic} />
				Inspector
			</button>
		</>
	);
}

/* ── Review ────────────────────────────────────────────── */

export interface ReviewSectionProps {
	canEdit: boolean;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	onToggleComments?: () => void;
	isCommentsPanelOpen?: boolean;
	slideCommentCount?: number;
	onCompare?: () => void;
}

export function ReviewSection(p: ReviewSectionProps): React.ReactElement {
	return (
		<>
			{p.onToggleComments && (
				<button
					onClick={p.onToggleComments}
					className={cn(
						pill,
						p.isCommentsPanelOpen ? 'bg-primary hover:bg-primary/80 text-white' : '',
					)}
					title='Toggle comments panel'
				>
					<LuMessageSquare className={ic} />
					Comments
					{(p.slideCommentCount ?? 0) > 0 && (
						<span className='inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-[10px] font-medium text-white px-1'>
							{p.slideCommentCount}
						</span>
					)}
				</button>
			)}
			<button
				onClick={() => p.onSetSpellCheckEnabled(!p.spellCheckEnabled)}
				className={cn(pill, p.spellCheckEnabled ? 'bg-primary hover:bg-primary/80 text-white' : '')}
				title='Toggle spell check'
			>
				<LuSpellCheck className={ic} />
				Spelling
			</button>
			{p.onCompare && (
				<button
					onClick={p.onCompare}
					disabled={!p.canEdit}
					className={pill}
					title='Compare with another presentation'
				>
					<LuGitCompare className={ic} />
					Compare
				</button>
			)}
		</>
	);
}
