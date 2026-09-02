import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuPipette } from 'react-icons/lu';

import { THEME_COLOR_SWATCHES } from '../../constants';
import { normalizeHexColor, openNativeEyeDropper } from '../../utils';
import { SEL, RNG, SWATCH, DIS, LBL, COL2 } from './FillStrokeHelpers';
import type { GradientStop } from './FillStrokeHelpers';
import { useRecentColors } from './RecentColorsContext';
import { RecentColorsRow } from './RecentColorsRow';

// ---------------------------------------------------------------------------
// SelectRow
// ---------------------------------------------------------------------------

/** Render a simple <select> row. */
export function SelectRow({
	label,
	value,
	span2,
	options,
	onChange,
}: {
	label: string;
	value: string;
	span2?: boolean;
	options: readonly { value: string; label: string; i18nKey?: string }[];
	onChange: (v: string) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<label className={`flex flex-col gap-1 ${span2 ? COL2 : ''}`}>
			<span className={LBL}>{label}</span>
			<select
				aria-label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={SEL}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.i18nKey ? t(o.i18nKey) : o.label}
					</option>
				))}
			</select>
		</label>
	);
}

// ---------------------------------------------------------------------------
// ColorPickerRow
// ---------------------------------------------------------------------------

/**
 * Color picker + theme swatches + recent colors + eyedropper.
 *
 * The recent-colours row is sourced from {@link useRecentColors} (context),
 * not a prop: every caller used to have to thread its own `recentColors`
 * array down from the loaded deck, and one of the two calls (the fill
 * colour's own row) simply never did, so its row silently rendered nothing.
 * Every commit here (typed colour, theme swatch, recent swatch, eyedropper)
 * also pushes the pick back into that same shared list.
 */
export function ColorPickerRow({
	label,
	value,
	disabled,
	prefix,
	onChange,
}: {
	label: string;
	value: string;
	disabled?: boolean;
	prefix: string;
	onChange: (c: string) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();
	const commit = (color: string): void => {
		onChange(color);
		pushColor(color);
	};
	const handleEyedropper = async (): Promise<void> => {
		const color = await openNativeEyeDropper();
		if (color) {
			commit(color);
		}
	};

	return (
		<label className='flex flex-col gap-1'>
			<span className={LBL}>{label}</span>
			<div className='flex items-center gap-1'>
				<input
					type='color'
					value={value}
					disabled={disabled}
					onChange={(e) => commit(e.target.value)}
					className={`h-8 flex-1 ${SEL} px-1 ${DIS}`}
				/>
				<button
					type='button'
					disabled={disabled}
					className='h-8 w-8 flex items-center justify-center rounded border border-border bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
					title={t('pptx.fillStroke.eyedropperTooltip')}
					onClick={(e) => {
						e.preventDefault();
						void handleEyedropper();
					}}
				>
					<LuPipette className='w-3.5 h-3.5' />
				</button>
			</div>
			<div className='mt-1 flex flex-wrap gap-1'>
				{THEME_COLOR_SWATCHES.map((c) => (
					<button
						key={`${prefix}-theme-${c}`}
						type='button'
						className={`${SWATCH} ${DIS}`}
						style={{ backgroundColor: c }}
						title={`${label} ${c}`}
						aria-label={`${label} ${c}`}
						data-pptx-compact
						disabled={disabled}
						onClick={() => commit(c)}
					/>
				))}
			</div>
			<RecentColorsRow prefix={prefix} disabled={disabled} onCommit={commit} />
		</label>
	);
}

// ---------------------------------------------------------------------------
// GradientStopRow
// ---------------------------------------------------------------------------

/** A single gradient stop row. */
export function GradientStopRow({
	stop,
	index,
	total,
	onUpdate,
	allStops,
}: {
	stop: GradientStop;
	index: number;
	total: number;
	onUpdate: (stops: GradientStop[]) => void;
	allStops: GradientStop[];
}): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();
	const patchStop = (patch: Partial<GradientStop>): void => {
		const next = allStops.map((s, i) => (i === index ? { ...s, ...patch } : s));
		onUpdate(next);
	};
	return (
		<div className='space-y-1'>
			<div className='grid grid-cols-[auto,1fr,auto] items-center gap-2'>
				<input
					type='color'
					value={normalizeHexColor(stop.color, '#3b82f6')}
					onChange={(e) => {
						const hex = normalizeHexColor(e.target.value, '#3b82f6');
						patchStop({ color: hex });
						pushColor(hex);
					}}
					className='h-7 w-10 rounded border border-border bg-muted'
				/>
				<input
					type='range'
					min={0}
					max={100}
					value={Math.round(stop.position)}
					onChange={(e) => patchStop({ position: Number(e.target.value) })}
					className={RNG}
				/>
				<button
					type='button'
					disabled={total <= 2}
					className='rounded bg-muted px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed'
					onClick={() => onUpdate(allStops.filter((_, i) => i !== index))}
				>
					{t('pptx.comments.remove')}
				</button>
			</div>
			<div className='grid grid-cols-[auto,1fr,auto] items-center gap-2 pl-1'>
				<span className='text-[10px] text-muted-foreground w-10 text-center'>Opacity</span>
				<input
					type='range'
					min={0}
					max={100}
					value={Math.round((stop.opacity ?? 1) * 100)}
					onChange={(e) => patchStop({ opacity: Number(e.target.value) / 100 })}
					className={RNG}
				/>
				<span className='text-[10px] text-muted-foreground w-[52px] text-right'>
					{Math.round((stop.opacity ?? 1) * 100)}%
				</span>
			</div>
		</div>
	);
}

// EffectField was extracted to `./EffectField` to keep this file inside the
// per-file line budget; re-exported here so existing imports keep working.
export { EffectField } from './EffectField';
