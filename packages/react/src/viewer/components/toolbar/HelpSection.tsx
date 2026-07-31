import React from 'react';
import { useTranslation } from 'react-i18next';

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
	return (
		<>
			<button
				type='button'
				onClick={p.onOpenSettings ?? p.onToggleShortcuts}
				className={pill}
				title={t('pptx.settings.title')}
			>
				{t('pptx.settings.title')}
			</button>
			<button
				type='button'
				onClick={p.onToggleShortcuts}
				className={pill}
				title={t('pptx.settings.keyboardShortcuts')}
			>
				{t('pptx.settings.keyboardShortcuts')}
			</button>
			<button
				type='button'
				onClick={p.onRunAccessibilityCheck}
				className={pill}
				title={t('pptx.ribbon.accessibilityCheck')}
			>
				{t('pptx.ribbon.accessibilityCheck')}
			</button>
		</>
	);
}
