"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace } from "three";
import { showcaseMotion, isShowcaseBackground } from "@/lib/showcase";
import {
  BACKGROUND_SCENE,
  ENV,
  PRODUCT,
  TIER,
  TONEMAPPING,
  floatAmplitude,
  productScale,
  spinSecondsPerRev,
  type PerfTier,
} from "@/lib/showcase-config";
import { useShowcaseParallax } from "./use-showcase-parallax";
import { ShowcaseEnvironment } from "./environment";
import { LightingRig } from "./lighting-rig";
import { ReflectiveFloor } from "./reflective-floor";
import { ProductPlane } from "./product-plane";
import { CameraRig } from "./camera-rig";
import { Effects } from "./effects";
import type { ShowcaseSceneItem } from "./types";

/** Vertical gradient texture for the soft backdrop (no asset). */
function makeGradient(top: string, bottom: string): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Far, unlit gradient plane → real z-separation; DoF blurs it for depth. */
function Backdrop({ top, bottom }: { top: string; bottom: string }) {
  const tex = useMemo(() => makeGradient(top, bottom), [top, bottom]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 1, -6]} scale={[36, 22, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

export function Scene({
  item,
  tier,
  reduced,
}: {
  item: ShowcaseSceneItem;
  tier: PerfTier;
  reduced: boolean;
}) {
  const { gl } = useThree();
  const motion = showcaseMotion(item.animation);
  const bgKey = isShowcaseBackground(item.background) ? item.background : "aurora";
  const sc = BACKGROUND_SCENE[bgKey];
  const t = TIER[tier];

  // Per-preset tone-mapping exposure (restored on preset change/unmount).
  useEffect(() => {
    gl.toneMappingExposure = sc.exposure;
    return () => {
      gl.toneMappingExposure = TONEMAPPING.exposure;
    };
  }, [gl, sc.exposure]);

  const scale = productScale(item.zoom);
  const floatAmp = floatAmplitude(item.floatIntensity, motion.float && !reduced);
  const spinSeconds = motion.spin && !reduced ? spinSecondsPerRev(item.rotationSpeed) : 0;
  const parallax = useShowcaseParallax(motion.tilt && !reduced);

  return (
    <>
      <Backdrop top={sc.backdropTop} bottom={sc.backdropBottom} />
      <ShowcaseEnvironment
        intensity={sc.envIntensity * ENV.intensity}
        resolution={ENV.resolution}
      />
      <LightingRig shadows={t.shadows} boost={motion.spotlight ? 1.35 : 1} />
      <ProductPlane
        src={item.src}
        scale={scale}
        floatAmp={floatAmp}
        spinSeconds={spinSeconds}
        swayDeg={PRODUCT.swayDeg}
        parallax={parallax}
        reduced={reduced}
      />
      <ReflectiveFloor color={sc.floorColor} resolution={t.floorResolution} />
      <CameraRig reduced={reduced} rotationSpeed={item.rotationSpeed} parallax={parallax} />
      <Effects tier={tier} spotlight={motion.spotlight} />
    </>
  );
}
