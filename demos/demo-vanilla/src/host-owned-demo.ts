import { createPptxViewer } from 'pptx-vanilla-viewer';
import type { PptxViewerInstance } from 'pptx-vanilla-viewer';

import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';

export async function mountHostOwnedDemo(root: HTMLElement): Promise<void> {
	const host = await createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim());
	const shell = document.createElement('main');
	shell.style.cssText = 'position:fixed;inset:64px 0 0';
	root.replaceChildren(shell);
	let viewer: PptxViewerInstance | undefined;
	const mount = (mounted: boolean): void => {
		viewer?.destroy();
		viewer = undefined;
		shell.replaceChildren();
		if (mounted) {
			viewer = createPptxViewer(shell, {
				source: host.source,
				fileName: host.fileName,
				collaboration: host.config,
				editable: host.editable,
			});
		}
	};
	host.attachControls(mount, async () => viewer?.getContent());
	mount(true);
	import.meta.hot?.dispose(() => {
		viewer?.destroy();
		host.dispose();
	});
}
