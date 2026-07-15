import type { PptxSlideMaster, PptxTheme, PptxThemeOption } from 'pptx-viewer-core';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ANIMATION_PANEL_MIN_HEIGHT = 80;
const ANIMATION_PANEL_MAX_HEIGHT = 500;
const ANIMATION_PANEL_DEFAULT_HEIGHT = 220;

export function useInspectorPaneState(
	themeOptions: PptxThemeOption[],
	slideMasters: PptxSlideMaster[] | undefined,
	theme: PptxTheme | undefined,
) {
	const activeThemePath = slideMasters?.[0]?.themePath;
	const effectiveThemeOptions = useMemo(() => {
		if (themeOptions.length > 0 || !activeThemePath) {
			return themeOptions;
		}
		return [{ path: activeThemePath, name: theme?.name }];
	}, [activeThemePath, theme?.name, themeOptions]);

	const [selectedThemePath, setSelectedThemePath] = useState('');
	useEffect(() => {
		setSelectedThemePath(activeThemePath ?? effectiveThemeOptions[0]?.path ?? '');
	}, [activeThemePath, effectiveThemeOptions]);

	const [animationPanelHeight, setAnimationPanelHeight] = useState(ANIMATION_PANEL_DEFAULT_HEIGHT);
	const onResizeAnimationPanel = useCallback((delta: number) => {
		setAnimationPanelHeight((height) =>
			Math.min(ANIMATION_PANEL_MAX_HEIGHT, Math.max(ANIMATION_PANEL_MIN_HEIGHT, height - delta)),
		);
	}, []);

	return {
		animationPanelHeight,
		effectiveThemeOptions,
		onResizeAnimationPanel,
		selectedThemePath,
		setSelectedThemePath,
	};
}
