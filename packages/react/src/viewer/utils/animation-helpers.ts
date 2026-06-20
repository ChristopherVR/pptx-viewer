/**
 * Thin adapter shim. The pure native-animation helpers (`resolveEffect`,
 * `buildDynamicKeyframes`, `cssKeyframeName`, `defaultDuration`,
 * `fillModeForClass`) now live in `pptx-viewer-shared`
 * (`render/animation-timeline-helpers`). Only `readFileAsDataUrl`, which uses
 * the DOM `FileReader`, stays in the React binding.
 */
export {
	resolveEffect,
	buildDynamicKeyframes,
	cssKeyframeName,
	defaultDuration,
	fillModeForClass,
} from 'pptx-viewer-shared';

// ==========================================================================
// File reading utility (DOM `FileReader`, binding-only)
// ==========================================================================

export async function readFileAsDataUrl(file: File): Promise<string> {
	return await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== 'string') {
				reject(new Error('Failed to read image file.'));
				return;
			}
			resolve(result);
		};
		reader.onerror = () => {
			reject(new Error('Failed to read image file.'));
		};
		reader.readAsDataURL(file);
	});
}
