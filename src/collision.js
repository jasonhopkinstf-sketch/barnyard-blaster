// Tiny XZ-plane collision helpers. Boxes are axis-aligned: { minX, maxX, minZ, maxZ }.

export function makeBox(cx, cz, w, d) {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

export function pointInBox(x, z, b) {
  return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
}

// Push a circle (pos.x, pos.z, radius r) out of every box. Mutates pos. Returns true if anything moved.
export function resolveCircle(pos, r, boxes) {
  let hit = false;
  for (const b of boxes) {
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.z = nz + (dz / d) * r;
    } else {
      const left = pos.x - b.minX, right = b.maxX - pos.x, front = pos.z - b.minZ, back = b.maxZ - pos.z;
      const m = Math.min(left, right, front, back);
      if (m === left) pos.x = b.minX - r;
      else if (m === right) pos.x = b.maxX + r;
      else if (m === front) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    }
  }
  return hit;
}
