import type { PresentationContextMenuSection } from '../render/presentation-context-menu';
import type { SlidePaneContextMenuEntry } from '../render/slide-pane-context-menu';
import type { ContextMenuViewItem } from './context-menu-model';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** What the element, canvas and host-extension entry lists share. */
interface MenuEntryLike {
	id: string;
	labelKey: string;
	/** Present on host entries, whose label is already translated. */
	label?: string;
	separatorBefore?: boolean;
	danger?: boolean;
	disabled?: boolean;
	checked?: boolean;
}

/**
 * View rows for an element or canvas entry list (built-in and host entries).
 * `isAvailable` greys out an offered command the host wired no handler for:
 * a menu that changes shape per host is the drift the shared lists prevent.
 */
export function contextMenuViewItems(
	entries: readonly MenuEntryLike[],
	t: Translate,
	isAvailable: (id: string) => boolean = () => true,
): ContextMenuViewItem[] {
	return entries.map((entry) => ({
		id: entry.id,
		label: entry.label ?? t(entry.labelKey),
		separatorBefore: entry.separatorBefore,
		danger: entry.danger,
		disabled: entry.disabled === true || !isAvailable(entry.id),
		checked: entry.checked,
	}));
}

/** View rows for the slide-thumbnail menu; Delete is tinted and counted labels interpolate. */
export function slidePaneViewItems(
	entries: readonly SlidePaneContextMenuEntry[],
	t: Translate,
	selectedCount: number,
): ContextMenuViewItem[] {
	return entries.map((entry) => ({
		id: entry.id,
		label: entry.countLabelKey ? t(entry.labelKey, { count: selectedCount }) : t(entry.labelKey),
		separatorBefore: entry.separatorBefore,
		danger: entry.id === 'delete',
		disabled: entry.disabled === true,
	}));
}

/** View rows for the slide-show menu: section rules, with a heading where the section has one. */
export function presentationViewItems(
	sections: readonly PresentationContextMenuSection[],
	t: Translate,
): ContextMenuViewItem[] {
	return sections.flatMap((section, sectionIndex) =>
		section.items.map((item, itemIndex) => ({
			id: item.id,
			label: t(item.labelKey),
			separatorBefore: itemIndex === 0 && sectionIndex > 0,
			heading: itemIndex === 0 && section.headingKey ? t(section.headingKey) : undefined,
		})),
	);
}
