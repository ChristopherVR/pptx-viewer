// ---------------------------------------------------------------------------
// Types for the orthogonal connector router
// ---------------------------------------------------------------------------

export interface RouterPoint {
  x: number;
  y: number;
}

export interface RouterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectorRouterOptions {
  start: RouterPoint;
  end: RouterPoint;
  obstacles: RouterRect[];
  canvasWidth: number;
  canvasHeight: number;
  /** Padding around obstacles (px). Default 12. */
  padding?: number;
  /** When true, only produce axis-aligned segments. Default true. */
  orthogonal?: boolean;
}
