import type { PptxElement } from 'pptx-viewer-core';
import { DEFAULT_MOTION_PATH_PRESET_ID } from 'pptx-viewer-shared';
import type { AnimationApplyGroup } from 'pptx-viewer-shared';
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

import { AnimationPresetGallery } from './AnimationPresetGallery';
import { MotionPathGallery } from './MotionPathGallery';
import { RibbonCommand, RibbonCommandStack, RibbonGroup } from './PowerPointRibbonControls';

export interface AnimationsSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	onOpenAnimationPanel?: () => void;
	onAddAnimation?: (preset: string, group: AnimationApplyGroup) => void;
	onRemoveAnimation?: () => void;
}

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
					title={t('pptx.animations.previewTooltip')}
				/>
			</RibbonGroup>
			<RibbonGroup
				label={t('pptx.animations.animation', { defaultValue: 'Animation' })}
				className='max-w-[500px] overflow-hidden'
			>
				<AnimationPresetGallery disabled={disabled} onAddAnimation={p.onAddAnimation} />
			</RibbonGroup>
			<RibbonGroup label={t('pptx.animation.motionPath')} className='max-w-[420px] overflow-hidden'>
				<MotionPathGallery
					disabled={disabled}
					onApplyMotionPath={(presetId) => p.onAddAnimation?.(presetId, 'motionPath')}
				/>
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
					// One-click default path (Lines: Right). It used to apply a Fly In
					// entrance, which is not a path at all.
					onClick={() => p.onAddAnimation?.(DEFAULT_MOTION_PATH_PRESET_ID, 'motionPath')}
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
						title={t('pptx.animations.openPanelTooltip')}
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
					title={t('pptx.animations.removeTooltip')}
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
						// The caption beside it is a plain <span>, not a <label>, so nothing
						// named this field: it read as an anonymous number box.
						aria-label={t('pptx.animations.duration', { defaultValue: 'Duration' })}
						className='h-6 rounded-sm border border-border bg-muted px-1 text-[10px]'
					/>
				</div>
			</RibbonGroup>
		</>
	);
}
