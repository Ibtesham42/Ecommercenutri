"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Studio environment built procedurally from <Lightformer> panels — no external
 * HDRI / CDN fetch and no binary asset, so it works fully offline and adds no
 * weight beyond drei. These soft emissive panels are what the glossy product and
 * the reflective floor pick up as realistic studio reflections (the #1 thing that
 * reads as "premium"). `intensity` scales overall reflection strength per preset.
 */
export function ShowcaseEnvironment({
  intensity,
  resolution,
}: {
  intensity: number;
  resolution: number;
}) {
  return (
    <Environment resolution={resolution} environmentIntensity={intensity}>
      {/* Big soft key panel overhead */}
      <Lightformer
        intensity={2.2}
        position={[0, 4, 1]}
        scale={[10, 6, 1]}
        rotation={[Math.PI / 2, 0, 0]}
        color="#ffffff"
      />
      {/* Front fill */}
      <Lightformer intensity={1.0} position={[0, 1, 5]} scale={[9, 6, 1]} color="#dfeaff" />
      {/* Left + right edge strips → crisp rim highlights on glossy surfaces */}
      <Lightformer
        form="rect"
        intensity={1.6}
        position={[-5, 1.5, 1]}
        scale={[1.6, 6, 1]}
        rotation={[0, Math.PI / 2, 0]}
        color="#ffffff"
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        position={[5, 1.5, 1]}
        scale={[1.6, 6, 1]}
        rotation={[0, -Math.PI / 2, 0]}
        color="#ffffff"
      />
      {/* Back rim to separate the product from the backdrop */}
      <Lightformer intensity={1.2} position={[0, 2, -5]} scale={[8, 4, 1]} color="#ffffff" />
    </Environment>
  );
}
