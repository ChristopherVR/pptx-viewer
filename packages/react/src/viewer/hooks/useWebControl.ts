import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type Handlers = Record<string, (event: CustomEvent) => void>;

/**
 * Controlled binding for a shared `pptx-ui-*` element: pushes `state` onto the
 * element's `state` property after every render and routes its typed intent
 * events to the latest handlers. Listeners are re-attached after every render
 * so a conditionally rendered element is wired as soon as it mounts. Hosts
 * keep every effect; the element owns markup and gating.
 */
export function useWebControl<E extends HTMLElement & { state: unknown }>(
	state: E['state'],
	handlers: Handlers,
): RefObject<E | null> {
	const ref = useRef<E>(null);
	const latest = useRef(handlers);
	latest.current = handlers;
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = state;
		const attached = Object.keys(latest.current).map((name) => {
			const listener = (event: Event) => latest.current[name]?.(event as CustomEvent);
			host.addEventListener(name, listener);
			return [name, listener] as const;
		});
		return () => {
			for (const [name, listener] of attached) {
				host.removeEventListener(name, listener);
			}
		};
	});
	return ref;
}
