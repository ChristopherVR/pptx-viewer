import type { ShapeStyle } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { EffectToggleCfg } from './fill-stroke-effect-configs';
import { SEL, NUM, RNG, COL2, LBL, safeNum } from './FillStrokeHelpers';
import { useRecentColors } from './RecentColorsContext';

// ---------------------------------------------------------------------------
// EffectField
// ---------------------------------------------------------------------------

/**
 * Render fields for a togglable effect (shadow, glow, reflection, etc.).
 *
 * Extracted out of `FillStrokeSubComponents` to keep that file inside the
 * per-file line budget; markup and behaviour are unchanged. The `color`
 * branch pushes into the shared "Recent colours" list on commit, same as
 * every other colour picker in the inspector.
 */
export function EffectField({
	field,
	style,
	onUpdate,
}: {
	field: EffectToggleCfg['fields'][number];
	style: ShapeStyle | undefined;
	onUpdate: (u: Partial<ShapeStyle>) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();
	const fieldLabel = field.i18nKey ? t(field.i18nKey) : field.label;
	const val = field.read(style);
	const cls = `flex flex-col gap-1 ${field.span2 ? COL2 : ''}`;
	if (field.type === 'select' && field.options) {
		return (
			<label className={cls}>
				<span className={LBL}>{fieldLabel}</span>
				<select
					aria-label={fieldLabel}
					value={String(val)}
					onChange={(e) => {
						const result = field.write(e.target.value, style);
						onUpdate(typeof result === 'function' ? result(style) : result);
					}}
					className={SEL}
				>
					{field.options.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</label>
		);
	}
	if (field.type === 'color') {
		return (
			<label className={cls}>
				<span className={LBL}>{fieldLabel}</span>
				<input
					type='color'
					value={String(val)}
					onChange={(e) => {
						const result = field.write(e.target.value, style);
						onUpdate(typeof result === 'function' ? result(style) : result);
						pushColor(e.target.value);
					}}
					className={`h-8 ${SEL} px-1`}
				/>
			</label>
		);
	}
	if (field.type === 'checkbox') {
		return (
			<label className={`flex items-center gap-2 ${field.span2 ? COL2 : ''}`}>
				<input
					type='checkbox'
					checked={Boolean(val)}
					onChange={(e) => {
						const result = field.write(e.target.checked, style);
						onUpdate(typeof result === 'function' ? result(style) : result);
					}}
					className='h-4 w-4'
				/>
				<span className={LBL}>{fieldLabel}</span>
			</label>
		);
	}
	if (field.type === 'range') {
		return (
			<label className={cls}>
				<span className={LBL}>{fieldLabel}</span>
				<input
					type='range'
					min={field.min ?? 0}
					max={field.max ?? 100}
					value={Number(val)}
					onChange={(e) => {
						const result = field.write(Number(e.target.value), style);
						onUpdate(typeof result === 'function' ? result(style) : result);
					}}
					className={RNG}
				/>
			</label>
		);
	}
	return (
		<label className={cls}>
			<span className={LBL}>{fieldLabel}</span>
			<input
				type='number'
				min={field.min}
				max={field.max}
				step={field.step}
				value={Number(val)}
				onChange={(e) => {
					const n = safeNum(e.target.value, Number(val));
					const result = field.write(n, style);
					onUpdate(typeof result === 'function' ? result(style) : result);
				}}
				className={NUM}
			/>
		</label>
	);
}
