import { isDialogAvailable } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useViewerCustomizationContext } from '../viewer-customization-context';
import { controlAttr, RibbonGroupScope } from './PowerPointRibbonControls';
import { pill } from './toolbar-constants';

export interface HelpSectionProps {
	/** Opens the File > Options dialog. Falls back to the shortcuts sheet when the host wires neither. */
	onOpenSettings?: () => void;
	onToggleShortcuts: () => void;
	onRunAccessibilityCheck: () => void;
}

/**
 * The Help ribbon tab.
 *
 * Lifted out of `Toolbar.tsx`'s inline JSX so the shell stays routing-only and
 * this tab can grow (it gained Settings, which angular/vanilla/svelte already
 * offered and react/vue did not) without pushing that file further past the
 * repo's ~300 LOC ceiling.
 */
export function HelpSection(p: HelpSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const showSettings = isDialogAvailable(useViewerCustomizationContext(), 'options');
	return (
		<RibbonGroupScope id='help.help'>
			{showSettings && (
				<button
					type='button'
					onClick={p.onOpenSettings ?? p.onToggleShortcuts}
					className={pill}
					title={t('pptx.settings.title')}
					{...controlAttr('help.help.options')}
				>
					{t('pptx.settings.title')}
				</button>
			)}
			<button
				type='button'
				onClick={p.onToggleShortcuts}
				className={pill}
				title={t('pptx.settings.keyboardShortcuts')}
				{...controlAttr('help.help.keyboardShortcuts')}
			>
				{t('pptx.settings.keyboardShortcuts')}
			</button>
			<button
				type='button'
				onClick={p.onRunAccessibilityCheck}
				className={pill}
				title={t('pptx.ribbon.accessibilityCheck')}
				{...controlAttr('help.help.accessibility')}
			>
				{t('pptx.ribbon.accessibilityCheck')}
			</button>
		</RibbonGroupScope>
	);
}
