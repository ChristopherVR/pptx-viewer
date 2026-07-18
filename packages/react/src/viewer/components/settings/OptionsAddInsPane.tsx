import type { ViewerAddinRow, ViewerAddinStatus } from 'pptx-viewer-shared';
import { resolveViewerAddinRows } from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';

export interface OptionsAddInsPaneProps {
	/** Host-supplied availability flags; unset ids default to active. */
	addinStatus?: ViewerAddinStatus;
}

function AddinTable({
	title,
	rows,
	selectedId,
	onSelect,
}: {
	title: string;
	rows: ViewerAddinRow[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<section>
			<h4 className='mb-1 text-xs font-semibold text-foreground'>{title}</h4>
			{rows.length === 0 ? (
				<p className='px-2 py-1 text-xs italic text-muted-foreground'>
					{t('pptx.options.addIns.description')}
				</p>
			) : (
				<table className='w-full border-collapse text-left'>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.id}
								onClick={() => onSelect(row.id)}
								className={cn(
									'cursor-pointer border-b border-border/40 transition-colors',
									selectedId === row.id ? 'bg-primary/10' : 'hover:bg-accent',
								)}
							>
								<td className='px-2 py-1.5 text-xs text-foreground'>{t(row.nameKey)}</td>
								<td className='px-2 py-1.5 font-mono text-[11px] text-muted-foreground'>
									{row.location}
								</td>
								<td className='px-2 py-1.5 text-xs text-muted-foreground'>
									{t(`pptx.options.addInType.${row.type}`)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</section>
	);
}

/**
 * Options > Add-ins: the viewer's optional capability modules presented like
 * PowerPoint's add-in inventory (grouped active/inactive, details for the
 * selected row).
 */
export function OptionsAddInsPane({ addinStatus }: OptionsAddInsPaneProps): React.ReactElement {
	const { t } = useTranslation();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const rows = resolveViewerAddinRows(addinStatus);
	const active = rows.filter((row) => row.active);
	const inactive = rows.filter((row) => !row.active);
	const selected = rows.find((row) => row.id === selectedId);

	return (
		<div className='space-y-4'>
			<div className='grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-border pb-1 pl-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
				<span>{t('pptx.options.addIns.name')}</span>
				<span>{t('pptx.options.addIns.location')}</span>
				<span>{t('pptx.options.addIns.type')}</span>
			</div>
			<AddinTable
				title={t('pptx.options.addIns.active')}
				rows={active}
				selectedId={selectedId}
				onSelect={setSelectedId}
			/>
			<AddinTable
				title={t('pptx.options.addIns.inactive')}
				rows={inactive}
				selectedId={selectedId}
				onSelect={setSelectedId}
			/>
			{selected && (
				<div className='rounded border border-border/60 bg-muted/40 p-3'>
					<p className='text-xs font-semibold text-foreground'>{t(selected.nameKey)}</p>
					<p className='mt-1 text-xs text-muted-foreground'>{t(selected.descriptionKey)}</p>
					<p className='mt-1 font-mono text-[11px] text-muted-foreground'>{selected.location}</p>
				</div>
			)}
		</div>
	);
}
