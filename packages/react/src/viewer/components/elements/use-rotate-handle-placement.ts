import { attachRotateHandlePlacement } from 'pptx-viewer-shared';
import { useLayoutEffect, useRef } from 'react';

export function useRotateHandlePlacement(elementId: string, enabled: boolean) {
	const ref = useRef<HTMLButtonElement>(null);
	useLayoutEffect(() => {
		const button = ref.current;
		if (!enabled || !button) {
			return;
		}
		return attachRotateHandlePlacement(button, {
			stem: button.querySelector('[data-pptx-rotate-stem]'),
		});
		// React can reuse this DOM button for another selected element.
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- A selection change starts a new placement lifetime.
	}, [elementId, enabled]);
	return ref;
}
