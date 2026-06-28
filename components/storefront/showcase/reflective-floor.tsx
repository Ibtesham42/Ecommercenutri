"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { FLOOR } from "@/lib/showcase-config";

/**
 * Faint mirror floor under the product (drei MeshReflectorMaterial) — the Apple
 * "product on glass" look. Reflection resolution + presence are tier-gated by the
 * caller; the material is declarative so R3F disposes its render target on unmount.
 * The soft contact shadow is handled separately in product-plane (alpha-shaped).
 */
export function ReflectiveFloor({
  color,
  resolution,
}: {
  color: string;
  resolution: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR.y, 0]} receiveShadow>
      <planeGeometry args={[FLOOR.size, FLOOR.size]} />
      <MeshReflectorMaterial
        resolution={resolution}
        mirror={FLOOR.mirror}
        mixStrength={FLOOR.mixStrength}
        blur={FLOOR.blur}
        roughness={FLOOR.roughness}
        metalness={FLOOR.metalness}
        color={color}
        depthScale={1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
      />
    </mesh>
  );
}
