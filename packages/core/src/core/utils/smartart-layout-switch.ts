import type { PptxSmartArtData, SmartArtLayoutType } from "../types";

/**
 * Supported layout types for the visual layout switcher.
 *
 * These are the layout categories that have dedicated renderers
 * in SmartArtRenderer and can be switched between while preserving
 * node data and connections.
 */
export const SWITCHABLE_LAYOUT_TYPES: readonly SmartArtLayoutType[] = [
  "process",
  "hierarchy",
  "cycle",
  "matrix",
  "pyramid",
  "list",
] as const;

/**
 * Switch a SmartArt diagram to a new layout type while preserving node data.
 *
 * This function creates a new `PptxSmartArtData` with the layout type changed
 * but all node content, connections, colours, and styles intact.
 *
 * @param currentData The existing SmartArt data
 * @param newLayoutType The target layout category
 * @returns Updated SmartArt data with the new layout applied
 */
export function switchSmartArtLayout(
  currentData: PptxSmartArtData,
  newLayoutType: SmartArtLayoutType,
): PptxSmartArtData {
  // If the layout is already the target, return as-is
  if (currentData.resolvedLayoutType === newLayoutType) {
    return currentData;
  }

  return {
    ...currentData,
    // Clear the raw layoutType string since the user is explicitly
    // choosing a resolved category — this avoids the heuristic
    // re-resolve overriding their choice.
    layoutType: newLayoutType,
    resolvedLayoutType: newLayoutType,
    // Clear the named layout preset — switching category invalidates it
    layout: undefined,
    // Preserve everything else: nodes, connections, colours, styles, chrome, etc.
  };
}

/**
 * Check whether a layout type is one of the supported switchable types.
 */
export function isSwitchableLayoutType(
  layoutType: SmartArtLayoutType,
): boolean {
  return (SWITCHABLE_LAYOUT_TYPES as readonly string[]).includes(layoutType);
}
