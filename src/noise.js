// Original, deterministic periodic volume. No downloaded cloud assets.
export function createNoiseVolume(size = 64) {
  const data = new Uint8Array(size ** 3 * 2);
  const hash = (x, y, z) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  function noise(x, y, z, period) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
    const h = (dx, dy, dz) => hash((ix + dx) % period, (iy + dy) % period, (iz + dz) % period);
    return mix(mix(mix(h(0,0,0), h(1,0,0), fx), mix(h(0,1,0), h(1,1,0), fx), fy),
      mix(mix(h(0,0,1), h(1,0,1), fx), mix(h(0,1,1), h(1,1,1), fx), fy), fz);
  }
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / size, py = y / size, pz = z / size;
    const a = noise(px*4, py*4, pz*4, 4);
    const b = noise(px*8, py*8, pz*8, 8);
    const c = noise(px*16, py*16, pz*16, 16);
    const index = ((z * size + y) * size + x) * 2;
    data[index] = Math.round((a*.67 + b*.24 + c*.09)*255);
    data[index+1] = Math.round((b*.7 + c*.3)*255);
  }
  return {data, size};
}
