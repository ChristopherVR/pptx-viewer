import { INSERT_CHART_TYPES, DEFAULT_INSERT_CHART_KIND } from 'pptx-viewer-shared';
import type { FreeformToolKind, InsertChartKind } from 'pptx-viewer-shared';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuChevronDown,
	LuDatabase,
	LuImage,
	LuLayers,
	LuSquare,
	LuType,
	LuVideo,
} from 'react-icons/lu';

import { SHAPE_PRESETS, ACTION_BUTTON_PRESETS } from '../../constants';
import type { SupportedShapeType } from '../../types';
import { cn } from '../../utils';
import { DateTimeFieldDialog } from './DateTimeFieldDialog';
import { FreeformToolButtons } from './FreeformToolButtons';
import { InsertHyperlinkButton } from './InsertHyperlinkButton';
import { controlAttr, RibbonGroupScope } from './PowerPointRibbonControls';
import { RibbonMenu } from './RibbonMenu';
import { grp, ic, pill } from './toolbar-constants';

export interface InsertSectionProps {
	canEdit: boolean;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	/** The armed Freeform: Shape / Curve tool, or null. */
	activeFreeformTool?: FreeformToolKind | null;
	/** Arm (or, with null, disarm) a Freeform: Shape / Curve tool. */
	onArmFreeformTool?: (tool: FreeformToolKind | null) => void;
	onAddTextBox: () => void;
	onAddShape: () => void;
	onAddTable: () => void;
	onAddChart?: (chartKind: InsertChartKind) => void;
	onAddSmartArt: () => void;
	onAddEquation: () => void;
	onAddActionButton: (shapeType: string) => void;
	onInsertField?: (fieldType: string, value?: string) => void;
	onOpenHeaderFooter?: () => void;
	onOpenImagePicker: () => void;
	onOpenMediaPicker: () => void;
	/** True when something is selected, so a link has a target to attach to. */
	hasSelection: boolean;
	onOpenHyperlinkDialog: () => void;
}

