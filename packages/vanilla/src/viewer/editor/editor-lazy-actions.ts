/**
 * Build a lazily-resolved proxy over an action bag whose real instance isn't
 * constructed yet at call time (`EditActions` is built by `createEditActions`
 * *after* the chrome/ribbon that needs to reference its methods, see
 * `PptxViewer.ts`'s construction order). Every method call forwards to
 * `getActions()` at the moment it's invoked, so the ribbon can be wired to a
 * stable object at construction time while the underlying `EditActions`
 * instance is swapped in once the editor controller exists (and again on
 * `setLocale`'s chrome remount).
 */
export function createLazyActions<T extends object>(getActions: () => T): T {
	const cache = new Map<string, (...args: unknown[]) => unknown>();
	return new Proxy({} as T, {
		get(_target, prop) {
			if (typeof prop !== 'string') {
				return undefined;
			}
			let fn = cache.get(prop);
			if (!fn) {
				fn = (...args: unknown[]) => {
					const actions = getActions() as unknown as Record<string, (...a: unknown[]) => unknown>;
					return actions[prop](...args);
				};
				cache.set(prop, fn);
			}
			return fn;
		},
	});
}
