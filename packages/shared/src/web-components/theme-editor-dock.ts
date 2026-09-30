/** The same editor-body anchor works even when a native adapter lives in the ribbon. */
export function attachThemeEditorDock(host: HTMLElement): () => void {
	if (host.hasAttribute('inline')) {
		return () => {};
	}
	const body = host
		.closest('[data-pptx-editor-chrome]')
		?.querySelector<HTMLElement>('[data-pptx-chrome="body"]');
	const position = (): void => {
		const rect = body?.getBoundingClientRect();
		const top = Math.max(0, rect?.top ?? 0);
		const bottom = Math.min(window.innerHeight, rect?.bottom ?? window.innerHeight);
		const left = Math.max(0, rect?.left ?? 0);
		const right = Math.min(window.innerWidth, rect?.right ?? window.innerWidth);
		const narrow = right - left < 768;
		const width = narrow ? right - left : Math.min(288, right - left);
		const height = Math.max(0, bottom - top) * (narrow ? 0.6 : 1);
		Object.assign(host.style, {
			left: `${right - width}px`,
			top: `${bottom - height}px`,
			width: `${width}px`,
			height: `${height}px`,
		});
	};
	position();
	const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position);
	if (body) {
		observer?.observe(body);
	}
	window.addEventListener('resize', position);
	window.addEventListener('scroll', position, true);
	return () => {
		observer?.disconnect();
		window.removeEventListener('resize', position);
		window.removeEventListener('scroll', position, true);
	};
}
