import { insertSvg } from './ribbon-insert-dom';

export interface InsertClusterOption {
	value: string;
	label: string;
}

export interface InsertCluster {
	el: HTMLElement;
	select: HTMLSelectElement;
	button: HTMLButtonElement;
	sync(options: {
		choices: readonly InsertClusterOption[];
		value: string;
		selectLabel: string;
		buttonLabel: string;
		buttonTitle: string;
		disabled: boolean;
		glyph: { path: string; viewBox: string; transform: string };
	}): void;
}

/** A type picker beside an insert button (Shape, Chart). The host owns the staged type. */
export function createInsertCluster(
	doc: Document,
	control: string,
	pickType: (value: string) => void,
	insert: () => void,
): InsertCluster {
	const el = doc.createElement('div');
	el.className = 'cluster';
	el.dataset.ribbonControl = control;
	const select = doc.createElement('pptx-ui-select') as unknown as HTMLSelectElement;
	const button = doc.createElement('button');
	button.type = 'button';
	button.className = 'pick';
	button.dataset.pptxCompact = '';
	const text = doc.createElement('span');
	let glyphKey = '';
	select.addEventListener('change', () => pickType(select.value));
	button.addEventListener('click', insert);
	button.addEventListener('keydown', (event) => {
		if (event.key === ' ' || event.key === 'Enter') {
			event.stopPropagation();
		}
	});
	el.append(select, button);
	return {
		el,
		select,
		button,
		sync({ choices, value, selectLabel, buttonLabel, buttonTitle, disabled, glyph }) {
			const key = choices.map((item) => `${item.value}:${item.label}`).join('|');
			if (select.dataset.key !== key) {
				select.dataset.key = key;
				select.replaceChildren(
					...choices.map((item) => {
						const option = doc.createElement('option');
						option.value = item.value;
						option.textContent = item.label;
						return option;
					}),
				);
			}
			select.value = value;
			select.disabled = disabled;
			select.setAttribute('aria-label', selectLabel);
			select.title = selectLabel;
			text.textContent = buttonLabel;
			button.title = buttonTitle;
			button.disabled = disabled;
			const nextGlyph = `${glyph.path}|${glyph.viewBox}|${glyph.transform}`;
			if (nextGlyph !== glyphKey) {
				glyphKey = nextGlyph;
				const svg = insertSvg(doc, glyph.path, glyph.viewBox);
				svg.style.transform = glyph.transform;
				button.replaceChildren(svg, text);
			}
		},
	};
}
