import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { grp, ic, pill } from './toolbar-constants';

export interface InsertSectionProps {
	canEdit: boolean;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddTextBox: () => void;
	onAddShape: () => void;
	onAddTable: () => void;
	onAddSmartArt: () => void;
	onAddEquation: () => void;
	onAddActionButton: (shapeType: string) => void;
	onInsertField?: (fieldType: string, value?: string) => void;
	onOpenImagePicker: () => void;
	onOpenMediaPicker: () => void;
}

export function InsertSection(p: InsertSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const { canEdit } = p;
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [datePickerValue, setDatePickerValue] = useState('');
	const [dateFormat, setDateFormat] = useState('locale');
	const datePickerRef = useRef<HTMLDivElement>(null);

	const openDatePicker = useCallback(() => {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		setDatePickerValue(
			`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
		);
		setDateFormat('locale');
		setDatePickerOpen(true);
	}, []);

	const confirmDatePicker = useCallback(() => {
		if (!p.onInsertField) {
			return;
		}
		const d = new Date(datePickerValue);
		if (isNaN(d.getTime())) {
			return;
		}
		let formatted: string;
		switch (dateFormat) {
			case 'iso':
				formatted = d.toISOString().slice(0, 10);
				break;
			case 'long':
				formatted = d.toLocaleDateString(undefined, {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				});
				break;
			case 'short':
				formatted = d.toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				});
				break;
			case 'time':
				formatted = d.toLocaleString();
				break;
			default:
				formatted = d.toLocaleDateString();
				break;
		}
		p.onInsertField('datetime', formatted);
		setDatePickerOpen(false);
	}, [datePickerValue, dateFormat, p]);

	// Close date picker on outside click
	useEffect(() => {
		if (!datePickerOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
				setDatePickerOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [datePickerOpen]);

	return (
		<>
			<button onClick={p.onAddTextBox} disabled={!canEdit} className={pill} title='Add text box'>
				<LuType className={ic} />
				Text
			</button>
			<div className={grp}>
				<select
					value={p.newShapeType}
					onChange={(e) => p.onSetNewShapeType(e.target.value as SupportedShapeType)}
					className='bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs'
					title='Shape type'
				>
					{SHAPE_PRESETS.map((sp) => (
						<option key={sp.type} value={sp.type} className='bg-background'>
							{sp.label}
						</option>
					))}
				</select>
				<button
					onClick={p.onAddShape}
					disabled={!canEdit}
					className='inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs'
					title='Add shape'
				>
					{SHAPE_PRESETS.find((sp) => sp.type === p.newShapeType)?.icon || (
						<LuSquare className={ic} />
					)}
					Shape
				</button>
			</div>
			<button
				onClick={p.onOpenImagePicker}
				disabled={!canEdit}
				className={pill}
				title='Insert image'
			>
				<LuImage className={ic} />
				Image
			</button>
			<button
				onClick={p.onOpenMediaPicker}
				disabled={!canEdit}
				className={pill}
				title='Insert audio or video'
			>
				<LuVideo className={ic} />
				Media
			</button>
			<button onClick={p.onAddTable} disabled={!canEdit} className={pill} title='Insert table'>
				<LuDatabase className={ic} />
				Table
			</button>
			<button
				onClick={p.onAddSmartArt}
				disabled={!canEdit}
				className={pill}
				title='Insert SmartArt'
			>
				<LuLayers className={ic} />
				SmartArt
			</button>
			<button
				onClick={p.onAddEquation}
				disabled={!canEdit}
				className={pill}
				title='Insert Equation'
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
				Equation
			</button>
			{/* Action Buttons dropdown */}
			<div className='relative group'>
				<button type='button' disabled={!canEdit} className={pill} title='Insert action button'>
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
					Action
					<LuChevronDown className='w-3 h-3' />
				</button>
				<div className='absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-40 pt-1'>
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
				</div>
			</div>
			{/* Insert Field dropdown */}
			{p.onInsertField && (
				<div className='relative group'>
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
					<div className='absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-44 pt-1'>
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
					</div>
				</div>
			)}
			{/* Date/Time picker popover */}
			{datePickerOpen && (
				<div
					ref={datePickerRef}
					className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/30'
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) {
							setDatePickerOpen(false);
						}
					}}
				>
					<div className='rounded-lg border border-border bg-popover shadow-2xl p-4 w-72 space-y-3'>
						<div className='text-sm font-medium text-foreground'>{t('pptx.field.dateTime')}</div>
						<input
							type='datetime-local'
							className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none'
							value={datePickerValue}
							onChange={(e) => setDatePickerValue(e.target.value)}
						/>
						<div>
							<label className='block text-[11px] text-muted-foreground mb-1'>
								{t('pptx.field.format', 'Format')}
							</label>
							<select
								className='w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none'
								value={dateFormat}
								onChange={(e) => setDateFormat(e.target.value)}
							>
								<option value='locale'>
									{new Date(datePickerValue || Date.now()).toLocaleDateString()}
								</option>
								<option value='long'>
									{new Date(datePickerValue || Date.now()).toLocaleDateString(undefined, {
										weekday: 'long',
										year: 'numeric',
										month: 'long',
										day: 'numeric',
									})}
								</option>
								<option value='short'>
									{new Date(datePickerValue || Date.now()).toLocaleDateString(undefined, {
										year: 'numeric',
										month: 'short',
										day: 'numeric',
									})}
								</option>
								<option value='iso'>
									{new Date(datePickerValue || Date.now()).toISOString().slice(0, 10)}
								</option>
								<option value='time'>
									{new Date(datePickerValue || Date.now()).toLocaleString()}
								</option>
							</select>
						</div>
						<div className='flex justify-end gap-2 pt-1'>
							<button
								type='button'
								className='px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-muted transition-colors'
								onClick={() => setDatePickerOpen(false)}
							>
								{t('pptx.common.cancel', 'Cancel')}
							</button>
							<button
								type='button'
								className='px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
								onClick={confirmDatePicker}
							>
								{t('pptx.common.insert', 'Insert')}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
