import type { PptxElement } from 'pptx-viewer-core';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuPanelRight, LuPlay, LuSparkles, LuTrash2 } from 'react-icons/lu';

import { cn } from '../../utils';
import { ic, pill, sep } from './toolbar-constants';

export interface AnimationsSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
	/** Opens the inspector and switches to properties tab to show the animation panel. */
	onOpenAnimationPanel?: () => void;
	/** Adds an animation preset to the selected element. */
	onAddAnimation?: (preset: string, group: 'entrance' | 'emphasis' | 'exit') => void;
	/** Removes all animations from the selected element. */
	onRemoveAnimation?: () => void;
}

/* Preset categories shown in the "Add Animation" dropdown. */
const ANIMATION_PRESETS = [
	{
		group: 'Entrance',
		items: [
			{ value: 'appear', label: 'Appear' },
			{ value: 'fadeIn', label: 'Fade In' },
			{ value: 'flyIn', label: 'Fly In' },
		],
	},
	{
		group: 'Emphasis',
		items: [
			{ value: 'pulse', label: 'Pulse' },
			{ value: 'spin', label: 'Spin' },
		],
	},
	{
		group: 'Exit',
		items: [
			{ value: 'disappear', label: 'Disappear' },
			{ value: 'fadeOut', label: 'Fade Out' },
		],
	},
] as const;

export function AnimationsSection(p: AnimationsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [previewActive, setPreviewActive] = useState(false);
	const hasElement = p.selectedElement !== null;
	const disabled = !p.canEdit || !hasElement;

	const handlePreview = () => {
		if (disabled) {
			return;
		}
		setPreviewActive(true);
		// Reset after a short delay to re-enable the button
		setTimeout(() => setPreviewActive(false), 1200);
	};

	return (
		<>
			{/* Preview */}
			<button
				type='button'
				onClick={handlePreview}
				disabled={disabled}
				className={cn(
					pill,
					previewActive ? 'bg-primary hover:bg-primary/80 text-primary-foreground' : '',
				)}
				title={t('pptx.animations.previewTooltip')}
			>
				<LuPlay className={ic} />
				{t('pptx.animations.preview')}
			</button>

			{sep}

			{/* Add Animation dropdown */}
			<div className='relative group'>
				<button
					type='button'
					disabled={disabled}
					className={pill}
					title={t('pptx.animations.addTooltip')}
				>
					<LuSparkles className={ic} />
					{t('pptx.animations.addAnimation')}
					<LuChevronDown className='w-3 h-3' />
				</button>
				<div className='absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-44 pt-1'>
					<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
						{ANIMATION_PRESETS.map((group) => (
							<React.Fragment key={group.group}>
								<div className='px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
									{t(`pptx.animations.group.${group.group.toLowerCase()}`)}
								</div>
								{group.items.map((item) => (
									<button
										key={item.value}
										type='button'
										disabled={disabled}
										onClick={() =>
											p.onAddAnimation?.(
												item.value,
												group.group.toLowerCase() as 'entrance' | 'emphasis' | 'exit',
											)
										}
										className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
										title={t('pptx.animations.applyAnimation', {
											name: t(`pptx.animations.preset.${item.value}`),
										})}
									>
										{t(`pptx.animations.preset.${item.value}`)}
									</button>
								))}
							</React.Fragment>
						))}
					</div>
				</div>
			</div>

			{sep}

			{/* Remove Animation */}
			<button
				type='button'
				disabled={disabled}
				onClick={p.onRemoveAnimation}
				className={pill}
				title={t('pptx.animations.removeTooltip')}
			>
				<LuTrash2 className={ic} />
				{t('pptx.animations.remove')}
			</button>

			{sep}

			{/* Animation Panel toggle */}
			<button
				type='button'
				onClick={p.onOpenAnimationPanel ?? p.onToggleInspector}
				className={cn(
					pill,
					p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-primary-foreground' : '',
				)}
				title={t('pptx.animations.openPanelTooltip')}
			>
				<LuPanelRight className={ic} />
				{t('pptx.animations.animationPanel')}
			</button>
		</>
	);
}
