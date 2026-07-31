import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuMoveRight } from 'react-icons/lu';

export interface MotionPathGalleryProps {
	disabled: boolean;
	/** Applies a catalogue motion path to the selected element by preset id. */
	onApplyMotionPath?: (presetId: string) => void;
}

/**
 * The Animations tab's motion-path gallery: PowerPoint's Lines / Arcs / Turns /
 * Shapes / Loops families, every path a real button.
 *
 * It is a sibling of the entrance/emphasis/exit gallery rather than a fourth
 * column of it because a motion path is not one of those three buckets: it is
 * geometry that coexists with them on the same animation entry, so mixing it
 * into the preset columns would imply a choice the model does not make.
 */
export function MotionPathGallery({
	disabled,
	onApplyMotionPath,
}: MotionPathGalleryProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div
			className='flex max-h-[62px] items-start gap-2 overflow-y-auto rounded-sm border border-border/60 bg-muted/30 px-1.5 py-1'
			aria-label={t('pptx.animations.motionPathGalleryAria')}
		>
			{MOTION_PATH_FAMILIES.map((family) => (
				<div key={family} className='flex flex-col gap-0.5'>
					<span className='text-[9px] font-semibold leading-3 text-muted-foreground'>
						{t(motionPathFamilyLabelKey(family))}
					</span>
					<div className='flex max-w-[150px] flex-wrap gap-0.5'>
						{motionPathPresetsByFamily(family).map((preset) => {
							const label = t(motionPathPresetLabelKey(preset.id));
							return (
								<button
									key={preset.id}
									type='button'
									disabled={disabled}
									onClick={() => onApplyMotionPath?.(preset.id)}
									title={label}
									className='inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] leading-3 text-foreground transition-colors hover:bg-accent disabled:opacity-35'
								>
									<LuMoveRight className='h-2.5 w-2.5 text-sky-500' aria-hidden='true' />
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