export function InsertSection(p: InsertSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { canEdit } = p;
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [newChartKind, setNewChartKind] = useState<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
	const actionMenuRef = useRef<HTMLDivElement>(null);
	const fieldMenuRef = useRef<HTMLDivElement>(null);

	const openDatePicker = () => setDatePickerOpen(true);

	return (
		<>
			<RibbonGroupScope id='insert.text'>
				<button
					onClick={p.onAddTextBox}
					disabled={!canEdit}
					className={pill}
					title={t('pptx.insert.addTextBox')}
					{...controlAttr('insert.text.textBox')}
				>
					<LuType className={ic} />
					{t('pptx.ribbon.textBox')}
				</button>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.illustrations'>
				<div className={grp} {...controlAttr('insert.illustrations.shapes')}>
					<select
						value={p.newShapeType}
						onChange={(e) => p.onSetNewShapeType(e.target.value as SupportedShapeType)}
						className='bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs'
						title={t('pptx.insert.shapeType')}
					>
						{SHAPE_PRESETS.map((sp) => (
							<option key={sp.type} value={sp.type} className='bg-background'>
								{t(sp.i18nKey)}
							</option>
						))}
					</select>
					<button
						onClick={p.onAddShape}
						disabled={!canEdit}
						className='inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs'
						title={t('pptx.insert.addShape')}
					>
						{SHAPE_PRESETS.find((sp) => sp.type === p.newShapeType)?.icon || (
							<LuSquare className={ic} />
						)}
						{t('pptx.insert.shape')}
					</button>
				</div>
				{p.onArmFreeformTool && (
					<FreeformToolButtons
						canEdit={canEdit}
						activeTool={p.activeFreeformTool}
						onArm={p.onArmFreeformTool}
					/>
				)}
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.images'>
				<button
					onClick={p.onOpenImagePicker}
					disabled={!canEdit}
					className={pill}
					title={t('pptx.ribbon.insertImage')}
					{...controlAttr('insert.images.pictures')}
				>
					<LuImage className={ic} />
					{t('pptx.ribbon.image')}
				</button>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.media'>
				<button
					onClick={p.onOpenMediaPicker}
					disabled={!canEdit}
					className={pill}
					title={t('pptx.ribbon.insertMedia')}
					{...controlAttr('insert.media.media')}
				>
					<LuVideo className={ic} />
					{t('pptx.ribbon.media')}
				</button>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.tables'>
				<button
					onClick={p.onAddTable}
					disabled={!canEdit}
					className={pill}
					title={t('pptx.insert.insertTable')}
					{...controlAttr('insert.tables.table')}
				>
					<LuDatabase className={ic} />
					{t('pptx.ribbon.table')}
				</button>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.illustrations'>
				{p.onAddChart && (
					<div className={grp} {...controlAttr('insert.illustrations.chart')}>
						<select
							value={newChartKind}
							onChange={(e) => {
								// The option values are exactly the INSERT_CHART_TYPES ids, so
								// resolve the union member by lookup instead of casting.
								const kind = INSERT_CHART_TYPES.find((ct) => ct.id === e.target.value)?.id;
								setNewChartKind(kind ?? DEFAULT_INSERT_CHART_KIND);
							}}
							className='bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs'
							title={t('pptx.ribbon.chartType')}
						>
							{INSERT_CHART_TYPES.map((ct) => (
								<option key={ct.id} value={ct.id} className='bg-background'>
									{t(ct.labelKey)}
								</option>
							))}
						</select>
						<button
							onClick={() => p.onAddChart!(newChartKind)}
							disabled={!canEdit}
							className='inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs'
							title={t('pptx.ribbon.insertChart')}
						>
							<svg
								className={ic}
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
							>
								<path d='M3 3v18h18' />
								<rect x='7' y='11' width='3' height='6' />
								<rect x='12' y='7' width='3' height='10' />
								<rect x='17' y='13' width='3' height='4' />
							</svg>
							{t('pptx.ribbon.chart')}
						</button>
					</div>
				)}
				<button
					onClick={p.onAddSmartArt}
					disabled={!canEdit}
					className={pill}
					title={t('pptx.insert.insertSmartArt')}
					{...controlAttr('insert.illustrations.smartArt')}
				>
					<LuLayers className={ic} />
					{t('pptx.ribbon.smartArt')}
				</button>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.symbols'>
				<button
					onClick={p.onAddEquation}
					disabled={!canEdit}
					className={pill}
					title={t('pptx.insert.insertEquation')}
					{...controlAttr('insert.symbols.equation')}
				>
					<svg
						className={ic}
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2'
						strokeLinecap='round'
						strokeLinejoin='round'
					>
						<path d='M4 17h6M7 14v6M14 7l4.5 10M15.5 14h5' />
					</svg>
					{t('pptx.ribbon.equation')}
				</button>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.links'>
				{/* Action Buttons dropdown */}
				<div
					className='relative group inline-flex items-center'
					ref={actionMenuRef}
					{...controlAttr('insert.links.action')}
				>
					<button
						type='button'
						disabled={!canEdit}
						className={pill}
						title={t('pptx.ribbon.insertActionButton')}
					>
						<svg
							className={ic}
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<rect x='3' y='3' width='18' height='18' rx='2' />
							<path d='M13 7l4 5-4 5' />
						</svg>
						{t('pptx.ribbon.action')}
						<LuChevronDown className='w-3 h-3' />
					</button>
					<RibbonMenu
						anchorRef={actionMenuRef}
						className='hidden group-hover:flex flex-col w-40 pt-1'
					>
						<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
							{ACTION_BUTTON_PRESETS.map((preset) => (
								<button
									key={preset.shapeType}
									type='button'
									disabled={!canEdit}
									className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
									onClick={() => p.onAddActionButton(preset.shapeType)}
								>
									<svg
										className='w-4 h-4 flex-shrink-0'
										viewBox='0 0 24 24'
										fill='none'
										stroke='currentColor'
										strokeWidth='2'
										strokeLinecap='round'
										strokeLinejoin='round'
									>
										<path d={preset.iconPath} />
									</svg>
									{preset.label}
								</button>
							))}
						</div>
					</RibbonMenu>
				</div>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.text'>
				{/* Insert Field dropdown */}
				{p.onInsertField && (
					<div
						className='relative group inline-flex items-center'
						ref={fieldMenuRef}
						{...controlAttr('insert.text.field')}
					>
						<button
							type='button'
							disabled={!canEdit}
							className={pill}
							title={t('pptx.field.insertField')}
						>
							<svg
								className={ic}
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
							>
								<path d='M4 7h16M4 12h10M4 17h12' />
								<circle cx='19' cy='15' r='3' />
							</svg>
							{t('pptx.field.field')}
							<LuChevronDown className='w-3 h-3' />
						</button>
						<RibbonMenu
							anchorRef={fieldMenuRef}
							className='hidden group-hover:flex flex-col w-44 pt-1'
						>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1'>
								<button
									type='button'
									disabled={!canEdit}
									className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
									onClick={() => p.onInsertField!('slidenum')}
								>
									{t('pptx.field.slideNumber')}
								</button>
								<button
									type='button'
									disabled={!canEdit}
									className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
									onClick={openDatePicker}
								>
									{t('pptx.field.dateTime')}
								</button>
								<button
									type='button'
									disabled={!canEdit}
									className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
									onClick={() => p.onInsertField!('header')}
								>
									{t('pptx.field.header')}
								</button>
								<button
									type='button'
									disabled={!canEdit}
									className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
									onClick={() => p.onInsertField!('footer')}
								>
									{t('pptx.field.footer')}
								</button>
							</div>
						</RibbonMenu>
					</div>
				)}
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.links'>
				<InsertHyperlinkButton
					hasSelection={p.hasSelection}
					onOpenHyperlinkDialog={p.onOpenHyperlinkDialog}
				/>
			</RibbonGroupScope>
			<RibbonGroupScope id='insert.text'>
				{p.onOpenHeaderFooter && (
					<button
						type='button'
						disabled={!canEdit}
						className={cn(pill, 'whitespace-nowrap')}
						onClick={p.onOpenHeaderFooter}
					>
						{t('pptx.headerFooter.title')}
					</button>
				)}
			</RibbonGroupScope>
			{/* Date/Time picker */}
			{datePickerOpen && p.onInsertField && (
				<DateTimeFieldDialog
					onClose={() => setDatePickerOpen(false)}
					onInsert={(formatted) => {
						p.onInsertField?.('datetime', formatted);
						setDatePickerOpen(false);
					}}
				/>
			)}
		</>
	);
}
