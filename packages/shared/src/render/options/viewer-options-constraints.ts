/**
 * Host constraints on the File > Options store: settings LOCKED to a fixed
 * value and host DEFAULTS that replace the built-in ones.
 *
 * Pure helpers; `createViewerOptionsStore` applies them on every write, so a
 * locked value cannot be changed from any path (the dialog, a ribbon toggle
 * writing through `setOptions`, a reset), and host defaults are never
 * persisted as if the user had chosen them.
 *
 * @module render/options/viewer-options-constraints
 */
import type { OptionsSettingValues } from '../customization/customization-types';
import type { ViewerOptionPrimitive, ViewerOptions, ViewerOptionsGroupId } from './viewer-options';
import { DEFAULT_VIEWER_OPTIONS, cloneViewerOptions } from './viewer-options';

/** Locks and host defaults, both keyed `<group>.<key>`. */
export interface ViewerOptionsConstraints {
	locked?: OptionsSettingValues;
	defaults?: OptionsSettingValues;
}

/** Split `<group>.<key>`, rejecting ids that do not name a primitive option. */
export function parseOptionsSettingId(
	id: string,
): { group: ViewerOptionsGroupId; key: string } | null {
	const dot = id.indexOf('.');
	if (dot <= 0) {
		return null;
	}
	const group = id.slice(0, dot) as ViewerOptionsGroupId;
	const key = id.slice(dot + 1);
	const defaults = DEFAULT_VIEWER_OPTIONS[group] as unknown as Record<string, unknown> | undefined;
	if (!defaults || !(key in defaults) || Array.isArray(defaults[key])) {
		return null;
	}
	return { group, key };
}

function entriesOf(
	values: OptionsSettingValues | undefined,
): Array<[string, ViewerOptionPrimitive]> {
	return Object.entries(values ?? {}).filter(
		(entry): entry is [string, ViewerOptionPrimitive] => entry[1] !== undefined,
	);
}

/** Write each `<group>.<key>` value into `target` when its type matches the model. */
function writeValues(target: ViewerOptions, values: OptionsSettingValues | undefined): void {
	for (const [id, value] of entriesOf(values)) {
		const parsed = parseOptionsSettingId(id);
		if (!parsed) {
			continue;
		}
		const record = target[parsed.group] as unknown as Record<string, unknown>;
		if (typeof record[parsed.key] === typeof value) {
			record[parsed.key] = value;
		}
	}
}

/** `options` with every locked value forced in (a new object; input untouched). */
export function applyLockedOptions(
	options: ViewerOptions,
	locked: OptionsSettingValues | undefined,
): ViewerOptions {
	if (entriesOf(locked).length === 0) {
		return options;
	}
	const next = cloneViewerOptions(options);
	writeValues(next, locked);
	return next;
}

/** The built-in defaults with the host's defaults layered on top. */
export function buildOptionsBaseline(defaults: OptionsSettingValues | undefined): ViewerOptions {
	const baseline = cloneViewerOptions(DEFAULT_VIEWER_OPTIONS);
	writeValues(baseline, defaults);
	return baseline;
}

/** True when `<group>.<key>` is locked. */
export function isOptionLocked(
	locked: OptionsSettingValues | undefined,
	group: ViewerOptionsGroupId,
	key: string,
): boolean {
	return Object.hasOwn(locked ?? {}, `${group}.${key}`);
}

/**
 * The sparse diff of `options` against `baseline`, minus locked settings, for
 * persistence: neither a host default nor a host lock is ever saved as the
 * user's own choice.
 */
export function diffOptionsAgainstBaseline(
	options: ViewerOptions,
	baseline: ViewerOptions,
	locked: OptionsSettingValues | undefined,
): Partial<Record<ViewerOptionsGroupId, Record<string, unknown>>> {
	const diff: Partial<Record<ViewerOptionsGroupId, Record<string, unknown>>> = {};
	for (const group of Object.keys(baseline) as ViewerOptionsGroupId[]) {
		const base = baseline[group] as unknown as Record<string, unknown>;
		const current = options[group] as unknown as Record<string, unknown>;
		for (const key of Object.keys(base)) {
			if (isOptionLocked(locked, group, key)) {
				continue;
			}
			const changed = Array.isArray(base[key])
				? JSON.stringify(base[key]) !== JSON.stringify(current[key])
				: base[key] !== current[key];
			if (changed) {
				(diff[group] ??= {})[key] = current[key];
			}
		}
	}
	return diff;
}

/**
 * Move every setting that still sits at the OLD baseline (and that the user
 * never saved) onto the NEW baseline, so changing a host default updates
 * users who have not touched that setting and leaves the rest alone.
 */
export function rebaseOptions(
	options: ViewerOptions,
	previousBaseline: ViewerOptions,
	nextBaseline: ViewerOptions,
	userSaved: ReadonlySet<string>,
): ViewerOptions {
	const next = cloneViewerOptions(options);
	for (const group of Object.keys(nextBaseline) as ViewerOptionsGroupId[]) {
		const before = previousBaseline[group] as unknown as Record<string, unknown>;
		const after = nextBaseline[group] as unknown as Record<string, unknown>;
		const target = next[group] as unknown as Record<string, unknown>;
		for (const key of Object.keys(after)) {
			if (Array.isArray(after[key]) || userSaved.has(`${group}.${key}`)) {
				continue;
			}
			if (target[key] === before[key]) {
				target[key] = after[key];
			}
		}
	}
	return next;
}
