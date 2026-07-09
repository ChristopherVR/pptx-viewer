import type {
	PptxCoreProperties,
	PptxAppProperties,
	PptxCustomProperty,
	PptxNotesMaster,
	PptxHandoutMaster,
} from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../../types';
import { cn } from '../../utils';
import { CARD, HEADING, INPUT, BTN } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Info Row (read-only label–value)
// ---------------------------------------------------------------------------

export function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
	return (
		<div className='flex items-center justify-between gap-2'>
			<span>{label}</span>
			<span className='text-muted-foreground'>{value}</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Text Field Row
// ---------------------------------------------------------------------------

function TextFieldRow({
	label,
	disabled,
	value,
	onChange,
}: {
	label: string;
	disabled: boolean;
	value: string;
	onChange: (v: string) => void;
}): React.ReactElement {
	return (
		<label className='flex flex-col gap-1'>
			<span className='text-muted-foreground'>{label}</span>
			<input
				type='text'
				className={INPUT}
				disabled={disabled}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	);
}

// ---------------------------------------------------------------------------
// Custom Properties Block
// ---------------------------------------------------------------------------

function CustomPropertiesBlock({
	customProperties,
	canEdit,
	onUpdate,
}: {
	customProperties: PptxCustomProperty[];
	canEdit: boolean;
	onUpdate: (props: PptxCustomProperty[]) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='space-y-1'>
			<div className='flex items-center justify-between'>
				<span className='text-muted-foreground'>{t('pptx.documentProperties.custom.heading')}</span>
				{canEdit && (
					<button
						type='button'
						className={BTN}
						onClick={() =>
							onUpdate([
								...customProperties,
								{
									name: `Property ${customProperties.length + 1}`,
									value: '',
									type: 'lpwstr',
								},
							])
						}
					>
						{t('pptx.documentProperties.custom.add')}
					</button>
				)}
			</div>
			{customProperties.length === 0 ? (
				<div className='text-[10px] text-muted-foreground'>
					{t('pptx.documentProperties.custom.empty')}
				</div>
			) : (
				customProperties.map((entry, index) => (
					<div key={`${entry.name}-${index}`} className='grid grid-cols-[1fr,1fr,auto] gap-1'>
						<input
							type='text'
							className={INPUT}
							disabled={!canEdit}
							value={entry.name}
							onChange={(e) =>
								onUpdate(
									customProperties.map((c, i) =>
										i === index ? { ...c, name: e.target.value } : c,
									),
								)
							}
						/>
						<input
							type='text'
							className={INPUT}
							disabled={!canEdit}
							value={entry.value}
							onChange={(e) =>
								onUpdate(
									customProperties.map((c, i) =>
										i === index ? { ...c, value: e.target.value } : c,
									),
								)
							}
						/>
						{canEdit && (
							<button
								type='button'
								className={cn(BTN, 'px-1.5 text-red-400 hover:text-red-300')}
								onClick={() => onUpdate(customProperties.filter((_, i) => i !== index))}
							>
								×
							</button>
						)}
					</div>
				))
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Notes & Handout Card
// ---------------------------------------------------------------------------

export function NotesHandoutCard({
	notesCanvasSize,
	notesMaster,
	handoutMaster,
}: {
	notesCanvasSize: CanvasSize | undefined;
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.documentProperties.notesHandoutHeading')}</div>
			<div className='space-y-1 text-[11px] text-muted-foreground'>
				<InfoRow
					label={t('pptx.documentProperties.notesSize')}
					value={
						notesCanvasSize
							? `${notesCanvasSize.width} × ${notesCanvasSize.height}px`
							: t('pptx.digitalSignatures.notAvailable')
					}
				/>
				<InfoRow
					label={t('pptx.master.notesMasterTitle')}
					value={
						notesMaster
							? `${notesMaster.placeholders?.length ?? 0} placeholders`
							: t('pptx.digitalSignatures.notAvailable')
					}
				/>
				<InfoRow
					label={t('pptx.master.handoutMasterTitle')}
					value={
						handoutMaster
							? `${handoutMaster.placeholders?.length ?? 0} placeholders`
							: t('pptx.digitalSignatures.notAvailable')
					}
				/>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Document Properties Card
// ---------------------------------------------------------------------------

export function DocumentPropertiesCard({
	coreProperties,
	appProperties,
	customProperties,
	canEdit,
	onUpdateCoreProperties,
	onUpdateAppProperties,
	onUpdateCustomProperties,
}: {
	coreProperties: PptxCoreProperties | undefined;
	appProperties: PptxAppProperties | undefined;
	customProperties: PptxCustomProperty[];
	canEdit: boolean;
	onUpdateCoreProperties: (patch: Partial<PptxCoreProperties>) => void;
	onUpdateAppProperties: (patch: Partial<PptxAppProperties>) => void;
	onUpdateCustomProperties: (props: PptxCustomProperty[]) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.documentProperties.documentHeading')}</div>
			<div className='space-y-2 text-[11px] text-muted-foreground'>
				<TextFieldRow
					label={t('pptx.properties.titleLabel')}
					disabled={!canEdit}
					value={coreProperties?.title ?? ''}
					onChange={(v) => onUpdateCoreProperties({ title: v })}
				/>
				<TextFieldRow
					label={t('pptx.properties.author')}
					disabled={!canEdit}
					value={coreProperties?.creator ?? ''}
					onChange={(v) => onUpdateCoreProperties({ creator: v })}
				/>
				<TextFieldRow
					label={t('pptx.documentProperties.summary.company')}
					disabled={!canEdit}
					value={appProperties?.company ?? ''}
					onChange={(v) => onUpdateAppProperties({ company: v })}
				/>
				<TextFieldRow
					label={t('pptx.documentProperties.statistics.application')}
					disabled={!canEdit}
					value={appProperties?.application ?? ''}
					onChange={(v) => onUpdateAppProperties({ application: v })}
				/>
				<CustomPropertiesBlock
					customProperties={customProperties}
					canEdit={canEdit}
					onUpdate={onUpdateCustomProperties}
				/>
			</div>
		</div>
	);
}
