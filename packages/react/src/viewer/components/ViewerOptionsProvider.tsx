import type { ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';
import React from 'react';

import { ViewerOptionsContext, ViewerOptionsStoreContext } from './viewer-options-context';

/** Expose the viewer-owned store and its current immutable snapshot together. */
export function ViewerOptionsProvider({
	options,
	store,
	children,
}: {
	options: ViewerOptions;
	store: ViewerOptionsStore;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<ViewerOptionsStoreContext.Provider value={store}>
			<ViewerOptionsContext.Provider value={options}>{children}</ViewerOptionsContext.Provider>
		</ViewerOptionsStoreContext.Provider>
	);
}
