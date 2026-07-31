import type { PptxAnimationPreset } from 'pptx-viewer-core';
import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from 'pptx-viewer-shared';
import type { AnimationGroup } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuStar } from 'react-icons/lu';

/** One gallery column: a bucket's label plus the presets that belong to it. */
interface PresetCategory {
	group: AnimationGroup;
	labelKey: string;
	tone: string;
	presets: readonly PptxAnimationPreset[];
}

/**
 * The whole shared catalogue, not a sample of it.
 *
 * The ribbon used to hard-code six presets while `pptx-viewer-shared` already
 * published twenty-seven, so twenty-one effects the editor can actually apply
 * were reachable only from the inspector. Sourcing the buttons from the shared
 * arrays keeps every binding's gallery identical by construction, and keeps a
 * preset added to the catalogue from needing five separate follow-ups.
 *
 * Order is the catalogue's own, which already leads each bucket with the
 * effects PowerPoint puts first (Appear / Fade In / Fly In, Spin / Pulse,
 * Fade Out), so the previously featured six still read as the primary set
 * without being rendered twice.
 */
const CATEGORIES: readonly PresetCategory[] = [
	{
		group: 'entrance',
		labelKey: 'pptx.animation.entrance',
		tone: 'text-emerald-500',
		presets: ENTRANCE_PRESET_VALUES,
	},
	{
		group: 'emphasis',
		labelKey: 'pptx.animation.emphasis',
		tone: 'text-amber-500',
		presets: EMPHASIS_PRESET_VALUES,
	},
	{
		group: 'exit',
		labelKey: 'pptx.animation.exit',
		tone: 'text-red-500',
		presets: EXIT_PRESET_VALUES,
	},
];

export interface AnimationPresetGalleryProps {
	disabled: boolean;
	onAddAnimation?: (preset: string, group: AnimationGroup) => void;
}

/**
 * The Animations tab's preset gallery.
 *
 * Every preset is a real button in the accessibility tree rather than an entry
 * behind a hover menu: a gallery a screen-reader user cannot enumerate is a
 * gallery they do not have. The column scrolls instead of growing so the
 * ribbon keeps the single-row height the layout-parity spec guards.
 */
export function AnimationPresetGallery({
	disabled,
	onAddAnimation,
}: AnimationPresetGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div
			className='flex max-h-[62px] items-start gap-2 overflow-y-auto rounded-sm border border-border/60 bg-muted/30 px-1.5 py-1'
			aria-label={t('pptx.animations.galleryAria')}
		>
			{CATEGORIES.map((category) => (
				<div key={category.group} className='flex flex-col gap-0.5'>
					<span className='text-[9px] font-semibold leading-3 text-muted-foreground'>
						{t(category.labelKey)}
					</span>
					<div className='flex max-w-[150px] flex-wrap gap-0.5'>
						{category.presets.map((preset) => {
							const label = t(`pptx.animation.preset.${preset}`);
							return (
								<button
									key={preset}
									type='button'
									disabled={disabled}
									onClick={() => onAddAnimation?.(preset, category.group)}
									title={label}
									className='inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] leading-3 text-foreground transition-colors hover:bg-accent disabled:opacity-35'
								>
									<LuStar
										className={`h-2.5 w-2.5 fill-current ${category.tone}`}
										aria-hidden='true'
									/>
									<span className='whitespace-nowrap'>{label}</span>
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
