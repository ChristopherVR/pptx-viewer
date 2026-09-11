/** Open a chart-title input; Enter/blur commit and Escape cancels. */
export function createChartTitleEditor(
	container: HTMLElement,
	onCommit: (value: string) => void,
): (initialValue: string) => void {
	let activeInput: HTMLInputElement | null = null;
	const close = (input = activeInput): void => {
		if (!input || input !== activeInput) {
			return;
		}
		// Removing a focused input can synchronously fire its blur handler.
		activeInput = null;
		input.remove();
	};

	return (initialValue): void => {
		close();
		const input = container.ownerDocument.createElement('input');
		activeInput = input;
		input.type = 'text';
		input.className = 'pptxv-chart-title-input';
		input.value = initialValue;
		const commit = (): void => {
			if (input !== activeInput) {
				return;
			}
			const value = input.value;
			close(input);
			onCommit(value);
		};
		input.addEventListener('blur', commit, { once: true });
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				commit();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				close(input);
			}
			event.stopPropagation();
		});
		input.addEventListener('pointerdown', (event) => event.stopPropagation());
		input.addEventListener('dblclick', (event) => event.stopPropagation());
		container.appendChild(input);
		input.focus();
		input.select();
	};
}
