/**
 * Inner Three.js scene for rendering 3D surface charts.
 *
 * Lazy-loaded by {@link SurfaceChart3D} so that Three.js is never
 * bundled when the consumer does not install the optional peer
 * dependencies (`three`, `@react-three/fiber`, `@react-three/drei`).
 *
 * @module SurfaceChart3DScene
 */

import React, { useMemo, useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurfaceChart3DSceneProps {
  /** Number of data categories (X axis points). */
  cols: number;
  /** Number of data series (Z axis points). */
  rows: number;
  /**
   * Normalised height values as a flat row-major array of length rows * cols.
   * Each value is in [0, 1].
   */
  heightMap: Float32Array;
  /**
   * RGB colour values as a flat array of length rows * cols * 3.
   * Each triplet is [r, g, b] in [0, 1].
   */
  colorMap: Float32Array;
  /** Whether to show wireframe grid lines on the surface. */
  wireframe: boolean;
  /** Category labels for the X axis. */
  categoryLabels: ReadonlyArray<string>;
  /** Series names for the Z axis. */
  seriesNames: ReadonlyArray<string>;
  /** Chart title (optional). */
  title?: string;
  /** Container width in pixels. */
  width: number;
  /** Container height in pixels. */
  height: number;
}

// ---------------------------------------------------------------------------
// Surface mesh component
// ---------------------------------------------------------------------------

function SurfaceMesh({
  cols,
  rows,
  heightMap,
  colorMap,
  wireframe,
}: {
  cols: number;
  rows: number;
  heightMap: Float32Array;
  colorMap: Float32Array;
  wireframe: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.LineSegments>(null);

  const { geometry, wireGeometry } = useMemo(() => {
    // Create a PlaneGeometry with subdivisions matching the data grid.
    // PlaneGeometry(width, depth, widthSegments, depthSegments) creates
    // (widthSegments+1) * (depthSegments+1) vertices.
    const widthSegs = cols - 1;
    const depthSegs = rows - 1;
    const gridWidth = Math.max(cols - 1, 1) * 0.5;
    const gridDepth = Math.max(rows - 1, 1) * 0.5;

    const geo = new THREE.PlaneGeometry(
      gridWidth,
      gridDepth,
      widthSegs,
      depthSegs,
    );

    // Rotate the plane so it lies in the XZ plane (default is XY).
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const vertexCount = pos.count;
    const colors = new Float32Array(vertexCount * 3);

    // Maximum height displacement (world units).
    const maxHeight = 1.5;

    for (let i = 0; i < vertexCount; i++) {
      // PlaneGeometry vertex order: row-by-row from top-left.
      // After the X-rotation, x maps to our col axis and z maps to our row axis.
      // The height (originally z in the plane, now y after rotation).
      const row = Math.floor(i / cols);
      const col = i % cols;
      const idx = row * cols + col;

      // Displace Y (height) based on data.
      const h = idx < heightMap.length ? heightMap[idx] : 0;
      pos.setY(i, h * maxHeight);

      // Vertex colours.
      const ci = idx * 3;
      colors[i * 3] = ci < colorMap.length ? colorMap[ci] : 0.5;
      colors[i * 3 + 1] = ci + 1 < colorMap.length ? colorMap[ci + 1] : 0.5;
      colors[i * 3 + 2] = ci + 2 < colorMap.length ? colorMap[ci + 2] : 0.5;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    pos.needsUpdate = true;

    // Create wireframe geometry from edges.
    const wireGeo = new THREE.WireframeGeometry(geo);

    return { geometry: geo, wireGeometry: wireGeo };
  }, [cols, rows, heightMap, colorMap]);

  return (
    <>
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhongMaterial
          vertexColors={true}
          side={THREE.DoubleSide}
          shininess={30}
          transparent
          opacity={0.92}
        />
      </mesh>
      {wireframe && (
        <lineSegments ref={wireRef} geometry={wireGeometry}>
          <lineBasicMaterial
            color={0x333333}
            transparent
            opacity={0.25}
            linewidth={1}
          />
        </lineSegments>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Axis labels (rendered as HTML overlays via drei's Html component)
// ---------------------------------------------------------------------------

function AxisLabels({
  cols,
  rows,
  categoryLabels,
  seriesNames,
}: {
  cols: number;
  rows: number;
  categoryLabels: ReadonlyArray<string>;
  seriesNames: ReadonlyArray<string>;
}) {
  const gridWidth = Math.max(cols - 1, 1) * 0.5;
  const gridDepth = Math.max(rows - 1, 1) * 0.5;

  // Show at most 8 category labels to avoid clutter
  const maxCatLabels = 8;
  const catStep = Math.max(1, Math.ceil(categoryLabels.length / maxCatLabels));

  // Show at most 6 series labels
  const maxSerLabels = 6;
  const serStep = Math.max(1, Math.ceil(seriesNames.length / maxSerLabels));

  return (
    <>
      {/* X-axis: category labels along the front edge */}
      {categoryLabels
        .filter((_, i) => i % catStep === 0)
        .map((label, fi) => {
          const i = fi * catStep;
          const x =
            -gridWidth / 2 + (i / Math.max(cols - 1, 1)) * gridWidth;
          return (
            <Html
              key={`cat-${i}`}
              position={[x, -0.15, gridDepth / 2 + 0.25]}
              center
              style={{
                fontSize: "9px",
                color: "#666",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {label}
            </Html>
          );
        })}

      {/* Z-axis: series names along the right edge */}
      {seriesNames
        .filter((_, i) => i % serStep === 0)
        .map((name, fi) => {
          const i = fi * serStep;
          const z =
            -gridDepth / 2 + (i / Math.max(rows - 1, 1)) * gridDepth;
          return (
            <Html
              key={`ser-${i}`}
              position={[gridWidth / 2 + 0.3, -0.15, z]}
              center
              style={{
                fontSize: "9px",
                color: "#666",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {name}
            </Html>
          );
        })}

      {/* Y-axis label */}
      <Html
        position={[-gridWidth / 2 - 0.35, 0.75, -gridDepth / 2]}
        center
        style={{
          fontSize: "9px",
          color: "#999",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}
      >
        Value
      </Html>
    </>
  );
}

// ---------------------------------------------------------------------------
// Auto-fit camera helper
// ---------------------------------------------------------------------------

function CameraFit({
  cols,
  rows,
}: {
  cols: number;
  rows: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const gridWidth = Math.max(cols - 1, 1) * 0.5;
    const gridDepth = Math.max(rows - 1, 1) * 0.5;
    const maxExtent = Math.max(gridWidth, gridDepth, 1.5);
    const dist = maxExtent * 1.8;

    // Position camera at isometric-like angle
    camera.position.set(dist * 0.8, dist * 0.7, dist * 0.8);
    camera.lookAt(0, 0.3, 0);
    camera.updateProjectionMatrix();
  }, [cols, rows, camera]);

  return null;
}

// ---------------------------------------------------------------------------
// Grid floor helper
// ---------------------------------------------------------------------------

function GridFloor({
  cols,
  rows,
}: {
  cols: number;
  rows: number;
}) {
  const gridWidth = Math.max(cols - 1, 1) * 0.5;
  const gridDepth = Math.max(rows - 1, 1) * 0.5;
  const size = Math.max(gridWidth, gridDepth) * 1.2;

  return (
    <gridHelper
      args={[size, Math.max(cols, rows), 0xcccccc, 0xe8e8e8]}
      position={[0, -0.02, 0]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main exported scene
// ---------------------------------------------------------------------------

export default function SurfaceChart3DScene({
  cols,
  rows,
  heightMap,
  colorMap,
  wireframe,
  categoryLabels,
  seriesNames,
  title,
  width,
  height,
}: SurfaceChart3DSceneProps) {
  return (
    <div
      style={{ width, height, position: "relative" }}
    >
      {title && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: "12px",
            fontWeight: 600,
            color: "#333",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {title}
        </div>
      )}
      <Canvas
        camera={{ position: [3, 2.5, 3], fov: 45 }}
        style={{ width, height, willChange: "transform" }}
        resize={{ debounce: 100 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />
        <directionalLight position={[-3, 4, -2]} intensity={0.3} />

        <CameraFit cols={cols} rows={rows} />
        <GridFloor cols={cols} rows={rows} />

        <SurfaceMesh
          cols={cols}
          rows={rows}
          heightMap={heightMap}
          colorMap={colorMap}
          wireframe={wireframe}
        />

        <AxisLabels
          cols={cols}
          rows={rows}
          categoryLabels={categoryLabels}
          seriesNames={seriesNames}
        />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2 + 0.3}
        />
      </Canvas>
    </div>
  );
}
