/**
 * The five demo apps, and which of them a given Playwright project compares.
 *
 * This module is deliberately NOT a `.spec.ts` file. `scripts/check-e2e-neutrality.mjs`
 * scans product specs for demo-port literals and for control flow that branches
 * on the Playwright project, because a spec that does either has stopped being
 * one suite run five ways. Cross-binding parity specs still need both: they
 * drive several demos in a single test and compare them. Keeping the port table
 * and the project fan-out here - behind a neutral API - lets the specs stay
 * literally framework-agnostic while the harness owns the one place that knows
 * a port number.
 *
 * @module e2e/support/frameworks
 */

/** A demo app: the binding it exercises and the dev server it listens on. */
export interface FrameworkDemo {
	/** Binding name, matching the Playwright project name. */
	readonly name: string;
	/** Dev-server port from `playwright.config.ts`'s `webServer` list. */
	readonly port: number;
}

export const REACT: FrameworkDemo = { name: 'react', port: 4173 };
export const ANGULAR: FrameworkDemo = { name: 'angular', port: 4174 };
export const VUE: FrameworkDemo = { name: 'vue', port: 4175 };
export const VANILLA: FrameworkDemo = { name: 'vanilla', port: 4176 };
export const SVELTE: FrameworkDemo = { name: 'svelte', port: 4177 };

/** Every demo, in ribbon-parity order (reference first). */
export const FRAMEWORKS: readonly FrameworkDemo[] = [REACT, VUE, ANGULAR, VANILLA, SVELTE];

/**
 * The binding every other binding is measured against.
 *
 * React is the reference renderer throughout this repo: features land there
 * first and the other four are ports of it, so "parity" means "agrees with
 * React" rather than "the five agree with each other on average".
 */
export const REFERENCE: FrameworkDemo = REACT;

/** Look a demo up by binding name. */
export function frameworkByName(name: string): FrameworkDemo {
	const found = FRAMEWORKS.find((framework) => framework.name === name);
	if (!found) {
		throw new Error(
			`Unknown demo binding "${name}". Known: ${FRAMEWORKS.map((f) => f.name).join(', ')}.`,
		);
	}
	return found;
}

/**
 * Which demos this Playwright project should compare in one parity test.
 *
 * Each non-reference project compares itself against React, so the CI matrix
 * covers all four pairings exactly once with no duplicated work. The reference
 * project sweeps all five, so that a local `--project=react` run on its own
 * still reports the complete picture.
 */
export function comparisonSet(projectName: string): readonly FrameworkDemo[] {
	const self = frameworkByName(projectName);
	if (self.name === REFERENCE.name) {
		return FRAMEWORKS;
	}
	return [REFERENCE, self];
}

/** Origin of a demo's dev server. */
export function originOf(framework: FrameworkDemo): string {
	return `http://localhost:${framework.port}`;
}

/** Absolute URL for `path` (e.g. `/?smartArt3D=1`) on a demo's dev server. */
export function urlOf(framework: FrameworkDemo, path = '/'): string {
	return `${originOf(framework)}${path.startsWith('/') ? path : `/${path}`}`;
}
