import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { TableStyleBorderSide, TableStyleEditorFieldEdit } from 'pptx-viewer-shared';
import {
	describeTableStyleEditor,
	TABLE_STYLE_BORDER_SIDE_LABEL_KEYS,
	TABLE_STYLE_BORDER_SIDES,
	TABLE_STYLE_DASH_PRESETS,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BTN, HEADING, INPUT } from './inspector-pane-constants';
import { ThemeColorSwatchGrid } from './ThemeColorSwatchGrid';

/** Field editors for whichever part `TableStyleEditor` currently has selected. */
export function TableStyleEditorFields({
	descriptor,
	canEdit,
	onEdit,
}: {
	descriptor: NonNullable<ReturnType<typeof describeTableStyleEditor>>;
	canEdit: boolean;
	onEdit: (edit: TableStyleEditorFieldEdit) => void;
}): React.ReactElement {
	const { t } = useTranslation();

	return (
		<div className='space-y-2'>
			<div className='space-y-1'>
				<div className={HEADING}>{t('pptx.tableStyleEditor.fillSection')}</div>
				<div className='flex items-center gap-2 text-[11px]'>
					<input
						type='color'
						disabled={!canEdit}
						value={descriptor.fill.color.hex}
						onChange={(e) => onEdit({ kind: 'fillColor', hex: e.target.value, ref: undefined })}
						className='h-6 w-8 rounded border border-border bg-transparent cursor-pointer'
					/>
					<label className='flex items-center gap-1'>
						<input
							type='checkbox'
							disabled={!canEdit}
							checked={descriptor.fill.noFill}
							onChange={(e) => onEdit({ kind: 'fillNone', noFill: e.target.checked })}
						/>
						{t('pptx.tableStyleEditor.noFill')}
					</label>
				</div>
				<ThemeColorSwatchGrid
					prefix='table-style-fill'
					disabled={!canEdit}
					selectedRef={descriptor.fill.color.ref}
					selectedHex={descriptor.fill.color.hex}
					onPick={(c) => onEdit({ kind: 'fillColor', hex: c.hex, ref: c.ref })}
				/>
			</div>

			{descriptor.hasTextAndBorders && (
				<>
					<div className='space-y-1'>
						<div className={HEADING}>{t('pptx.tableStyleEditor.textSection')}</div>
						<div className='flex gap-1'>
							{(['bold', 'italic', 'underline'] as const).map((flag) => (
								<button
									key={flag}
									type='button'
									disabled={!canEdit}
									className={`${BTN} ${descriptor.text[flag] ? 'bg-accent' : ''}`}
									onClick={() => onEdit(textFlagEdit(flag, !descriptor.text[flag]))}
								>
									{t(`pptx.format.${flag}`)}
								</button>
							))}
						</div>
						<label className='flex items-center gap-2 text-[11px]'>
							<span>{t('pptx.tableStyleEditor.textColor')}</span>
							<input
								type='color'
								disabled={!canEdit}
								value={descriptor.text.color.hex}
								onChange={(e) => onEdit({ kind: 'textColor', hex: e.target.value, ref: undefined })}
								className='h-6 w-8 rounded border border-border bg-transparent cursor-pointer'
							/>
						</label>
						<ThemeColorSwatchGrid
							prefix='table-style-text'
							disabled={!canEdit}
							selectedRef={descriptor.text.color.ref}
							selectedHex={descriptor.text.color.hex}
							onPick={(c) => onEdit({ kind: 'textColor', hex: c.hex, ref: c.ref })}
						/>
					</div>

					<div className='space-y-1'>
						<div className={HEADING}>{t('pptx.tableStyleEditor.bordersSection')}</div>
						{TABLE_STYLE_BORDER_SIDES.map((side) => (
							<BorderSideRow
								key={side}
								side={side}
								state={descriptor.borders[side]}
								canEdit={canEdit}
								onEdit={onEdit}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function textFlagEdit(
	flag: 'bold' | 'italic' | 'underline',
	value: boolean,
): TableStyleEditorFieldEdit {
	if (flag === 'bold') {
		return { kind: 'textBold', value };
	}
	if (flag === 'italic') {
		return { kind: 'textItalic', value };
	}
	return { kind: 'textUnderline', value };
}

interface BorderSideState {
	color: { hex: string; ref: PptxThemeColorRef | undefined };
	width: number;
	dash: string;
	noFill: boolean;
}

function BorderSideRow({
	side,
	state,
	canEdit,
	onEdit,
}: {
	side: TableStyleBorderSide;
	state: BorderSideState;
	canEdit: boolean;
	onEdit: (edit: TableStyleEditorFieldEdit) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='flex items-center gap-1.5 text-[11px]'>
			<span className='w-28 shrink-0 text-muted-foreground'>
				{t(TABLE_STYLE_BORDER_SIDE_LABEL_KEYS[side])}
			</span>
			<input
				type='color'
				disabled={!canEdit}
				value={state.color.hex}
				onChange={(e) => onEdit({ kind: 'borderColor', side, hex: e.target.value, ref: undefined })}
				className='h-6 w-7 rounded border border-border bg-transparent cursor-pointer'
			/>
			<input
				type='number'
				min={0}
				max={20}
				disabled={!canEdit}
				value={state.width}
				onChange={(e) => onEdit({ kind: 'borderWidth', side, width: Number(e.target.value) })}
				className={`${INPUT} w-12`}
			/>
			<select
				disabled={!canEdit}
				value={state.dash}
				onChange={(e) => onEdit({ kind: 'borderDash', side, dash: e.target.value })}
				className={INPUT}
			>
				{TABLE_STYLE_DASH_PRESETS.map((dash) => (
					<option key={dash} value={dash}>
						{dash}
					</option>
				))}
			</select>
			<label className='flex items-center gap-1 shrink-0'>
				<input
					type='checkbox'
					disabled={!canEdit}
					checked={state.noFill}
					onChange={(e) => onEdit({ kind: 'borderNone', side, noFill: e.target.checked })}
				/>
				{t('pptx.tableStyleEditor.noBorder')}
			</label>
		</div>
	);
}
