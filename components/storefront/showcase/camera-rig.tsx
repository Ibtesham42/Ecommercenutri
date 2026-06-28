"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { CAMERA, cameraDriftSpeed } from "@/lib/showcase-config";
import type { Vec2 } from "./use-showcase-parallax";

/**
 * Very slow cinematic camera drift (+ gentle FOV breathing) so the scene always
 * feels alive even with no input, plus a small parallax offset from the pointer/
 * gyro. Kept well under a carousel feel — premium ambient motion. Static when
 * reduced-motion is on (the frameloop is "demand" then anyway).
 */
export function CameraRig({
  reduced,
  rotationSpeed,
  parallax,
}: {
  reduced: boolean;
  rotationSpeed: number;
  parallax: React.RefObject<Vec2>;
}) {
  const t = useRef(0);

  useFrame((state, delta) => {
    const cam = state.camera;
    if (reduced) {
      cam.position.set(...CAMERA.position);
      cam.lookAt(...CAMERA.target);
      return;
    }
    t.current += Math.min(delta, 0.05);
    const a = t.current * cameraDriftSpeed(rotationSpeed);
    const p = parallax.current ?? { x: 0, y: 0 };

    cam.position.x = CAMERA.position[0] + Math.sin(a) * CAMERA.driftRadius + p.x * 0.15;
    cam.position.y =
      CAMERA.position[1] + Math.sin(a * 0.6) * CAMERA.driftRadius * 0.5 - p.y * 0.1;
    cam.position.z = CAMERA.position[2];

    if (cam instanceof PerspectiveCamera) {
      cam.fov = CAMERA.fov + Math.sin(t.current * CAMERA.fovBreathSpeed) * CAMERA.fovBreathDeg;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(...CAMERA.target);
  });

  return null;
}
