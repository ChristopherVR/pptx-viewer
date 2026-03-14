/**
 * Inner Three.js scene component for rendering 3D models (GLB/GLTF).
 *
 * This file is lazy-loaded by {@link Model3DRenderer} so that Three.js
 * is never bundled when the consumer does not install the optional
 * `three` / `@react-three/fiber` / `@react-three/drei` peer dependencies.
 *
 * @module Model3DScene
 */

import React, { Suspense, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, useGLTF } from "@react-three/drei";
import type { Group } from "three";
import { Box3, Vector3 } from "three";

// ---------------------------------------------------------------------------
// ModelLoader – loads the GLB/GLTF and auto-scales to fit
// ---------------------------------------------------------------------------

function ModelLoader({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;
    // Auto-fit: normalise the model so it fills roughly a 2-unit cube
    const box = new Box3().setFromObject(groupRef.current);
    const size = new Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 2 / maxDim;
      groupRef.current.scale.setScalar(scale);
    }
    // Centre the model at the origin
    const center = new Vector3();
    box.getCenter(center);
    groupRef.current.position.sub(center.multiplyScalar(groupRef.current.scale.x));
  }, [scene]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Model3DScene – the exported default used by React.lazy()
// ---------------------------------------------------------------------------

export interface Model3DSceneProps {
  modelUrl: string;
  interactive: boolean;
  width: number;
  height: number;
}

export default function Model3DScene({
  modelUrl,
  interactive,
  width,
  height,
}: Model3DSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{
        width,
        height,
        willChange: "transform",
      }}
      // Disable default resize observer to avoid layout thrashing
      resize={{ debounce: 100 }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, -3, 2]} intensity={0.3} />
      <Suspense fallback={null}>
        <Center>
          <ModelLoader url={modelUrl} />
        </Center>
      </Suspense>
      {interactive && (
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={20}
        />
      )}
    </Canvas>
  );
}
