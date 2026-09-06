import type { PptxElement, ShapeStyle, TextStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	shouldShowAccessibilitySection,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SHAPE_PRESETS } from '../../constants';
import { cn, normalizeHexColor, sanitizeGradientStops } from '../../utils';
import { AccessibilityTextSection } from './AccessibilityTextSection';
import { DebouncedColorInput } from './DebouncedColorInput';
import { FillStrokeProperties } from './FillStrokeProperties';
import { CARD, HEADING, INPUT } from './inspector-pane-constants';
import { RecentColorsRow } from './RecentColorsRow';
import { TextAdvancedSections } from './TextAdvancedSections';
import { ThemeColorSwatchGrid } from './ThemeColorSwatchGrid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShapeTextPanelsProps {
	selectedElement: PptxElement;
	canEdit: boolean;
	onUpdateElement: (updates: Partial<PptxElement>) => void;
	onUpdateElementStyle: (patch: Partial<ShapeStyle>) => void;
	onUpdateTextStyle: (patch: Partial<TextStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShapeTextPanels({
	selectedElement,
	canEdit,
	onUpdateElement,
	onUpdateElementStyle,
	onUpdateTextStyle,
}: ShapeTextPanelsProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<>
			{/* Shape Type */}
			{hasShapeProperties(selectedElement) && (
				<div className={CARD}>
					<div className={HEADING}>{t('pptx.shape.type', 'Shape Type')}</div>
					<select
						value={selectedElement.shapeType || 'rect'}
						disabled={!canEdit}
						className={cn(INPUT, 'w-full')}
						onChange={(e) =>
							onUpdateElement({
								shapeType: e.target.value,
							} as Partial<PptxElement>)
						}
					>
						{SHAPE_PRESETS.filter((p) => p.type !== 'connector').map((p) => (
							<option key={p.type} value={p.type}>
								{t(p.i18nKey)}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Fill & Stroke: the full panel (fill MODE, gradient stops, pattern,
			    picture fill, dash/join/cap, effects, quick styles), not just a
			    pair of colour swatches. Vue's FillPanel and Svelte's
			    FillStrokeSection already ship this; React rendered a cut-down
			    card while the complete one sat unreferenced. */}
			{hasShapeProperties(selectedElement) && (
				<div className={CARD} data-pptx-fill-stroke>
					<div className={HEADING}>{t('pptx.shape.fillStroke', 'Fill & Stroke')}</div>
					<FillStrokeProperties
						selectedElement={selectedElement}
						selectedShapeStyle={selectedElement.shapeStyle}
						selectedShapeType={selectedElement.shapeType}
						selectedGradientStops={sanitizeGradientStops(
							selectedElement.shapeStyle?.fillGradientStops,
						)}
						canEdit={canEdit}
						onUpdateShapeStyle={onUpdateElementStyle}
						onSetFillColor={(hex, ref) =>
							onUpdateElementStyle({ fillColor: hex, fillMode: 'solid', fillColorRef: ref })
						}
						onSetStrokeColor={(hex, ref) =>
							onUpdateElementStyle({ strokeColor: hex, strokeColorRef: ref })
						}
					/>
				</div>
			)}

			{/* Text Color & Font Size */}
			{hasTextProperties(selectedElement) && (
				<div className={CARD} data-pptx-text-card>
					<div className={HEADING}>{t('pptx.text.title', 'Text')}</div>
					<div className='grid grid-cols-2 gap-1.5 text-[11px]'>
						<label className='flex flex-col gap-1'>
							<span className='text-muted-foreground'>Size</span>
							<input
								type='number'
								disabled={!canEdit}
								className={INPUT}
								min={6}
								max={200}
								step='any'
								value={
									selectedElement.textStyle?.fontSize !== undefined
										? textFontSizePxToPt(selectedElement.textStyle.fontSize)
										: 18
								}
								onChange={(e) =>
									onUpdateTextStyle({ fontSize: textFontSizePtToPx(Number(e.target.value)) })
								}
							/>
						</label>
						<label className='flex flex-col gap-1'>
							<span className='text-muted-foreground'>Color</span>
							<DebouncedColorInput
								disabled={!canEdit}
								ariaLabel='Text Color'
								value={normalizeHexColor(selectedElement.textStyle?.color, '#000000')}
								className='w-full h-7 rounded border border-border bg-transparent cursor-pointer'
								onCommit={(hex) => onUpdateTextStyle({ color: hex, colorRef: undefined })}
							/>
						</label>
						<div className='col-span-2'>
							<ThemeColorSwatchGrid
								prefix='text-color'
								disabled={!canEdit}
								selectedRef={selectedElement.textStyle?.colorRef}
								selectedHex={selectedElement.textStyle?.color}
								onPick={(c) => onUpdateTextStyle({ color: c.hex, colorRef: c.ref })}
							/>
						</div>
						<div className='col-span-2'>
							<RecentColorsRow
								prefix='text-color'
								disabled={!canEdit}
								onCommit={(hex) => onUpdateTextStyle({ color: hex, colorRef: undefined })}
							/>
						</div>
						<div className='flex gap-1 col-span-2'>
							<TextFormatToggle
								label='B'
								active={Boolean(selectedElement.textStyle?.bold)}
								disabled={!canEdit}
								onClick={() => onUpdateTextStyle({ bold: !selectedElement.textStyle?.bold })}
							/>
							<TextFormatToggle
								label='I'
								active={Boolean(selectedElement.textStyle?.italic)}
								disabled={!canEdit}
								italic
								onClick={() =>
									onUpdateTextStyle({
										italic: !selectedElement.textStyle?.italic,
									})
								}
							/>
							<TextFormatToggle
								label='U'
								active={Boolean(selectedElement.textStyle?.underline)}
								disabled={!canEdit}
								underline
								onClick={() =>
									onUpdateTextStyle({
										underline: !selectedElement.textStyle?.underline,
									})
								}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Warp / effects / 3D text: gated on the same text-capable check as
			    the card above, so they appear alongside the other text sections. */}
			<TextAdvancedSections
				selectedElement={selectedElement}
				canEdit={canEdit}
				onUpdateTextStyle={onUpdateTextStyle}
			/>

			{/* Accessibility (alt text / title): a picture's own field lives in
			    ImagePropertiesPanel; shared's `shouldShowAccessibilitySection`
			    decides everything else, a plain shape, text box, connector, and
			    every graphic-frame kind (table/chart/smartArt/media/ole), so this
			    stays in sync with the other four bindings without a hard-coded
			    type list here. */}
			{shouldShowAccessibilitySection(selectedElement) && (
				<AccessibilityTextSection
					selectedElement={selectedElement}
					canEdit={canEdit}
					onUpdateElement={onUpdateElement}
				/>
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// Private sub-component
// ---------------------------------------------------------------------------

interface TextFormatToggleProps {
	label: string;
	active: boolean;
	disabled: boolean;
	italic?: boolean;
	underline?: boolean;
	onClick: () => void;
}

function TextFormatToggle({
	label,
	active,
	disabled,
	italic,
	underline,
	onClick,
}: TextFormatToggleProps): React.ReactElement {
	return (
		<button
			type='button'
			disabled={disabled}
			className={cn(
				'px-2 py-1 rounded text-[11px] transition-colors',
				italic && 'italic',
				underline && 'underline',
				active ? 'bg-primary text-white' : 'bg-muted hover:bg-accent',
			)}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
