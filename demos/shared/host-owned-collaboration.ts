type HostStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export const externalSessionRequested = (): boolean =>
	new URLSearchParams(location.search).get('externalSession') === '1';

function serverUrl(params: URLSearchParams, configured: string): string {
	const raw = params.get('server') ?? (configured || 'ws://localhost:1234');
	const url = new URL(raw);
	const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	const configuredHost = configured ? new URL(configured).host : '';
	if (
		url.protocol !== 'wss:' &&
		!(url.protocol === 'ws:' && (loopback || url.host === configuredHost))
	) {
		throw new Error('Use a secure WebSocket relay or a local development server.');
	}
	return url.toString().replace(/\/$/u, '');
}

/** A complete host-owned session: the viewer receives only the public config. */
export async function createHostOwnedDemo(configuredServer = '') {
	const [{ Awareness }, { WebsocketProvider }, Y] = await Promise.all([
		import('y-protocols/awareness'),
		import('y-websocket'),
		import('yjs'),
	]);
	const params = new URLSearchParams(location.search);
	const roomId = params.get('room') || 'host-owned-demo';
	const relay = serverUrl(params, configuredServer);
	const sample = params.get('sample') === '1';
	// Every peer needs the same package resources; intent controls who may seed it.
	const response = await fetch(new URL('../../e2e/fixtures/sample-deck.pptx', import.meta.url));
	if (!response.ok) {
		throw new Error(`Sample load failed: ${response.status}`);
	}
	const source = new Uint8Array(await response.arrayBuffer());
	const doc = new Y.Doc();
	const awareness = new Awareness(doc);
	awareness.setLocalStateField('hostData', 'retained');
	const provider = new WebsocketProvider(relay, roomId, doc, { awareness, disableBc: true });
	const listeners = new Set<() => void>();
	let status: HostStatus = 'connecting';
	let paused = params.get('paused') === '1';
	let editorMounted = true;
	let updates = 0;
	const notify = (): void => {
		listeners.forEach((listener) => listener());
	};
	const onStatus = (event: { status: string }): void => {
		status =
			event.status === 'connected'
				? 'connected'
				: event.status === 'connecting'
					? 'connecting'
					: 'disconnected';
		notify();
	};
	const onUpdate = (): void => {
		updates += 1;
		notify();
	};
	provider.on('status', onStatus);
	provider.on('sync', notify);
	doc.on('update', onUpdate);
	const getSnapshot = (): { status: HostStatus; synced: boolean } => ({
		status,
		synced: provider.synced && !paused,
	});
	const subscribe = (listener: () => void): (() => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	};
	const config = {
		roomId,
		serverUrl: relay,
		userName: params.get('name') || 'Host demo',
		role: params.get('role') === 'viewer' ? ('viewer' as const) : ('collaborator' as const),
		sessionIntent:
			params.get('intent') === 'create' || (sample && params.get('intent') !== 'join')
				? ('create' as const)
				: ('join' as const),
		externalSession: { doc, awareness, getSnapshot, subscribe },
	};
	let panel: HTMLElement | null = null;
	let disposePanel: (() => void) | undefined;
	return {
		config,
		editable: params.get('editable') !== '0',
		source,
		fileName: 'sample-deck.pptx',
		/** Visible host controls, separate from the editor whose lifetime they govern. */
		attachControls(
			onMountChange: (mounted: boolean) => void,
			getContent?: () => Promise<Uint8Array | undefined>,
		): void {
			panel = document.createElement('section');
			panel.setAttribute('aria-label', 'Host-owned collaboration');
			panel.style.cssText =
				'position:fixed;inset:0 0 auto;z-index:100000;padding:8px 12px;background:#f8fafc;color:#0f172a;font:13px system-ui;display:flex;gap:12px;align-items:center;flex-wrap:wrap;min-height:64px;box-sizing:border-box;border-bottom:1px solid #cbd5e1';
			const readiness = document.createElement('button');
			const mount = document.createElement('button');
			const save = document.createElement('button');
			save.textContent = 'Save shared snapshot';
			const output = document.createElement('output');
			output.setAttribute('aria-label', 'Host session state');
			for (const button of [readiness, mount, save]) {
				button.type = 'button';
				button.style.cssText =
					'padding:6px 10px;border:1px solid #94a3b8;border-radius:4px;background:white;color:#0f172a;cursor:pointer';
			}
			const render = (): void => {
				readiness.textContent = paused ? 'Resume readiness' : 'Pause readiness';
				mount.textContent = editorMounted ? 'Unmount editor' : 'Remount editor';
				save.disabled = !editorMounted;
				output.textContent = `Host: ${status}; synced: ${getSnapshot().synced}; client: ${doc.clientID}; updates: ${updates}; host data: ${awareness.getLocalState()?.hostData}; editor: ${editorMounted ? 'mounted' : 'unmounted'}`;
			};
			readiness.onclick = () => {
				paused = !paused;
				notify();
			};
			mount.onclick = () => {
				editorMounted = !editorMounted;
				onMountChange(editorMounted);
				render();
			};
			save.onclick = () => {
				void getContent?.()
					.then((bytes) => {
						if (!bytes?.byteLength) {
							return;
						}
						const url = URL.createObjectURL(
							new Blob([new Uint8Array(bytes)], {
								type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
							}),
						);
						const link = document.createElement('a');
						link.href = url;
						link.download = 'sample-deck.pptx';
						link.click();
						setTimeout(() => URL.revokeObjectURL(url), 0);
						return undefined;
					})
					.catch((reason: unknown) => {
						output.textContent = `Save failed: ${String(reason)}`;
					});
			};
			disposePanel = subscribe(render);
			panel.append(readiness, mount, output);
			if (getContent) {
				panel.append(save);
			}
			document.body.append(panel);
			render();
		},
		dispose(): void {
			disposePanel?.();
			panel?.remove();
			provider.off('status', onStatus);
			provider.off('sync', notify);
			doc.off('update', onUpdate);
			listeners.clear();
			provider.destroy();
			awareness.destroy();
			doc.destroy();
		},
	};
}

export type HostOwnedDemo = Awaited<ReturnType<typeof createHostOwnedDemo>>;
