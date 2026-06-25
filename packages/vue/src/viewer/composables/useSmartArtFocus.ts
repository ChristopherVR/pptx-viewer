import { nextTick, ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Focus management for the SmartArt text-pane node inputs.
 *
 * The SFC registers each node's `<input>` element via {@link SmartArtFocusApi.setInputEl};
 * after a structural edit (add / remove / move / promote / demote) the composable
 * sets `pendingFocusId` and focuses the matching input on the next tick. This is
 * the Vue equivalent of the React `pendingFocusId` ref + `useEffect` pattern.
 *
 * @module useSmartArtFocus
 */

export interface SmartArtFocusApi {
	/** Id of the node input that should receive focus after the next render. */
	pendingFocusId: Ref<string | null>;
	/** Register / unregister a node's `<input>` element. */
	setInputEl: (nodeId: string, el: HTMLInputElement | null) => void;
	/** Request focus for `nodeId` (no-op when undefined). */
	focusNode: (nodeId: string | undefined) => void;
}

export function useSmartArtFocus(): SmartArtFocusApi {
	const inputEls = new Map<string, HTMLInputElement>();
	const pendingFocusId = ref<string | null>(null);

	function setInputEl(nodeId: string, el: HTMLInputElement | null): void {
		if (el) {
			inputEls.set(nodeId, el);
		} else {
			inputEls.delete(nodeId);
		}
	}

	function focusNode(nodeId: string | undefined): void {
		if (!nodeId) {
			return;
		}
		pendingFocusId.value = nodeId;
		void nextTick(() => {
			if (pendingFocusId.value === nodeId) {
				inputEls.get(nodeId)?.focus();
				pendingFocusId.value = null;
			}
		});
	}

	return { pendingFocusId, setInputEl, focusNode };
}
