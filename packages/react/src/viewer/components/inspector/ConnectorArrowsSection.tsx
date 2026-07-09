import type { ShapeStyle, ConnectorArrowType } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CONNECTOR_ARROW_OPTIONS, ARROW_SIZE_OPTIONS } from '../../constants';
import { SELECT_CLS } from './element-properties-constants';

interface ConnectorArrowsSectionProps {
	selectedShapeStyle: ShapeStyle | undefined;
	onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
	markDirty: () => void;
}

const END_LABEL_KEYS = {
	Start: {
		arrow: 'pptx.connectorArrows.startArrow',
		width: 'pptx.connectorArrows.startWidth',
		length: 'pptx.connectorArrows.startLength',
	},
	End: {
		arrow: 'pptx.connectorArrows.endArrow',
		width: 'pptx.connectorArrows.endWidth',
		length: 'pptx.connectorArrows.endLength',
	},
} as const;

export function ConnectorArrowsSection({
	selectedShapeStyle,
	onUpdateShapeStyle,
	markDirty,
}: ConnectorArrowsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<div className='grid grid-cols-2 gap-2'>
			{(['Start', 'End'] as const).map((end) => {
				const key = end === 'Start' ? 'connectorStartArrow' : 'connectorEndArrow';
				return (
					<label key={end} className='flex flex-col gap-1'>
						<span className='text-muted-foreground'>{t(END_LABEL_KEYS[end].arrow)}</span>
						<select
							value={selectedShapeStyle?.[key] || 'none'}
							onChange={(e) => {
								onUpdateShapeStyle({
									[key]: e.target.value as ConnectorArrowType,
								});
								markDirty();
							}}
							className={SELECT_CLS}
						>
							{CONNECTOR_ARROW_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>
									{t(o.i18nKey)}
								</option>
							))}
						</select>
					</label>
				);
			})}
			{(['Start', 'End'] as const).map((end) => {
				const widthKey = end === 'Start' ? 'connectorStartArrowWidth' : 'connectorEndArrowWidth';
				const lengthKey = end === 'Start' ? 'connectorStartArrowLength' : 'connectorEndArrowLength';
				return (
					<React.Fragment key={`${end}-size`}>
						<label className='flex flex-col gap-1'>
							<span className='text-muted-foreground'>{t(END_LABEL_KEYS[end].width)}</span>
							<select
								value={selectedShapeStyle?.[widthKey] || 'med'}
								onChange={(e) => {
									onUpdateShapeStyle({
										[widthKey]: e.target.value as 'sm' | 'med' | 'lg',
									});
									markDirty();
								}}
								className={SELECT_CLS}
							>
								{ARROW_SIZE_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{t(o.i18nKey)}
									</option>
								))}
							</select>
						</label>
						<label className='flex flex-col gap-1'>
							<span className='text-muted-foreground'>{t(END_LABEL_KEYS[end].length)}</span>
							<select
								value={selectedShapeStyle?.[lengthKey] || 'med'}
								onChange={(e) => {
									onUpdateShapeStyle({
										[lengthKey]: e.target.value as 'sm' | 'med' | 'lg',
									});
									markDirty();
								}}
								className={SELECT_CLS}
							>
								{ARROW_SIZE_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{t(o.i18nKey)}
									</option>
								))}
							</select>
						</label>
					</React.Fragment>
				);
			})}
		</div>
	);
}
