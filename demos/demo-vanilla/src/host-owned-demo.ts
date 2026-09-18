import { createPptxViewer } from 'pptx-vanilla-viewer';
import type { PptxViewerInstance } from 'pptx-vanilla-viewer';

import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
import { mountHostOwnedHeadlessEditor } from './host-owned-headless-editor';

export async function mountHostOwnedDemo(root: HTMLElement): Promise<void> {
	const host = await createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim());
	const headless = new URLSearchParams(location.search).get('headless') === '1';
	const shell = document.createElement('main');
	shell.style.cssText = `position:fixed;inset:${headless ? 104 : 64}px 0 0`;
	root.replaceChildren(shell);
	let viewer: PptxViewerInstance | undefined;
	let customShell: ReturnType<typeof mountHostOwnedHeadlessEditor> | undefined;
	const mount = (mounted: boolean): void => {
		viewer?.destroy();
		viewer = undefined;
		customShell?.destroy();
		customShell = undefined;
		shell.replaceChildren();
		if (mounted) {
			if (headless) {
				customShell = mountHostOwnedHeadlessEditor(shell, host);
			} else {
				viewer = createPptxViewer(shell, {
					source: host.source,
					fileName: host.fileName,
					collaboration: host.config,
					editable: host.editable,
				});
			}
		}
	};
	host.attachControls(
		mount,
		async () => (headless ? customShell?.getContent() : viewer?.getContent()),
		headless ? { setScale: (scale) => customShell?.setScale(scale) } : undefined,
	);
	mount(true);
	import.meta.hot?.dispose(() => {
		viewer?.destroy();
		customShell?.destroy();
		host.dispose();
	});
}
