/** The host supplies these operations from its public custom-shell facade. */
export interface HostOwnedShellHandle {
	getContent: () => Promise<Uint8Array | undefined>;
	setScale: (scale: number) => void;
}

export async function downloadHostPresentation(
	getContent: HostOwnedShellHandle['getContent'],
	fileName: string,
): Promise<void> {
	const bytes = await getContent();
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
	link.download = fileName;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Host-authored controls: no full viewer toolbar or private state access. */
export function createHostOwnedShellControls(
	handle: HostOwnedShellHandle,
	reportError: (reason: unknown) => void,
) {
	const element = document.createElement('div');
	element.setAttribute('aria-label', 'Custom shell controls');
	element.style.cssText = 'display:flex;gap:12px;align-items:center;width:100%';
	const save = document.createElement('button');
	save.type = 'button';
	save.textContent = 'Save presentation';
	save.onclick = () => {
		void downloadHostPresentation(handle.getContent, 'sample-deck.pptx').catch(reportError);
	};
	const label = document.createElement('label');
	label.textContent = 'Zoom ';
	const zoom = document.createElement('select');
	zoom.setAttribute('aria-label', 'Custom shell zoom');
	for (const scale of [0.5, 1, 1.5, 2]) {
		const option = document.createElement('option');
		option.value = String(scale);
		option.textContent = `${scale * 100}%`;
		zoom.append(option);
	}
	zoom.value = '1';
	zoom.onchange = () => handle.setScale(Number(zoom.value));
	label.append(zoom);
	element.append(save, label);
	return {
		element,
		setMounted(mounted: boolean): void {
			save.disabled = !mounted;
			zoom.disabled = !mounted;
			if (!mounted) {
				zoom.value = '1';
			}
		},
	};
}
