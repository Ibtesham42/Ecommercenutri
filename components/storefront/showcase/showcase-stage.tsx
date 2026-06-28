"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { CAMERA, TIER, TONEMAPPING } from "@/lib/showcase-config";
import { usePerfTier } from "./use-perf-tier";
import { Scene } from "./scene";
import type { ShowcaseSceneItem } from "./types";

/**
 * Client-only WebGL stage — dynamically imported with `ssr:false` by the wrapper,
 * so three never runs on the server and never blocks first paint. The render loop
 * runs only while on-screen + visible + not reduced-motion (`frameloop` switches
 * to "demand", which renders once then idles). Default export for next/dynamic.
 */
export default function ShowcaseStage({
  item,
  active,
  reduced,
}: {
  item: ShowcaseSceneItem;
  active: boolean;
  reduced: boolean;
}) {
  const tier = usePerfTier();
  const t = TIER[tier];
  const frameloop: "always" | "demand" = active && !reduced ? "always" : "demand";

  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, t.maxDpr]}
      shadows={t.shadows}
      gl={{ antialias: tier === "high", powerPreference: "high-performance", alpha: false }}
      camera={{ position: CAMERA.position, fov: CAMERA.fov }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = TONEMAPPING.exposure;
        // Allow the context to be restored after a loss instead of dying.
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => e.preventDefault(),
          false,
        );
      }}
    >
      <Suspense fallback={null}>
        <Scene item={item} tier={tier} reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}
