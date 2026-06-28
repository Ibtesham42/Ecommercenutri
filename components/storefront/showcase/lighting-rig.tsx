"use client";

import { LIGHTS } from "@/lib/showcase-config";

/**
 * Classic 3-point rig (key / fill / rim) plus a low ambient lift. The HDRI-style
 * environment does most of the realistic work; these add directional shaping and
 * the (optional) soft shadow. `boost` lifts the key + rim for the spotlight preset.
 */
export function LightingRig({ shadows, boost = 1 }: { shadows: boolean; boost?: number }) {
  const { key, fill, rim } = LIGHTS;
  return (
    <>
      <ambientLight intensity={LIGHTS.ambient} />
      <directionalLight
        position={key.position}
        intensity={key.intensity * boost}
        color={key.color}
        castShadow={shadows}
        shadow-mapSize-width={LIGHTS.shadowMapSize}
        shadow-mapSize-height={LIGHTS.shadowMapSize}
        shadow-bias={-0.0002}
      />
      <directionalLight position={fill.position} intensity={fill.intensity} color={fill.color} />
      <directionalLight position={rim.position} intensity={rim.intensity * boost} color={rim.color} />
    </>
  );
}
