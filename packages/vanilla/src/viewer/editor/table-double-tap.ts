import { resolveTopLevelElementId } from './element-hit';

const DOUBLE_TAP_WINDOW_MS = 500;

interface TapRecord {
	key: string;
	time: number;
}

/** Find the rendered table cell beneath a touch, including below selection overlays. */
export function findTableTouchCell(
	event: PointerEvent,
	doc: Document,
): HTMLTableCellElement | null {
	if (event.pointerType !== 'touch') {
		return null;
	}
	const direct =
		event.target instanceof Element ? event.target.closest<HTMLTableCellElement>('td') : null;
	return (
		direct ??
		(doc
			.elementsFromPoint?.(event.clientX, event.clientY)
			.find((element) => element.localName === 'td') as HTMLTableCellElement | undefined) ??
		null
	);
}

export function resolveTableTouchTarget(event: PointerEvent, doc: Document, stage: Element | null) {
	const cell = findTableTouchCell(event, doc);
	const id = resolveTopLevelElementId(event.target, stage) ?? resolveTopLevelElementId(cell, stage);
	return { cell, id };
}

/** Recognize two touch pointer-down events on the same rendered table cell. */
export function createTableDoubleTapRecognizer(): (
	event: PointerEvent,
	id: string | null,
	cell?: HTMLTableCellElement | null,
) => boolean {
	let previous: TapRecord | null = null;
	return (event, id, resolvedCell) => {
		if (event.pointerType !== 'touch' || !(event.target instanceof Element)) {
			previous = null;
			return false;
		}
		const cell = resolvedCell ?? event.target.closest<HTMLTableCellElement>('td');
		if (!cell || !id) {
			previous = null;
			return false;
		}
		const key = `${id}:${cell.dataset.rowIndex}:${cell.dataset.cellIndex}`;
		const secondTap =
			previous?.key === key && event.timeStamp - previous.time <= DOUBLE_TAP_WINDOW_MS;
		previous = secondTap ? null : { key, time: event.timeStamp };
		return secondTap;
	};
}
