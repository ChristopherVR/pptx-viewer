import type { RibbonControlId } from './customization';

/** Shared Help ordering and presentation. Hosts own dialog availability and actions. */
export const HELP_RIBBON_COMMANDS: readonly {
	id: RibbonControlId;
	labelKey: string;
	icon: string;
}[] = [
	{ id: 'help.help.options', labelKey: 'pptx.settings.title', icon: 'settings' },
	{
		id: 'help.help.keyboardShortcuts',
		labelKey: 'pptx.settings.keyboardShortcuts',
		icon: 'keyboard',
	},
	{
		id: 'help.help.accessibility',
		labelKey: 'pptx.ribbon.accessibilityCheck',
		icon: 'accessibility',
	},
];
