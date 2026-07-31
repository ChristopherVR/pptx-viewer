import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { FILL_PATTERN_LABEL_KEYS, schemaLabel } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { LBL, PATTERN_OPTIONS, SEL } from './table-cell-advanced-fill-constants';

/**
 * Pattern-fill sub-controls for a table cell (`a:pattFill`).
 *
 * Lifted out of `TableCellAdvancedFill` to keep that file inside the per-file
 * line budget; markup and behaviour are unchanged.
 *
 * `PATTERN_OPTIONS` is the bare `@prst` token list, so the preset select used to
 * offer the user a choice between `ltHorz` and `narVert`. The option VALUE is
 * still that token (it is written straight to `patternFillPreset`); only the
 * visible text is resolved through the shared catalogue, which means the option
 * set is byte-for-byte the same as before.
 */
export interface TableCellPatternFillProps {
	cellStyle: PptxTableCellStyle;
	canEdit: boolean;
	onUpdateCellStyle: (updates: Partial<PptxTableCellStyle>) => void;
}

export function TableCellPatternFill({
	cellStyle,
	canEdit,
	onUpdateCellStyle,
}: TableCellPatternFillProps): React.ReactElement {
	const { t } = useTranslation();
	// `schemaLabel` takes a plain `(key) => string`; react-i18next's `t` is an
	// overloaded generic, so narrow it once here.
	const translate = (key: string): string => t(key);

	return (
		<div className='space-y-1.5'>
			<label className='flex flex-col gap-0.5'>
				<span className={LBL}>{t('pptx.table.patternPreset')}</span>
				<select
					disabled={!canEdit}
					className={SEL}
					value={cellStyle.patternFillPreset ?? 'ltDnDiag'}
					onChange={(e) => onUpdateCellStyle({ patternFillPreset: e.target.value })}
				>
					{PATTERN_OPTIONS.map((p) => (
						<option key={p} value={p}>
							{schemaLabel(FILL_PATTERN_LABEL_KEYS, p, translate)}
						</option>
					))}
				</select>
			</label>
			<div className='grid grid-cols-2 gap-1.5'>
				<label className='flex flex-col gap-0.5'>
					<span className={LBL}>{t('pptx.table.patternForeground')}</span>
					<input
						type='color'
						disabled={!canEdit}
						className='w-full h-7 rounded border border-border bg-transparent cursor-pointer'
						value={cellStyle.patternFillForeground ?? '#000000'}
						onChange={(e) => onUpdateCellStyle({ patternFillForeground: e.target.value })}
					/>
				</label>
				<label className='flex flex-col gap-0.5'>
					<span className={LBL}>{t('pptx.table.patternBackground')}</span>
					<input
						type='color'
						disabled={!canEdit}
						className='w-full h-7 rounded border border-border bg-transparent cursor-pointer'
						value={cellStyle.patternFillBackground ?? '#FFFFFF'}
						onChange={(e) => onUpdateCellStyle({ patternFillBackground: e.target.value })}
					/>
				</label>
			</div>
		</div>
	);
}
