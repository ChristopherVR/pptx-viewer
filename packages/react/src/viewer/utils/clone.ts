/**
 * Deep-clone builders for editor state. The implementations are framework
 * agnostic and live in `pptx-viewer-shared`; this module re-exports them and
 * adapts `cloneHistorySnapshot` to the React-local `EditorHistorySnapshot` type
 * (which adds an optional `actionLabel` on top of the shared structural shape).
 */
import { cloneHistorySnapshot as cloneHistorySnapshotShared } from 'pptx-viewer-shared';
import type { HistorySnapshotLike } from 'pptx-viewer-shared';

import type { EditorHistorySnapshot } from '../types';

export {
	cloneTextStyle,
	cloneShapeStyle,
	cloneSlideTransition,
	cloneElementAnimation,
	cloneChartData,
	cloneSmartArtData,
	cloneElement,
	cloneSlide,
	cloneTemplateElementsBySlideId,
	cloneXmlObject,
} from 'pptx-viewer-shared';

/**
 * Deep-clone a history snapshot. Delegates to the shared implementation (which
 * rebuilds the structural fields and intentionally drops `actionLabel`, matching
 * the prior behaviour) and re-types the result as the React snapshot.
 */
export function cloneHistorySnapshot(snapshot: EditorHistorySnapshot): EditorHistorySnapshot {
	return cloneHistorySnapshotShared(snapshot as HistorySnapshotLike) as EditorHistorySnapshot;
}
