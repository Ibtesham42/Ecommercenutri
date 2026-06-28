"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import { FLOOR, PRODUCT } from "@/lib/showcase-config";
import type { Vec2 } from "./use-showcase-parallax";

const DEG = Math.PI / 180;

type Layer = { tex: Texture; aspect: number };
type Layers = { cur: Layer | null; prev: Layer | null };

/** Soft radial drop-shadow texture, generated once (no asset). */
function makeShadowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.6, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * The product itself: a PBR/clearcoat plane textured with the (auto-framed,
 * background-removed) image. Loads textures imperatively so we fully control
 * disposal on swap + unmount. Crossfades current↔incoming over swapFadeMs, floats
 * with a gentle bob + sway, follows pointer/gyro parallax, and (for turntable
 * presets) does an elegant yaw oscillation — never edge-on, since it's a 2D cutout.
 */
export function ProductPlane({
  src,
  scale,
  floatAmp,
  spinSeconds,
  swayDeg,
  parallax,
  reduced,
}: {
  src: string;
  scale: number;
  floatAmp: number;
  spinSeconds: number; // 0 = no turntable motion
  swayDeg: number;
  parallax: React.RefObject<Vec2>;
  reduced: boolean;
}) {
  const { gl, invalidate } = useThree();
  const [layers, setLayers] = useState<Layers>({ cur: null, prev: null });
  const mix = useRef(1); // 1 = fully showing current
  const clock = useRef(0);
  const off = useRef<Vec2>({ x: 0, y: 0 });

  const group = useRef<Group>(null!);
  const shadow = useRef<Mesh>(null!);
  const curMat = useRef<MeshPhysicalMaterial>(null!);
  const prevMat = useRef<MeshPhysicalMaterial>(null!);

  // Latest layers for unmount disposal (avoids stale-closure leaks).
  const live = useRef<Layers>({ cur: null, prev: null });
  live.current = layers;

  const shadowTex = useMemo(() => makeShadowTexture(), []);

  // Load the texture for `src` and start a crossfade from the old one.
  useEffect(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    loader.load(
      src,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        const im = tex.image as { width?: number; height?: number } | undefined;
        const aspect = im?.width && im?.height ? im.width / im.height : 1;
        mix.current = 0;
        setLayers((old) => {
          old.prev?.tex.dispose(); // drop any still-pending previous
          return { cur: { tex, aspect }, prev: old.cur };
        });
        invalidate(); // render the new frame even in "demand" mode
      },
      undefined,
      () => {
        /* swallow load error — the DOM StageFallback / prior frame stays visible */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [src, gl, invalidate]);

  // Dispose remaining textures on unmount.
  useEffect(
    () => () => {
      live.current.cur?.tex.dispose();
      live.current.prev?.tex.dispose();
      shadowTex.dispose();
    },
    [shadowTex],
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    clock.current += dt;

    // Crossfade.
    if (mix.current < 1) {
      mix.current = Math.min(1, mix.current + dt * (1000 / PRODUCT.swapFadeMs));
      if (curMat.current) curMat.current.opacity = mix.current;
      if (prevMat.current) prevMat.current.opacity = 1 - mix.current;
      if (mix.current >= 1 && live.current.prev) {
        const dead = live.current.prev;
        setLayers((o) => ({ cur: o.cur, prev: null }));
        dead.tex.dispose();
      }
    }

    const g = group.current;
    if (!g) return;

    // Smoothly ease the parallax offset toward its target.
    const target = parallax.current ?? { x: 0, y: 0 };
    const k = Math.min(1, dt * 4);
    off.current.x += (target.x - off.current.x) * k;
    off.current.y += (target.y - off.current.y) * k;

    if (reduced) {
      g.position.set(0, 0.1, 0);
      g.rotation.set(0, 0, 0);
    } else {
      const bob = floatAmp ? Math.sin(clock.current * PRODUCT.floatSpeed) * floatAmp : 0;
      g.position.x = off.current.x * PRODUCT.parallaxMax;
      g.position.y = 0.1 + bob + off.current.y * -PRODUCT.parallaxMax * 0.6;

      if (spinSeconds > 0) {
        // Elegant yaw/pitch oscillation (a flat cutout can't truly 360-spin).
        const phase = (clock.current / spinSeconds) * Math.PI * 2;
        g.rotation.y = Math.sin(phase) * 18 * DEG;
        g.rotation.x = Math.cos(phase * 0.5) * 4 * DEG;
      } else {
        const sway = floatAmp
          ? Math.sin(clock.current * PRODUCT.floatSpeed * 0.6) * swayDeg * DEG
          : 0;
        g.rotation.y = off.current.x * 0.25 + sway;
        g.rotation.x = off.current.y * 0.15;
      }
    }

    // Keep the soft shadow on the floor; shrink + fade as the product lifts.
    if (shadow.current) {
      const lift = Math.max(0, g.position.y - 0.1);
      shadow.current.position.y = FLOOR.y + 0.012 - g.position.y;
      const s = scale * (1.25 - lift * 0.8);
      shadow.current.scale.set(s, s * 0.42, 1);
      const mat = shadow.current.material as MeshPhysicalMaterial;
      mat.opacity = Math.max(0, 0.5 - lift * 1.4) * mix.current;
    }
  });

  const { cur, prev } = layers;

  return (
    <group ref={group} position={[0, 0.1, 0]}>
      {/* Soft contact shadow (alpha-shaped, follows the float) */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {prev && (
        <mesh scale={[scale * prev.aspect, scale, 1]} renderOrder={1}>
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            ref={prevMat}
            map={prev.tex}
            transparent
            opacity={1 - mix.current}
            roughness={PRODUCT.material.roughness}
            metalness={PRODUCT.material.metalness}
            clearcoat={PRODUCT.material.clearcoat}
            clearcoatRoughness={PRODUCT.material.clearcoatRoughness}
            envMapIntensity={PRODUCT.material.envMapIntensity}
            depthWrite={false}
            alphaTest={0.02}
          />
        </mesh>
      )}

      {cur && (
        <mesh scale={[scale * cur.aspect, scale, 1]} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
          <meshPhysicalMaterial
            ref={curMat}
            map={cur.tex}
            transparent
            opacity={mix.current}
            roughness={PRODUCT.material.roughness}
            metalness={PRODUCT.material.metalness}
            clearcoat={PRODUCT.material.clearcoat}
            clearcoatRoughness={PRODUCT.material.clearcoatRoughness}
            envMapIntensity={PRODUCT.material.envMapIntensity}
            depthWrite={false}
            alphaTest={0.02}
          />
        </mesh>
      )}
    </group>
  );
}
