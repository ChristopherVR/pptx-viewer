/**
 * Apply the host's dialog customisation to the ribbon's dialog entry points.
 *
 * The ribbon, the mobile toolbar and the File tab all open File > Options,
 * Print and Share through three `RibbonProps` callbacks. Withdrawing a
 * callback the host removed (through `hiddenDialogs`, or a disabled feature)
 * hides every control that is gated on the callback being wired (Review >
 * Language, File > Options) and turns the rest into no-ops, from one place.
 * The decision itself is the shared `isDialogAvailable`.
 */
import { isDialogAvailable } from 'pptx-viewer-shared';
import type { ResolvedCustomization } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { RibbonProps } from '../components/ribbon/ribbon-types';

const noop = (): void => {};

/** `props` with the Options / Print / Share openers removed when unavailable. */
export function gateRibbonDialogEntries(
	props: RibbonProps,
	resolved: ResolvedCustomization,
): RibbonProps {
	const options = isDialogAvailable(resolved, 'options');
	const print = isDialogAvailable(resolved, 'print');
	const share = isDialogAvailable(resolved, 'share');
	if (options && print && share) {
		return props;
	}
	return {
		...props,
		onOpenSettings: options ? props.onOpenSettings : undefined,
		onPrint: print ? props.onPrint : noop,
		onOpenShareDialog: share ? props.onOpenShareDialog : undefined,
	};
}

/** Reactive {@link gateRibbonDialogEntries} over the viewer's ribbon props. */
export function useCustomizedRibbonProps(
	ribbonProps: ComputedRef<RibbonProps>,
	resolved: Ref<ResolvedCustomization>,
): ComputedRef<RibbonProps> {
	return computed(() => gateRibbonDialogEntries(ribbonProps.value, resolved.value));
}
