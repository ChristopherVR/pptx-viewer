import type { PptxElement } from 'pptx-viewer-core';
import React, { useState } from 'react';
import { LuChevronDown, LuPanelRight, LuPlay, LuSparkles, LuTrash2 } from 'react-icons/lu';

import { cn } from '../../utils';
import { ic, pill, sep } from './toolbar-constants';

export interface AnimationsSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	isInspectorPaneOpen: boolean;
	onToggleInspector: () => void;
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
				title='Preview animation on selected element'
			>
				<LuPlay className={ic} />
				Preview
			</button>

			{sep}

			{/* Add Animation dropdown */}
			<div className='relative group'>
				<button
					type='button'
					disabled={disabled}
					className={pill}
					title='Add animation to selected element'
				>
					<LuSparkles className={ic} />
					Add Animation
					<LuChevronDown className='w-3 h-3' />
				</button>
				<div className='absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-44 pt-1'>
					<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
						{ANIMATION_PRESETS.map((group) => (
							<React.Fragment key={group.group}>
								<div className='px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
									{group.group}
								</div>
								{group.items.map((item) => (
									<button
										key={item.value}
										type='button'
										disabled={disabled}
										className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
										title={`Apply ${item.label} animation`}
									>
										{item.label}
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
				className={pill}
				title='Remove animation from selected element'
			>
				<LuTrash2 className={ic} />
				Remove
			</button>

			{sep}

			{/* Animation Panel toggle */}
			<button
				type='button'
				onClick={p.onToggleInspector}
				className={cn(
					pill,
					p.isInspectorPaneOpen ? 'bg-primary hover:bg-primary/80 text-primary-foreground' : '',
				)}
				title='Open Animation Panel in Inspector'
			>
				<LuPanelRight className={ic} />
				Animation Panel
			</button>
		</>
	);
}
