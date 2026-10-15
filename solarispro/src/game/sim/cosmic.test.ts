import { describe, expect, it } from 'vitest';
import { Camera } from './camera';
import { cosmicAxes, sphereWorldNormal } from './cosmic';

describe('World-oriented cosmic rendering', () => {
  it('keeps object axes orthonormal and independent of the camera', () => {
    const { u, v, n } = cosmicAxes(7);
    const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
    for (const axis of [u, v, n]) expect(dot(axis, axis)).toBeCloseTo(1);
    expect(dot(u, v)).toBeCloseTo(0);
    expect(dot(u, n)).toBeCloseTo(0);
    expect(dot(v, n)).toBeCloseTo(0);
    expect(cosmicAxes(7)).toEqual({ u, v, n });
  });

  it('shows different stellar surface coordinates when orbiting in yaw or pitch', () => {
    const cam = new Camera();
    cam.update(1280, 900);
    const start = sphereWorldNormal(cam, 0, 0, 1);
    cam.yaw += 1;
    cam.update(1280, 900);
    expect(sphereWorldNormal(cam, 0, 0, 1)).not.toEqual(start);
    cam.yaw -= 1;
    cam.pitch += 0.5;
    cam.update(1280, 900);
    expect(sphereWorldNormal(cam, 0, 0, 1)).not.toEqual(start);
  });
});