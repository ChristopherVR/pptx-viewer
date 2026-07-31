import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetIdForPath,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SELECT_CLS } from './animation-panel-constants';

export interface MotionPathRowProps {
	/** The path currently applied to the selected element, if any. */
	motionPath: string | undefined;
	canEdit: boolean;
	/** Receives a catalogue preset id, or `'none'` to clear the path. */
	onChange: (presetId: string) => void;
}

/**
 * The animation panel's motion-path row: pick a catalogue path, clear it, or
 * see that the applied path was hand-dragged.
 *
 * A dragged path no longer matches any catalogue entry, so it is surfaced as a
 * selected "Custom Path" option rather than silently snapping the select back
 * to the preset it started from (which would misreport what will play).
 */
export function MotionPathRow({
	motionPath,
	canEdit,
	onChange,
}: MotionPathRowProps): React.ReactElement {
	const { t } = useTranslation();
	const presetId = motionPathPresetIdForPath(motionPath);
	const isCustom = Boolean(motionPath) && !presetId;

	return (
		<label className='flex flex-col gap-1'>
			<span className='text-muted-foreground text-[11px]'>
				{t('pptx.animation.motionPath.label')}
			</span>
			<select
				value={isCustom ? 'custom' : (presetId ?? 'none')}
				onChange={(event) => onChange(event.target.value)}
				disabled={!canEdit}
				className={SELECT_CLS}
			>
				<option value='none'>{t('pptx.animation.motionPath.none')}</option>
				{isCustom && <option value='custom'>{t('pptx.animation.motionPath.custom')}</option>}
				{MOTION_PATH_FAMILIES.map((family) => (
					<optgroup key={family} label={t(motionPathFamilyLabelKey(family))}>
						{motionPathPresetsByFamily(family).map((preset) => (
							<option key={preset.id} value={preset.id}>
								{t(motionPathPresetLabelKey(preset.id))}
							</option>
						))}
					</optgroup>
				))}
			</select>
			{motionPath && (
				<span className='text-[10px] text-muted-foreground'>
					{t('pptx.animation.motionPath.editHint')}
				</span>
			)}
		</label>
	);
}
