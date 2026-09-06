/**
 * The ONE mount / supersede / teardown state machine behind every Angular
 * interactive 3D chart renderer (bar3D, line3D, area3D, pie3D, surface3D).
 *
 * Each renderer lazily loads its shared `mount*Chart3D` fn and asks this
 * helper to keep exactly one live scene for the CURRENT options identity. The
 * mount is asynchronous (the shared fn awaits `three` before it appends its
 * canvas), which is where the five hand-written copies this replaces all
 * carried the same leak: their mount effect read the `handle` signal and
 * re-mounted whenever it was `null`, and the mount itself nulled that signal
 * (`teardown`) from inside the effect, so the effect re-fired while the first
 * mount was still in flight and started a second one for the SAME options.
 * Both then passed the "not superseded" identity check, the second silently
 * replaced the first without disposing it, and every re-render mid-gesture
 * left one more orphaned WebGL canvas in the scene container (nine of them
 * after one value drag). Here "already mounting" counts as mounted
 * ({@link Chart3DSceneMount.ensure}), so a re-fired effect is a no-op.
 *
 * Pure signal state, no `effect()`: the component owns the effect that calls
 * `ensure`, so this is unit-testable with a fake mount fn and no WebGL.
 *
 * @module chart-3d-scene-mount
 */
import { signal } from '@angular/core';

/** The subset of every `*Chart3DHandle` this helper needs. */
export interface Chart3DMountableHandle {
	/** `false` is the shared scenes' "`three` unavailable" sentinel (never a thrown error). */
	ok: boolean;
	dispose(): void;
}

export interface Chart3DSceneMountCallbacks {
	/** A mount resolved `ok: false`: the component switches to its SVG fallback. */
	onFailed: () => void;
}

export class Chart3DSceneMount<TOptions extends object, THandle extends Chart3DMountableHandle> {
	/** The live mounted handle, or `null` while unmounted / still loading. A
	 * signal so per-input effects (selection highlight, text style, resize)
	 * re-apply as soon as it, or the relevant input, changes. */
	readonly handle = signal<THandle | null>(null);

	/** The options identity the live (or in-flight) mount belongs to. */
	private mountedOptions: TOptions | null = null;

	constructor(private readonly callbacks: Chart3DSceneMountCallbacks) {}

	/**
	 * Keep one scene mounted for `options`: a no-op when that identity is
	 * already mounted OR MOUNTING, otherwise tears down the previous scene and
	 * starts `run`. A mount that resolves after newer options (or a teardown)
	 * superseded it is disposed straight away, never installed.
	 *
	 * `onMounted` runs on the resolved handle just before it becomes live, for
	 * the component to seed state (selection, text style) the scene should
	 * show on its first frame.
	 */
	ensure(
		options: TOptions,
		run: () => Promise<THandle>,
		onMounted?: (handle: THandle) => void,
	): void {
		if (this.mountedOptions === options) {
			return;
		}
		this.teardown();
		this.mountedOptions = options;
		void run().then((handle) => {
			// Newer data (or a teardown) superseded this mount while loading.
			if (this.mountedOptions !== options) {
				handle.dispose();
				return undefined;
			}
			if (!handle.ok) {
				handle.dispose();
				this.mountedOptions = null;
				this.callbacks.onFailed();
				return undefined;
			}
			onMounted?.(handle);
			this.handle.set(handle);
			return undefined;
		});
	}

	/**
	 * Dispose the live scene (if any) and forget the current options, so an
	 * in-flight mount for them is disposed on arrival instead of being
	 * installed into a destroyed component's detached container.
	 */
	teardown(): void {
		this.handle()?.dispose();
		this.handle.set(null);
		this.mountedOptions = null;
	}
}
