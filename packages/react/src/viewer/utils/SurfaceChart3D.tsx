/**
 * 3D Surface Chart renderer using Three.js.
 *
 * Lazy-loads the Three.js scene ({@link SurfaceChart3DScene}) so that
 * Three.js is never bundled when the consumer does not install the
 * optional peer dependencies (`three`, `@react-three/fiber`,
 * `@react-three/drei`).
 *
 * Falls back to the existing SVG isometric renderer when Three.js is
 * not available or fails to load.
 *
 * @module SurfaceChart3D
 */

import React, { Suspense, useState, useEffect, useMemo } from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { computeValueRangeForChart } from "./chart-helpers";
import { surfaceColor } from "./chart-surface-treemap";

// ---------------------------------------------------------------------------
// Lazy-loaded Three.js scene
// ---------------------------------------------------------------------------

/** Stub rendered when the dynamic import fails (Three.js not installed). */
function FailedToLoad() {
  return null;
}

const LazySurfaceChart3DScene = React.lazy(
  async (): Promise<{
    default: React.ComponentType<
      import("./SurfaceChart3DScene").SurfaceChart3DSceneProps
    >;
  }> => {
    try {
      return await import("./SurfaceChart3DScene");
    } catch {
      return { default: FailedToLoad };
    }
  },
);

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
}

class SurfaceChart3DErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback: React.ReactNode;
  },
  ErrorBoundaryState
> {
  constructor(props: {
    children: React.ReactNode;
    fallback: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Data preparation helpers
// ---------------------------------------------------------------------------

/**
 * Build the height map and colour map arrays consumed by the 3D scene.
 *
 * Returns Float32Arrays for efficient transfer to the GPU vertex buffers.
 */
function buildSurfaceData(
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): {
  heightMap: Float32Array;
  colorMap: Float32Array;
  rows: number;
  cols: number;
} {
  const rows = chartData.series.length;
  const cols = Math.max(categoryLabels.length, 1);
  const range = computeValueRangeForChart(chartData.series, chartData.axes);

  const heightMap = new Float32Array(rows * cols);
  const colorMap = new Float32Array(rows * cols * 3);

  for (let r = 0; r < rows; r++) {
    const series = chartData.series[r];
    for (let c = 0; c < cols; c++) {
      const val = series?.values[c] ?? 0;
      const t = range.span > 0 ? (val - range.min) / range.span : 0;
      const idx = r * cols + c;
      heightMap[idx] = t;

      // Use the same blue-green-red colour ramp as the 2D renderer.
      const { r: cr, g: cg, b: cb } = surfaceColor(t);
      colorMap[idx * 3] = cr / 255;
      colorMap[idx * 3 + 1] = cg / 255;
      colorMap[idx * 3 + 2] = cb / 255;
    }
  }

  return { heightMap, colorMap, rows, cols };
}

// ---------------------------------------------------------------------------
// Loading placeholder
// ---------------------------------------------------------------------------

function LoadingPlaceholder({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        border: "1px dashed #cbd5e1",
        borderRadius: 4,
        fontSize: 11,
        color: "#94a3b8",
      }}
    >
      Loading 3D surface...
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface SurfaceChart3DProps {
  element: PptxElement;
  chartData: PptxChartData;
  categoryLabels: ReadonlyArray<string>;
  /** Fallback React node to render when Three.js is not available. */
  fallback: React.ReactNode;
}

/**
 * Render a surface chart as an interactive 3D surface using Three.js.
 *
 * Falls back to the provided `fallback` (typically the SVG isometric
 * renderer) when Three.js is not installed or an error occurs.
 */
export const SurfaceChart3D = React.memo(function SurfaceChart3D({
  element,
  chartData,
  categoryLabels,
  fallback,
}: SurfaceChart3DProps) {
  const [threeAvailable, setThreeAvailable] = useState<boolean | null>(null);

  // Probe for Three.js availability once on mount.
  useEffect(() => {
    let cancelled = false;
    import("@react-three/fiber")
      .then(() => {
        if (!cancelled) setThreeAvailable(true);
      })
      .catch(() => {
        if (!cancelled) setThreeAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Prepare surface data arrays.
  const surfaceData = useMemo(
    () => buildSurfaceData(chartData, categoryLabels),
    [chartData, categoryLabels],
  );

  const seriesNames = useMemo(
    () => chartData.series.map((s) => s.name),
    [chartData.series],
  );

  // Still probing -- show loading placeholder.
  if (threeAvailable === null) {
    return (
      <LoadingPlaceholder width={element.width} height={element.height} />
    );
  }

  // Three.js not available -- use the 2D fallback.
  if (!threeAvailable) {
    return <>{fallback}</>;
  }

  return (
    <SurfaceChart3DErrorBoundary fallback={fallback}>
      <Suspense
        fallback={
          <LoadingPlaceholder
            width={element.width}
            height={element.height}
          />
        }
      >
        <LazySurfaceChart3DScene
          cols={surfaceData.cols}
          rows={surfaceData.rows}
          heightMap={surfaceData.heightMap}
          colorMap={surfaceData.colorMap}
          wireframe={true}
          categoryLabels={categoryLabels}
          seriesNames={seriesNames}
          title={chartData.title}
          width={element.width}
          height={element.height}
        />
      </Suspense>
    </SurfaceChart3DErrorBoundary>
  );
});
