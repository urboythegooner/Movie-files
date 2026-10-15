export class Camera {
  yaw = 0.5;
  pitch = 0.55;
  dist = 900;
  targetDist = 720;
  tx = 0; ty = 0; tz = 0;
  cx = 0; cy = 0; F = 1;
  px = 0; py = 0; pz = 0;
  fx = 0; fy = 0; fz = 0;
  rx = 0; ry = 0; rz = 0;
  ux = 0; uy = 0; uz = 0;
  sx = 0; sy = 0;

  update(w: number, h: number) {
    this.dist += (this.targetDist - this.dist) * 0.15;
    this.cx = w / 2; this.cy = h / 2;
    const cp = Math.cos(this.pitch);
    this.px = this.tx + this.dist * cp * Math.sin(this.yaw);
    this.py = this.ty + this.dist * Math.sin(this.pitch);
    this.pz = this.tz + this.dist * cp * Math.cos(this.yaw);
    let fx = this.tx - this.px, fy = this.ty - this.py, fz = this.tz - this.pz;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    this.fx = fx; this.fy = fy; this.fz = fz;
    this.rx = rx; this.ry = 0; this.rz = rz;
    this.ux = 0 * fz - rz * fy;
    this.uy = rz * fx - rx * fz;
    this.uz = rx * fy - 0 * fx;
    this.F = h / 2 / Math.tan((60 * Math.PI) / 360);
  }

  /** Returns view depth (or -1 if behind) and writes screen coords to sx/sy */
  project(x: number, y: number, z: number): number {
    const dx = x - this.px, dy = y - this.py, dz = z - this.pz;
    const zc = dx * this.fx + dy * this.fy + dz * this.fz;
    if (zc < 0.5) return -1;
    this.sx = this.cx + ((dx * this.rx + dy * this.ry + dz * this.rz) * this.F) / zc;
    this.sy = this.cy - ((dx * this.ux + dy * this.uy + dz * this.uz) * this.F) / zc;
    return zc;
  }

  rayPlaneY(sx: number, sy: number, planeY: number) {
    const a = (sx - this.cx) / this.F, b = (sy - this.cy) / this.F;
    const dx = this.fx + this.rx * a - this.ux * b;
    const dy = this.fy + this.ry * a - this.uy * b;
    const dz = this.fz + this.rz * a - this.uz * b;
    if (Math.abs(dy) < 1e-6) return null;
    const t = (planeY - this.py) / dy;
    if (t <= 0 || t > Math.max(50000, this.dist * 40)) return null;
    return { x: this.px + dx * t, y: planeY, z: this.pz + dz * t };
  }
}