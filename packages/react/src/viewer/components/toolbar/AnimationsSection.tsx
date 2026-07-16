import type { PptxElement } from 'pptx-viewer-core';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuClock3,
	LuMousePointerClick,
	LuMoveRight,
	LuPaintbrush,
	LuPanelRight,
	LuPlay,
	LuSparkles,
	LuStar,
	LuTrash2,
} from 'react-icons/lu';

import { RibbonCommand, RibbonCommandStack, RibbonGroup } from './PowerPointRibbonControls';

export interface AnimationsSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	onOpenAnimationPanel?: () => void;
	onAddAnimation?: (preset: string, group: 'entrance' | 'emphasis' | 'exit') => void;
	onRemoveAnimation?: () => void;
}

const GALLERY = [
	{ value: 'appear', label: 'Appear', group: 'entrance', tone: 'text-emerald-500' },
	{ value: 'fadeIn', label: 'Fade In', group: 'entrance', tone: 'text-emerald-500' },
	{ value: 'flyIn', label: 'Fly In', group: 'entrance', tone: 'text-emerald-500' },
	{ value: 'pulse', label: 'Pulse', group: 'emphasis', tone: 'text-amber-500' },
	{ value: 'spin', label: 'Spin', group: 'emphasis', tone: 'text-amber-500' },
	{ value: 'fadeOut', label: 'Fade Out', group: 'exit', tone: 'text-red-500' },
] as const;

export function AnimationsSection(p: AnimationsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [previewActive, setPreviewActive] = useState(false);
	const disabled = !p.canEdit || p.selectedElement === null;
	const preview = () => {
		if (disabled) {
			return;
		}
		setPreviewActive(true);
		setTimeout(() => setPreviewActive(false), 1200);
	};
	return (
		<>
			<RibbonGroup label={t('pptx.animations.preview')}>
				<RibbonCommand
					label={t('pptx.animations.preview')}
					icon={<LuPlay />}
					onClick={preview}
					disabled={disabled}
					active={previewActive}
					title='Preview animation on selected element'
				/>
			</RibbonGroup>
			<RibbonGroup
				label={t('pptx.animations.animation', { defaultValue: 'Animation' })}
				className='max-w-[430px] overflow-hidden'
			>
				<div
					className='flex h-[58px] items-stretch overflow-hidden rounded-sm border border-border/60 bg-muted/30'
					title='Add animation to selected element'
					aria-label='Add Animation: Entrance, Emphasis, and Exit effects'
				>
					<span className='sr-only'>Add Animation Entrance Emphasis Exit</span>
					{GALLERY.map((item) => (
						<button
							key={item.value}
							type='button'
							disabled={disabled}
							onClick={() => p.onAddAnimation?.(item.value, item.group)}
							className='flex w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border/40 px-1 text-[9px] leading-3 text-foreground hover:bg-accent disabled:opacity-35'
							title={item.label}
						>
							<LuStar className={`h-6 w-6 fill-current ${item.tone}`} aria-hidden='true' />
							<span>{item.label}</span>
						</button>
					))}
				</div>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.animations.advanced', { defaultValue: 'Advanced Animation' })}>
				<RibbonCommand
					label={t('pptx.animations.exitEffects', { defaultValue: 'Exit Effects' })}
					icon={<LuStar className='text-red-500' />}
					onClick={() => p.onAddAnimation?.('fadeOut', 'exit')}
					disabled={disabled}
				/>
				<RibbonCommand
					label={t('pptx.animations.pathAnimation', { defaultValue: 'Path Animation' })}
					icon={<LuMoveRight />}
					onClick={() => p.onAddAnimation?.('flyIn', 'entrance')}
					disabled={disabled}
				/>
				<RibbonCommandStack>
					<RibbonCommand
						compact
						label={t('pptx.animations.effectOptions', { defaultValue: 'Effect Options' })}
						icon={<LuSparkles />}
						onClick={p.onOpenAnimationPanel ?? p.onToggleInspector}
						disabled={disabled}
					/>
					<RibbonCommand
						compact
						label={t('pptx.animations.animationPanel')}
						icon={<LuPanelRight />}
						onClick={p.onOpenAnimationPanel ?? p.onToggleInspector}
						active={p.isInspectorPaneOpen}
						title='Open Animation Panel in Inspector'
					/>
				</RibbonCommandStack>
				<RibbonCommandStack>
					<RibbonCommand
						compact
						label={t('pptx.animations.trigger', { defaultValue: 'Trigger' })}
						icon={<LuMousePointerClick />}
						onClick={p.onOpenAnimationPanel ?? p.onToggleInspector}
						disabled={disabled}
					/>
					<RibbonCommand
						compact
						label={t('pptx.animations.painter', { defaultValue: 'Animation Painter' })}
						icon={<LuPaintbrush />}
						disabled
					/>
				</RibbonCommandStack>
				<RibbonCommand
					label={t('pptx.animations.remove')}
					icon={<LuTrash2 />}
					onClick={p.onRemoveAnimation}
					disabled={disabled}
					title='Remove animation from selected element'
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.animations.timing', { defaultValue: 'Timing' })}>
				<div className='grid grid-cols-[48px_82px] items-center gap-x-1 gap-y-1 text-[10px]'>
					<label htmlFor='pptx-animation-start'>
						{t('pptx.animations.start', { defaultValue: 'Start' })}
					</label>
					<select
						id='pptx-animation-start'
						disabled
						className='h-6 rounded-sm border border-border bg-muted px-1 text-[10px]'
					>
						<option>{t('pptx.animations.onClick', { defaultValue: 'On Click' })}</option>
						<option>{t('pptx.animations.withPrevious', { defaultValue: 'With Previous' })}</option>
						<option>
							{t('pptx.animations.afterPrevious', { defaultValue: 'After Previous' })}
						</option>
					</select>
					<span className='flex items-center gap-1'>
						<LuClock3 /> {t('pptx.animations.duration', { defaultValue: 'Duration' })}
					</span>
					<input
						type='number'
						min='0'
						step='0.1'
						defaultValue='0.5'
						disabled
						className='h-6 rounded-sm border border-border bg-muted px-1 text-[10px]'
					/>
				</div>
			</RibbonGroup>
		</>
	);
}
