import { buildFontCatalog, COMMON_FONT_SIZES } from 'pptx-viewer-shared';
import type { FontCatalogInput } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { WebSelect } from '../WebControls';

interface Props extends FontCatalogInput {
	enabled: boolean;
	fontFamily: string;
	fontSize: string;
	onFamily: (family: string) => void;
	onSize: (size: number) => void;
}

export function FontPickers(p: Props): React.ReactElement {
	const { t } = useTranslation();
	const groups = buildFontCatalog(p);
	return (
		<div className='flex flex-col items-center gap-0.5' data-ribbon-group='home.font'>
			<div data-pptx-chrome='font-picker-controls'>
				<WebSelect
					variant='ribbon-font'
					data-font-picker='family'
					data-ribbon-control='home.font.fontFamily'
					aria-label={t('pptx.ribbon.fontFamily')}
					value={p.fontFamily}
					disabled={!p.enabled}
					onChange={(e) => p.onFamily(e.target.value)}
				>
					{groups.map((group) => (
						<optgroup key={group.id} label={t(group.labelKey)}>
							{group.entries.map((entry) => (
								<option
									key={entry.family}
									value={entry.family}
									style={{ fontFamily: entry.family }}
									data-display-label={entry.family}
									data-description={
										entry.themeRole ? t(`pptx.font.role.${entry.themeRole}`) : undefined
									}
								>
									{entry.family}
								</option>
							))}
						</optgroup>
					))}
				</WebSelect>
				<WebSelect
					variant='ribbon-font'
					data-font-picker='size'
					data-ribbon-control='home.font.fontSize'
					aria-label={t('pptx.ribbon.fontSize')}
					value={p.fontSize}
					disabled={!p.enabled}
					onChange={(e) => p.onSize(Number(e.target.value))}
				>
					{COMMON_FONT_SIZES.map((size) => (
						<option key={size} value={size}>
							{size}
						</option>
					))}
				</WebSelect>
			</div>
			<span data-pptx-chrome='ribbon-group-label'>{t('pptx.ribbon.font')}</span>
		</div>
	);
}
