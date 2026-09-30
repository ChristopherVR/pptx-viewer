import type { PptxTheme } from 'pptx-viewer-core';
import { themeEditorLabels } from 'pptx-viewer-shared';
import type {
	PptxUiThemeEditorElement,
	ThemeEditorApplyEvent,
	ThemeEditorEdit,
} from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface ThemeEditorPanelProps {
	theme: PptxTheme | undefined;
	canEdit: boolean;
	onApply: (edit: ThemeEditorEdit) => void | Promise<void>;
	onClose: () => void;
}

/** React 18/19 lifecycle adapter; the shared element owns the draft and view. */
export function ThemeEditorPanel({ theme, canEdit, onApply, onClose }: ThemeEditorPanelProps) {
	const { t } = useTranslation();
	const ref = useRef<PptxUiThemeEditorElement>(null);
	useEffect(() => {
		const node = ref.current;
		if (node) {
			node.theme = theme;
			node.labels = themeEditorLabels(t);
			node.disabled = !canEdit;
		}
	}, [theme, canEdit, t]);
	useEffect(() => {
		const node = ref.current;
		if (!node) {
			return;
		}
		const apply = (event: Event): void => {
			if (!node.disabled) {
				node.disabled = true;
				void Promise.resolve(onApply((event as ThemeEditorApplyEvent).detail)).finally(() => {
					node.disabled = !canEdit;
				});
			}
		};
		node.addEventListener('theme-editor-apply', apply);
		node.addEventListener('theme-editor-close', onClose);
		return () => {
			node.removeEventListener('theme-editor-apply', apply);
			node.removeEventListener('theme-editor-close', onClose);
		};
	}, [canEdit, onApply, onClose]);
	return <pptx-ui-theme-editor ref={ref} />;
}
