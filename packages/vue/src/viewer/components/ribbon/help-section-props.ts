export interface HelpSectionProps {
	/** Opens Options, or the shortcuts sheet when the host does not wire Options. */
	onOpenSettings?: () => void;
	onToggleShortcuts: () => void;
	onRunAccessibilityCheck: () => void;
}
