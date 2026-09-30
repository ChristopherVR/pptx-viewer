import type { CanvasContextMenuEntry } from '../canvas-context-menu-commands';
import type { ContextMenuEntry } from '../context-menu-commands';

/** Snapshot of the slide on which the host command was offered. */
export interface HostCanvasMenuContext {
	slideIndex: number;
}

/** Effective selection, including a single right-clicked element. */
export interface HostElementMenuContext extends HostCanvasMenuContext {
	elementIds: readonly string[];
}

/** Plain text labels work identically in every framework. */
export interface HostMenuCommand<C> {
	id: string;
	label: string;
	/** Default: a separate group above the built-in commands. */
	group?: 'top' | 'bottom';
	disabled?: boolean | ((context: C) => boolean);
	onSelect: (context: C) => void;
}

export interface HostMenuEntry {
	id: `host:${string}`;
	host: true;
	label: string;
	labelKey: string;
	separatorBefore?: boolean;
	disabled: boolean;
	danger?: boolean;
	checked?: boolean;
	onSelect: () => void;
}

export type CustomizedContextMenuEntry = ContextMenuEntry | HostMenuEntry;
export type CustomizedCanvasContextMenuEntry = CanvasContextMenuEntry | HostMenuEntry;

/** Build a menu with isolated host ids and no leading or trailing separators. */
export function withHostMenuCommands<E extends { id: string; separatorBefore?: boolean }, C>(
	entries: readonly E[],
	commands: readonly HostMenuCommand<C>[],
	context: C,
): Array<E | HostMenuEntry> {
	const top: HostMenuEntry[] = [];
	const bottom: HostMenuEntry[] = [];
	const seen = new Set<string>();
	for (const command of commands) {
		if (!command.id || seen.has(command.id)) {
			continue;
		}
		seen.add(command.id);
		const disabled =
			typeof command.disabled === 'function'
				? command.disabled(context)
				: command.disabled === true;
		const entry: HostMenuEntry = {
			id: `host:${command.id}`,
			host: true,
			label: command.label,
			labelKey: '',
			disabled,
			onSelect: () => {
				if (!disabled) {
					command.onSelect(context);
				}
			},
		};
		(command.group === 'bottom' ? bottom : top).push(entry);
	}
	const middle = entries.map((entry, i) =>
		i === 0 ? { ...entry, separatorBefore: top.length > 0 } : entry,
	);
	if (bottom.length > 0 && top.length + middle.length > 0) {
		bottom[0].separatorBefore = true;
	}
	return [...top, ...middle, ...bottom];
}

/** Host labels are already localized by the host. */
export function hostMenuLabel(
	entry: CustomizedContextMenuEntry | CustomizedCanvasContextMenuEntry,
): string | undefined {
	return 'host' in entry ? entry.label : undefined;
}
