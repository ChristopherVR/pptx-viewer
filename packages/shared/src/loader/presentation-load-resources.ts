/** Keep a load's resources private until the binding accepts its result. */
export function createPresentationLoadResources(handler: { dispose(): void }) {
	const blobUrls: string[] = [];
	let committed = false;
	let released = false;
	return {
		blobUrls,
		/** The live viewer now owns the handler and media URLs. */
		commit(): void {
			committed = true;
		},
		/** Call in finally, after pending asset reads have settled. */
		releaseIfUncommitted(): void {
			if (committed || released) {
				return;
			}
			released = true;
			handler.dispose();
			for (const url of blobUrls) {
				if (url.startsWith('blob:')) {
					URL.revokeObjectURL(url);
				}
			}
		},
	};
}
