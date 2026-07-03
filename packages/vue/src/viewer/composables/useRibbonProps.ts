import { computed } from 'vue';
import type { ComputedRef } from 'vue';

import type { RibbonProps } from '../components/ribbon/ribbon-types';
import { buildRibbonPropsActions } from './ribbon-props-actions';
import { buildRibbonPropsState } from './ribbon-props-state';
import type { UseRibbonPropsInput } from './ribbon-props-types';

export type {
	UseRibbonPropsActionsInput,
	UseRibbonPropsInput,
	UseRibbonPropsStateInput,
} from './ribbon-props-types';

/**
 * useRibbonProps: adapts the editor's state and handlers into the `RibbonProps`
 * contract consumed by `RibbonToolbar` / `MobileToolbar`. Capabilities the host
 * does not yet expose (drawing tools, grid/ruler/snap, theme gallery, flip,
 * action buttons, layout gallery) are wired as no-ops for now; the ribbon
 * renders faithfully and the core actions are live.
 *
 * The state fields and the callback fields are built by
 * `buildRibbonPropsState` / `buildRibbonPropsActions` respectively (split out
 * to keep every ribbon-props file under the repo's ~300 LOC convention);
 * this composable just merges them into the `computed<RibbonProps>` the
 * template binds with `v-bind`. Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useRibbonProps(input: UseRibbonPropsInput): ComputedRef<RibbonProps> {
	return computed<RibbonProps>(() => ({
		...buildRibbonPropsState(input),
		...buildRibbonPropsActions(input),
	}));
}
