/**
 * group-ops: pure, immutable group/ungroup operations for the slide element
 * tree, shared by every binding's editor.
 *
 * The implementation itself lives in `pptx-viewer-core`
 * (`core/utils/group-ops`) and is re-exported here unchanged, because the
 * `pptx-viewer-mcp` tool set that backs the AI panel needs the SAME operation
 * and cannot import this package: `pptx-viewer-mcp` is published, this one is
 * private and already imports it. Core is the only module all three consumers
 * reach, and one implementation cannot drift from itself: the MCP copy had
 * already drifted into appending a grouped selection to the front of the paint
 * order and re-iding nothing when promoting a nested group.
 *
 * Coordinate system (verified from the renderer):
 *   - The group <div> is positioned at (group.x, group.y) in slide space.
 *   - Each child is positioned at (child.x, child.y) RELATIVE to the group's
 *     top-left corner inside that div.
 *
 * Therefore:
 *   - grouping   -> child slide-absolute -> child group-relative:
 *       childRelX = childAbsX - groupX
 *   - ungrouping -> child group-relative -> child slide-absolute:
 *       childAbsX = childRelX + groupX
 */

export {
	groupElements,
	ungroupElements,
	type GroupResult,
	type UngroupOptions,
	type UngroupResult,
} from 'pptx-viewer-core';
