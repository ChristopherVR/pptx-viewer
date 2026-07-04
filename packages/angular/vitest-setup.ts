/**
 * vitest-setup.ts: loads the Angular JIT compiler before any test module runs.
 *
 * Our `.component.ts` files are transpiled by plain `esbuild`/TypeScript
 * decorators here (no Angular AOT), so their `@Component`/`@Injectable`
 * classes have no `ɵcmp`/`ɵprov` factory baked in and Angular falls back to
 * JIT at runtime. `@ngx-translate/core`'s `DefaultMissingTranslationHandler`
 * hits this exact fallback in its own module-level static initializer, so
 * merely importing a `.component.ts` file (even just for a co-located pure
 * helper export) throws unless `@angular/compiler` has already been loaded.
 */
import '@angular/compiler';
