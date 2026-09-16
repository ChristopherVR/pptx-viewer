/** Install a live demo handle only in development; return its lifecycle cleanup. */
export function installDevViewerHandle(getHandle: () => unknown, development: boolean): () => void {
	if (!development || typeof window === 'undefined') {
		return () => {};
	}
	Object.defineProperty(window, '__pptxViewer', { configurable: true, get: getHandle });
	return () => {
		if (Object.getOwnPropertyDescriptor(window, '__pptxViewer')?.get === getHandle) {
			Reflect.deleteProperty(window, '__pptxViewer');
		}
	};
}
