import type { FontCatalogInput, RibbonHomeIntent } from 'pptx-viewer-shared';
import { fontPickerHomeControls } from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { WebHomeControls } from './WebHomeControls';

interface Props extends FontCatalogInput {
	enabled: boolean;
	fontFamily: string;
	fontSize: string;
	onFamily: (family: string) => void;
	onSize: (size: number) => void;
}

/** Home > Font family and size: the shared `pptx-ui-ribbon-home-font-picker` field pair. */
export function FontPickerGroup(p: Props): React.ReactElement {
	const { t } = useTranslation();
	const { enabled, fontFamily, fontSize, themeFonts, embeddedFonts, customFonts } = p;
	const { onFamily, onSize } = p;
	const controls = useMemo(
		() =>
			fontPickerHomeControls(
				{ enabled, fontFamily, fontSize, themeFonts, embeddedFonts, customFonts },
				t,
			),
		[enabled, fontFamily, fontSize, themeFonts, embeddedFonts, customFonts, t],
	);
	const request = useCallback(
		(id: string, _part?: string, intent?: RibbonHomeIntent) => {
			if (id === 'home.font.fontFamily') {
				onFamily(String(intent?.value));
			} else {
				onSize(Number(intent?.value));
			}
		},
		[onFamily, onSize],
	);
	return <WebHomeControls family='font-picker' controls={controls} onRequest={request} />;
}
