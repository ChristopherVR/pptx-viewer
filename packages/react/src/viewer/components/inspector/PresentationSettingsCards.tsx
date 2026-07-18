import type { PptxPresentationProperties, PptxThemeOption } from 'pptx-viewer-core';
import {
	printPropertiesFrameSlides,
	printPropertiesSlidesPerPage,
	withFrameSlides,
	withSlidesPerPage,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../../types';
import { cn } from '../../utils';
import { CARD, HEADING, INPUT, BTN } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Checkbox helper
// ---------------------------------------------------------------------------

export function CheckboxRow({
	label,
	disabled,
	checked,
	onChange,
}: {
	label: string;
	disabled: boolean;
	checked: boolean;
	onChange: (val: boolean) => void;
}): React.ReactElement {
	return (
		<label className='flex items-center justify-between gap-2'>
			<span className='text-muted-foreground'>{label}</span>
			<input
				type='checkbox'
				disabled={disabled}
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
		</label>
	);
}

// ---------------------------------------------------------------------------
// Presentation Settings Card
// ---------------------------------------------------------------------------

export function PresentationSettingsCard({
	presentationProperties,
	canEdit,
	onUpdate,
}: {
	presentationProperties: PptxPresentationProperties;
	canEdit: boolean;
	onUpdate: (patch: Partial<PptxPresentationProperties>) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.slideInspector.presentation')}</div>
			<div className='space-y-1.5 text-[11px]'>
				<label className='flex items-center justify-between gap-2'>
					<span className='text-muted-foreground'>{t('pptx.presentationSettings.showType')}</span>
					<select
						disabled={!canEdit}
						className={cn(INPUT, 'w-28')}
						value={presentationProperties.showType ?? 'presented'}
						onChange={(e) =>
							onUpdate({
								showType: e.target.value as 'presented' | 'browsed' | 'kiosk',
							})
						}
					>
						<option value='presented'>{t('pptx.presentationSettings.showTypePresented')}</option>
						<option value='browsed'>{t('pptx.presentationSettings.showTypeBrowsed')}</option>
						<option value='kiosk'>{t('pptx.presentationSettings.showTypeKiosk')}</option>
					</select>
				</label>
				<CheckboxRow
					label={t('pptx.presentationSettings.loopContinuously')}
					disabled={!canEdit}
					checked={Boolean(presentationProperties.loopContinuously)}
					onChange={(v) => onUpdate({ loopContinuously: v })}
				/>
				<CheckboxRow
					label={t('pptx.presentationSettings.showNarration')}
					disabled={!canEdit}
					checked={presentationProperties.showWithNarration !== false}
					onChange={(v) => onUpdate({ showWithNarration: v })}
				/>
				<CheckboxRow
					label={t('pptx.presentationSettings.showAnimation')}
					disabled={!canEdit}
					checked={presentationProperties.showWithAnimation !== false}
					onChange={(v) => onUpdate({ showWithAnimation: v })}
				/>
				<CheckboxRow
					label={t('pptx.presentationSettings.frameSlides')}
					disabled={!canEdit}
					checked={printPropertiesFrameSlides(presentationProperties.printProperties)}
					onChange={(v) =>
						onUpdate({
							printProperties: withFrameSlides(presentationProperties.printProperties, v),
						})
					}
				/>
				<label className='flex items-center justify-between gap-2'>
					<span className='text-muted-foreground'>
						{t('pptx.presentationSettings.slidesPerPage')}
					</span>
					<input
						type='number'
						min={1}
						max={16}
						disabled={!canEdit}
						className={cn(INPUT, 'w-20')}
						value={printPropertiesSlidesPerPage(presentationProperties.printProperties)}
						onChange={(e) =>
							onUpdate({
								printProperties: withSlidesPerPage(
									presentationProperties.printProperties,
									Number(e.target.value),
								),
							})
						}
					/>
				</label>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Theme Selector Card
// ---------------------------------------------------------------------------

export function ThemeSelectorCard({
	themeOptions,
	selectedThemePath,
	setSelectedThemePath,
	canEdit,
	onApplyTheme,
}: {
	themeOptions: PptxThemeOption[];
	selectedThemePath: string;
	setSelectedThemePath: (path: string) => void;
	canEdit: boolean;
	onApplyTheme: (path: string, allMasters: boolean) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.documentProperties.themeHeading')}</div>
			<div className='space-y-2 text-[11px]'>
				<label className='flex flex-col gap-1'>
					<span className='text-muted-foreground'>{t('pptx.documentProperties.themeHeading')}</span>
					<select
						disabled={themeOptions.length === 0}
						className={INPUT}
						value={selectedThemePath}
						onChange={(e) => setSelectedThemePath(e.target.value)}
					>
						{themeOptions.length === 0 ? (
							<option value=''>{t('pptx.documentProperties.noThemesOption')}</option>
						) : (
							themeOptions.map((opt) => (
								<option key={opt.path} value={opt.path}>
									{opt.name || opt.path.split('/').pop()}
								</option>
							))
						)}
					</select>
				</label>
				<div className='grid grid-cols-2 gap-1.5'>
					<button
						type='button'
						className={BTN}
						disabled={!canEdit || !selectedThemePath}
						onClick={() => onApplyTheme(selectedThemePath, false)}
					>
						{t('pptx.documentProperties.applyFirstMaster')}
					</button>
					<button
						type='button'
						className={BTN}
						disabled={!canEdit || !selectedThemePath}
						onClick={() => onApplyTheme(selectedThemePath, true)}
					>
						{t('pptx.documentProperties.applyAllMasters')}
					</button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Slide Size Card
// ---------------------------------------------------------------------------

export function SlideSizeCard({
	canvasSize,
	canEdit,
	onUpdate,
}: {
	canvasSize: CanvasSize;
	canEdit: boolean;
	onUpdate: (size: CanvasSize) => void;
}): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className={CARD}>
			<div className={HEADING}>{t('pptx.slideSize.title')}</div>
			<div className='grid grid-cols-2 gap-1.5 text-[11px]'>
				{(
					[
						['W', 'width'],
						['H', 'height'],
					] as const
				).map(([label, key]) => (
					<label key={key} className='flex items-center gap-1'>
						<span className='text-muted-foreground'>{label}</span>
						<input
							type='number'
							className={INPUT}
							disabled={!canEdit}
							value={canvasSize[key]}
							onChange={(e) => onUpdate({ ...canvasSize, [key]: Number(e.target.value) })}
						/>
					</label>
				))}
			</div>
		</div>
	);
}
