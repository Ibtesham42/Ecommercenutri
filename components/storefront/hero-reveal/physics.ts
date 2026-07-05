/**
 * Tiny semi-implicit Euler integrator for the falling makhana pieces. Pure and
 * dependency-free: the engine owns the state and calls `stepPiece` per frame.
 * All units are px / px-per-second in stage space (pre-scaled by the caller for
 * the measured stage height).
 */

export type PieceState = {
  /** Center position (stage px). */
  x: number;
  y: number;
  /** Velocity (px/s). */
  vx: number;
  vy: number;
  /** Rotation (deg) + airborne tumble rate (deg/s). */
  rot: number;
  spin: number;
  /** Rendered diameter (px). */
  size: number;
  bounces: number;
  grounded: boolean;
  resting: boolean;
  /** Timeline second this piece leaves the packet mouth. */
  born: number;
  /** Whether the piece has spawned yet this cycle. */
  alive: boolean;
};

export type PhysicsParams = {
  gravity: number;
  restitution: number;
  maxBounces: number;
  bounceCutoff: number;
  rollDecel: number;
  restVx: number;
  /** Y of the ground line (stage px); pieces rest with their base on it. */
  floorY: number;
};

/** Advance one piece by `dt` seconds. Mutates `p` in place. */
export function stepPiece(p: PieceState, dt: number, params: PhysicsParams): void {
  if (!p.alive || p.resting) return;

  const half = p.size / 2;
  const floor = params.floorY - half;

  if (!p.grounded) {
    // Semi-implicit Euler: velocity first, then position.
    p.vy += params.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;

    if (p.y >= floor) {
      p.y = floor;
      if (Math.abs(p.vy) > params.bounceCutoff && p.bounces < params.maxBounces) {
        // Bounce: retain a fraction of vertical energy, scrub some horizontal.
        p.vy = -Math.abs(p.vy) * params.restitution;
        p.vx *= 0.8;
        p.spin *= 0.6;
        p.bounces += 1;
      } else {
        p.vy = 0;
        p.grounded = true;
      }
    }
    return;
  }

  // Grounded: roll with friction until rest. Rolling without slipping —
  // angular velocity matches the surface speed (v = ωr).
  p.x += p.vx * dt;
  p.rot += ((p.vx / half) * 180) / Math.PI * dt;
  const decel = params.rollDecel * dt;
  if (Math.abs(p.vx) <= decel || Math.abs(p.vx) < params.restVx) {
    p.vx = 0;
    p.resting = true;
  } else {
    p.vx -= Math.sign(p.vx) * decel;
  }
}
