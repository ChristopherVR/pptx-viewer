/**
 * Turning per-binding menu snapshots into one aggregated parity report.
 *
 * Kept apart from the reading side so a parity spec never asserts inside its
 * own loop: every binding is inspected, the problems are concatenated, and a
 * single assertion prints all of them. Asserting per binding throws on the
 * first one that fails, which hides a defect shared by four bindings behind a
 * single binding's name.
 *
 * @module e2e/support/menu-report
 */
import type { MenuSnapshot } from './context-menu';
import { missingFrom, NO_MENU, report } from './context-menu';
import type { FrameworkResult } from './parity';

/** A binding's name paired with whatever the scenario measured for it. */
export interface BindingResult<T> {
	name: string;
	value: T;
}

/** Drop the framework object, keeping only its name, so specs never branch on it. */
export function byBinding<T>(results: FrameworkResult<T>[]): BindingResult<T>[] {
	return results.map((result) => ({ name: result.framework.name, value: result.value }));
}

/**
 * Run `check` against one binding's menu, short-circuiting when it has none.
 *
 * The absent case is answered once, here, so that every test reports a missing
 * menu in the same words instead of each one inventing its own phrasing for
 * "the binding this spec is about does not exist".
 */
export function inspect(
	name: string,
	snapshot: MenuSnapshot,
	check: (snapshot: MenuSnapshot) => string[],
): string[] {
	if (!snapshot.present) {
		return report(name, [NO_MENU]);
	}
	return report(name, check(snapshot));
}

/** One "does not offer ..." line per expected command the menu lacks. */
export function missingLines(snapshot: MenuSnapshot, required: readonly string[]): string[] {
	return missingFrom(snapshot, required).map((command) => `does not offer "${command}"`);
}
