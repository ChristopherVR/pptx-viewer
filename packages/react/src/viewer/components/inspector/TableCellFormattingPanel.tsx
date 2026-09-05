import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TableCellEditorState } from '../../types';
import { cn, normalizeHexColor } from '../../utils';
import { DebouncedColorInput } from './DebouncedColorInput';
import { HEADING, CARD, INPUT, BTN } from './inspector-pane-constants';
import {
	computeMergeCellRight,
	computeMergeCellDown,
	computeSplitCell,
} from './table-cell-merge-helpers';
import { TableCellAdvancedFill } from './TableCellAdvancedFill';
import { TableCellColorField } from './TableCellColorField';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TableCellFormattingPanelProps {
	tableData: PptxTableData;
	tableEditorState: TableCellEditorState;
	canEdit: boolean;
	onUpdateTableData: (patch: Partial<PptxTableData>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TableCellFormattingPanel({
	tableData: td,
	tableEditorState,
	canEdit,
	onUpdateTableData,
}: TableCellFormattingPanelProps): React.ReactElement | null {
	const { t } = useTranslation();
	const { rowIndex, columnIndex } = tableEditorState;
	const cell = td.rows[rowIndex]?.cells[columnIndex];
	if (!cell) {
		return null;
	}
	const cs: PptxTableCellStyle = cell.style ?? {};

	const updateCellStyle = (updates: Partial<PptxTableCellStyle>) => {
		const newRows = td.rows.map((row, ri) => {
			if (ri !== rowIndex) {
				return row;
			}
			return {
				...row,
				cells: row.cells.map((c, ci) => {
					if (ci !== columnIndex) {
						return c;
					}
					return { ...c, style: { ...cs, ...updates } };
				}),
			};
		});
		onUpdateTableData({ rows: newRows });
	};

	return (
		<div className={CARD}>
			<div className={HEADING}>
				{t('pptx.table.cell', { row: rowIndex + 1, col: columnIndex + 1 })}
			</div>
			<div className='space-y-2'>
				{/* Font Size */}
				<label className='flex items-center gap-2 text-[11px]'>
					<span className='w-10 text-muted-foreground'>{t('pptx.table.fontSize')}</span>
					<input
						type='number'
						disabled={!canEdit}
						className={INPUT}
						min={6}
						max={200}
						value={cs.fontSize ?? 14}
						onChange={(e) => updateCellStyle({ fontSize: Number(e.target.value) })}
					/>
				</label>

				{/* Colors */}
				<div className='grid grid-cols-2 gap-1.5'>
					<TableCellColorField
						label={t('pptx.table.color')}
						prefix='table-cell-text'
						value={cs.color}
						fallback='#000000'
						selectedRef={cs.colorRef}
						disabled={!canEdit}
						onCommit={(hex, ref) => updateCellStyle({ color: hex, colorRef: ref })}
					/>
					<TableCellColorField
						label={t('pptx.table.background')}
						prefix='table-cell-bg'
						value={cs.backgroundColor}
						fallback='#ffffff'
						selectedRef={cs.backgroundColorRef}
						disabled={!canEdit}
						onCommit={(hex, ref) =>
							updateCellStyle({ backgroundColor: hex, backgroundColorRef: ref })
						}
					/>
				</div>

				{/* Advanced Cell Fill & Margins */}
				<TableCellAdvancedFill
					cellStyle={cs}
					canEdit={canEdit}
					onUpdateCellStyle={updateCellStyle}
				/>

				{/* Bold / Italic / Underline */}
				<div className='flex gap-1'>
					{(
						[
							['bold', 'B', 'font-bold'],
							['italic', 'I', 'italic'],
							['underline', 'U', 'underline'],
						] as const
					).map(([key, lbl, cls]) => (
						<button
							key={key}
							type='button'
							disabled={!canEdit}
							className={cn(
								'px-2 py-1 rounded text-[11px] transition-colors',
								cls,
								cs[key] ? 'bg-primary text-white' : 'bg-muted hover:bg-accent',
							)}
							onClick={() => updateCellStyle({ [key]: !cs[key] })}
						>
							{lbl}
						</button>
					))}
				</div>

				{/* Horizontal Alignment */}
				<div className='flex gap-1'>
					{(
						[
							['left', 'L'],
							['center', 'C'],
							['right', 'R'],
						] as const
					).map(([val, lbl]) => (
						<button
							key={val}
							type='button'
							disabled={!canEdit}
							className={cn(
								'px-2 py-1 rounded text-[11px] transition-colors',
								cs.align === val ? 'bg-primary text-white' : 'bg-muted hover:bg-accent',
							)}
							onClick={() => updateCellStyle({ align: val })}
						>
							{lbl}
						</button>
					))}
				</div>

				{/* Vertical Alignment */}
				<div className='flex gap-1'>
					{(
						[
							['top', 'T'],
							['middle', 'M'],
							['bottom', 'B'],
						] as const
					).map(([val, lbl]) => (
						<button
							key={val}
							type='button'
							disabled={!canEdit}
							className={cn(
								'px-2 py-1 rounded text-[11px] transition-colors',
								cs.vAlign === val ? 'bg-primary text-white' : 'bg-muted hover:bg-accent',
							)}
							onClick={() => updateCellStyle({ vAlign: val })}
						>
							{lbl}
						</button>
					))}
				</div>

				{/* Cell Borders */}
				<div className='space-y-1.5'>
					<span className='text-muted-foreground text-[11px]'>{t('pptx.table.cellBorders')}</span>
					<div className='grid grid-cols-2 gap-1.5'>
						{(
							[
								['Top', 'borderTopColor', 'borderTopWidth'],
								['Bottom', 'borderBottomColor', 'borderBottomWidth'],
								['Left', 'borderLeftColor', 'borderLeftWidth'],
								['Right', 'borderRightColor', 'borderRightWidth'],
							] as const
						).map(([edge, colorKey, widthKey]) => (
							<div key={edge} className='flex flex-col gap-0.5'>
								<span className='text-[10px] text-muted-foreground'>
									{t(`pptx.table.border${edge}`)}
								</span>
								<div className='flex gap-1 items-center'>
									<DebouncedColorInput
										disabled={!canEdit}
										value={normalizeHexColor(cs[colorKey] as string | undefined, '#374151')}
										className='w-7 h-6 rounded border border-border bg-transparent cursor-pointer shrink-0'
										onCommit={(hex) => updateCellStyle({ [colorKey]: hex })}
									/>
									<input
										type='number'
										disabled={!canEdit}
										className={cn(INPUT, 'w-14')}
										min={0}
										max={10}
										value={(cs[widthKey] as number | undefined) ?? 1}
										onChange={(e) => updateCellStyle({ [widthKey]: Number(e.target.value) })}
									/>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Merge / Split */}
				<div className='grid grid-cols-3 gap-1'>
					<button
						type='button'
						disabled={!canEdit}
						className={cn(BTN, 'text-center')}
						onClick={() => {
							const newRows = computeMergeCellRight(td, rowIndex, columnIndex);
							if (newRows) {
								onUpdateTableData({ rows: newRows });
							}
						}}
					>
						{t('pptx.table.mergeRight')}
					</button>
					<button
						type='button'
						disabled={!canEdit}
						className={cn(BTN, 'text-center')}
						onClick={() => {
							const newRows = computeMergeCellDown(td, rowIndex, columnIndex);
							if (newRows) {
								onUpdateTableData({ rows: newRows });
							}
						}}
					>
						{t('pptx.table.mergeDown')}
					</button>
					<button
						type='button'
						disabled={!canEdit}
						className={cn(BTN, 'text-center')}
						onClick={() => {
							const newRows = computeSplitCell(td, rowIndex, columnIndex);
							if (newRows) {
								onUpdateTableData({ rows: newRows });
							}
						}}
					>
						{t('pptx.table.split')}
					</button>
				</div>
			</div>
		</div>
	);
}
