/**
 * Guarded dynamic loader for the Vercel AI SDK (`ai`, v7).
 *
 * `ai` is an OPTIONAL peer dependency: every import in this module is either
 * type-only (erased at build time) or a guarded dynamic `import()`. When the
 * host application has not installed `ai`, {@link loadAiSdk} resolves to `null`
 * (the sentinel for "SDK absent") instead of throwing, so a binding can keep
 * its chat panel disabled and fall back gracefully. This mirrors the optional
 * `three` loader in `render/model3d-scene.ts`.
 */

// Type-only import: pulls in the SDK's types without emitting a runtime
// dependency. The concrete module is loaded lazily via dynamic import below.
import type * as AiSdk from 'ai';

/** The full runtime surface of the `ai` package, as a type. */
export type AiSdkModule = typeof AiSdk;

let cached: AiSdkModule | null | undefined;

/**
 * Dynamically import the `ai` SDK.
 *
 * @returns The loaded module, or `null` when `ai` is not installed / fails to
 *   load. `null` is the sentinel every caller checks before using AI features.
 */
export async function loadAiSdk(): Promise<AiSdkModule | null> {
	if (cached !== undefined) {
		return cached;
	}
	try {
		cached = (await import('ai')) as AiSdkModule;
	} catch {
		cached = null;
	}
	return cached;
}

/** Whether the optional `ai` SDK peer dependency is available at runtime. */
export async function isAiAvailable(): Promise<boolean> {
	return (await loadAiSdk()) !== null;
}

/** Reset the cached module. Intended for tests only. */
export function resetAiSdkCache(): void {
	cached = undefined;
}
