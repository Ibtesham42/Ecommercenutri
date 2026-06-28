"use client";

import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import { EFFECTS, type PerfTier } from "@/lib/showcase-config";

/**
 * Subtle cinematic grade — this is what turns a "3D image" into something
 * video-like. Kept restrained on purpose (overdone bloom looks cheap). On the low
 * tier the DepthOfField pass is dropped entirely (and bloom mipmap blur off) — the
 * composer is branched rather than passing a conditional/null child, which the
 * composer's typings/runtime don't accept.
 */
export function Effects({ tier, spotlight }: { tier: PerfTier; spotlight: boolean }) {
  const high = tier === "high";
  const vig = spotlight ? EFFECTS.spotlightVignette : EFFECTS.vignette;

  const bloom = (
    <Bloom
      intensity={EFFECTS.bloom.intensity}
      luminanceThreshold={EFFECTS.bloom.luminanceThreshold}
      luminanceSmoothing={EFFECTS.bloom.luminanceSmoothing}
      mipmapBlur={high && EFFECTS.bloom.mipmapBlur}
      radius={EFFECTS.bloom.radius}
    />
  );
  const vignette = <Vignette offset={vig.offset} darkness={vig.darkness} />;

  if (!high) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        {bloom}
        {vignette}
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      {bloom}
      <DepthOfField
        focusDistance={EFFECTS.dof.focusDistance}
        focalLength={EFFECTS.dof.focalLength}
        bokehScale={EFFECTS.dof.bokehScale}
      />
      {vignette}
    </EffectComposer>
  );
}
