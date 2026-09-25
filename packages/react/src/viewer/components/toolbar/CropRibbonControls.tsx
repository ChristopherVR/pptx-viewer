import type { CropAspectGroup } from 'pptx-viewer-shared';
import {
	CROP_ASPECT_GROUP_LABEL_KEYS,
	CROP_ASPECT_LABEL_KEY,
	CROP_ASPECT_PRESETS,
	CROP_FILL_LABEL_KEY,
	CROP_FIT_LABEL_KEY,
	CROP_LABEL_KEY,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuCrop } from 'react-icons/lu';

import { cn } from '../../utils';
import { useShapeFormatContext } from '../shape-format-context';
import { RibbonMenu } from './RibbonMenu';
import { gB, gL, grp, ic } from './toolbar-constants';
import {
	RIBBON_MENU_ITEM_CLASS,
	RIBBON_MENU_SURFACE_CLASS,
	useRibbonDropdown,
} from './useRibbonDropdown';

const GROUPS: readonly CropAspectGroup[] = ['square', 'portrait', 'landscape'];

export interface CropRibbonControlsProps {
	canEdit: boolean;
}

/**
 * Home > Arrange > Crop: the toggle that enters / commits on-canvas crop mode,
 * plus its dropdown (Crop to Aspect Ratio presets, Fill, Fit). Enabled for a
 * single croppable picture on an editable deck.
 */
export function CropRibbonControls({ canEdit }: CropRibbonControlsProps): React.ReactElement {
	const { t } = useTranslation();
	const crop = useShapeFormatContext()?.crop;
	const { open, setOpen, ref } = useRibbonDropdown();
	const enabled = canEdit && Boolean(crop?.canCrop);
	const active = Boolean(crop?.element);
	const label = t(CROP_LABEL_KEY);
	const hint = t('pptx.image.cropHint');
	const run = (action: () => void) => {
		setOpen(false);
		action();
	};
	return (
		<div className='relative' ref={ref}>
			<div className={grp}>
				<button
					type='button'
					data-pptx-ribbon-control='crop'
					aria-label={label}
					aria-pressed={active}
					title={enabled ? label : hint}
					disabled={!enabled}
					className={cn(gB, active && 'bg-accent text-accent-foreground')}
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => crop?.toggle()}
				>
					<LuCrop className={ic} />
				</button>
				<button
					type='button'
					data-pptx-ribbon-control='crop-menu'
					aria-label={t(CROP_ASPECT_LABEL_KEY)}
					aria-haspopup='menu'
					aria-expanded={open && enabled}
					title={enabled ? t(CROP_ASPECT_LABEL_KEY) : hint}
					disabled={!enabled}
					className={gL}
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => setOpen((v) => !v)}
				>
					<LuChevronDown className='w-3 h-3' />
				</button>
			</div>
			{open && enabled && crop && (
				<RibbonMenu anchorRef={ref} className='pt-1'>
					<div role='menu' aria-label={label} className={RIBBON_MENU_SURFACE_CLASS}>
						{GROUPS.map((group) => (
							<div key={group} role='group' aria-label={t(CROP_ASPECT_GROUP_LABEL_KEYS[group])}>
								<div
									aria-hidden='true'
									className='px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-muted-foreground'
								>
									{t(CROP_ASPECT_GROUP_LABEL_KEYS[group])}
								</div>
								{CROP_ASPECT_PRESETS.filter((preset) => preset.group === group).map((preset) => (
									<button
										key={preset.id}
										type='button'
										role='menuitem'
										data-pptx-crop-aspect={preset.id}
										className={RIBBON_MENU_ITEM_CLASS}
										onMouseDown={(e) => e.preventDefault()}
										onClick={() =>
											run(() => crop.cropToAspect(preset.ratioWidth, preset.ratioHeight))
										}
									>
										{preset.id}
									</button>
								))}
							</div>
						))}
						<hr className='my-1 border-0 h-px bg-border' />
						<button
							type='button'
							role='menuitem'
							data-pptx-crop-action='fill'
							className={RIBBON_MENU_ITEM_CLASS}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => run(crop.fill)}
						>
							{t(CROP_FILL_LABEL_KEY)}
						</button>
						<button
							type='button'
							role='menuitem'
							data-pptx-crop-action='fit'
							className={RIBBON_MENU_ITEM_CLASS}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => run(crop.fit)}
						>
							{t(CROP_FIT_LABEL_KEY)}
						</button>
					</div>
				</RibbonMenu>
			)}
		</div>
	);
}
