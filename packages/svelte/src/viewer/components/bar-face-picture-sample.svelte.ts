/**
 * bar-face-picture-sample (Svelte): a rune-backed counter that bumps
 * whenever any bar3D face-picture colour sample resolves
 * (`chart-bar3d-face-picture-sample.ts`).
 *
 * `ChartView.svelte` reads `.value` inside its `view` `$derived.by`, purely
 * to establish a reactive dependency: the shared sample cache is a plain
 * module-level cache, not a rune, so Svelte would otherwise never know to
 * re-derive once a sample lands (an untargeted bar3D extrusion face whose
 * fill is picture-only samples the picture's own colour ASYNCHRONOUSLY - see
 * `resolveUntargetedBarFaceFill`'s doc comment for the COM-verified ground
 * truth this reproduces). Mirrors the equivalent Vue composable
 * (`use-bar-face-picture-sample-version.ts`) and React's inline
 * `useSyncExternalStore` wiring in `ChartElementView.tsx`; a runes-class,
 * matching this directory's own `ChartDragController` pattern
 * (`chart-drag.svelte.ts`).
 */
import {
	getBarFacePicturePixelSampleVersion,
	subscribeBarFacePicturePixelSamples,
} from 'pptx-viewer-shared';

export class BarFacePictureSampleVersion {
	private current = $state(getBarFacePicturePixelSampleVersion());
	private readonly unsubscribe: () => void;

	constructor() {
		this.unsubscribe = subscribeBarFacePicturePixelSamples(() => {
			this.current = getBarFacePicturePixelSampleVersion();
		});
	}

	get value(): number {
		return this.current;
	}

	/** Call once, on the owning component's teardown. */
	destroy(): void {
		this.unsubscribe();
	}
}
