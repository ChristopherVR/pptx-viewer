import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Preserve the public object ref while making actual canvas mounts reactive. */
export function useViewportNode() {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	// Undefined preserves delayed initial attachment for legacy object-ref users.
	// Explicit null means a notified canvas unmount, so no retry is needed.
	const [viewportNode, setViewportNode] = useState<HTMLDivElement | null | undefined>(undefined);
	const previousNode = useRef<HTMLDivElement | null | undefined>(undefined);
	const setCanvasViewportNode = useCallback((node: HTMLDivElement | null) => {
		viewportRef.current = node;
		if (previousNode.current !== node) {
			previousNode.current = node;
			setViewportNode(node);
		}
	}, []);

	// Also reconcile legacy object-ref assignments when the hook owner commits.
	useLayoutEffect(() => {
		if (viewportRef.current !== null || previousNode.current !== undefined) {
			setCanvasViewportNode(viewportRef.current);
		}
	});

	return { viewportRef, viewportNode, setCanvasViewportNode };
}
