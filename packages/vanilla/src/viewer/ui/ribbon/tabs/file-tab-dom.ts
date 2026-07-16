import { createFileTabIcon } from './file-tab-icons';
import type { FileTabIcon } from './file-tab-icons';

export function button(
	doc: Document,
	label: string,
	onClick: () => void,
	className?: string,
): HTMLButtonElement {
	const result = doc.createElement('button');
	result.type = 'button';
	result.textContent = label;
	if (className) {
		result.className = className;
	}
	result.addEventListener('click', onClick);
	return result;
}

export function iconButton(
	doc: Document,
	icon: FileTabIcon,
	onClick: () => void,
	className?: string,
): HTMLButtonElement {
	const result = button(doc, '', onClick, className);
	result.appendChild(createFileTabIcon(doc, icon));
	return result;
}

export function labeledIconButton(
	doc: Document,
	icon: FileTabIcon,
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const result = iconButton(doc, icon, onClick);
	const text = doc.createElement('span');
	text.textContent = label;
	result.appendChild(text);
	return result;
}
