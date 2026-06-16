/* RPGAtlas — renderer.js
   HD-2D 3D perspective + lighting + fog.
   PIXI v8 Mesh-based terrain renderer (pure PIXI, no separate WebGL2 context).
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
"use strict";

const Renderer = (() => {
  const PIXI = window.PIXI;
  const TILE = (window.Assets && window.Assets.TILE) || 48;
  const CHUNK = TILE * 21; // ~1008 px — safe for GPU max texture 4096
  const FOV = Math.PI / 4;
  const TINT_S = 0.62, TINT_EW = 0.48;

  // ---- PIXI state ----
  let app = null, ok = false, _initPromise = null;
  let sceneContainer = null;
  let spriteContainer = null;
  let lightRenderContainer = null;
  let lightMapTexture = null;
  let lightMapSprite = null;
  let _lightOverlay = null;
  let gradientTexture = null;
  let currentMap = null;
  let _mapDiag = 0;
  let camTilt = 50;

  // ---- PIXI Mesh terrain state ----
  let _terrainContainer = null;
  let _overheadContainer = null;
  let _terrainMeshes = [];
  let _overheadMeshes = [];

  const charSprites = new Map();
  const lightSprPool = [];
  const activeLightSprs = [];
  const shadowGraphicsPool = [];
  const activeShadowGraphics = [];
  let _sceneRT = null;
  let _postPipeline = null;
  let _blitContainer = null;
  let _blitSprite = null;
  let _particleSystem = null;
  let _flashOverlay = null;
  let _flashOverlayContainer = null;

  // ============================ GLSL shaders (GLSL 100 / PIXI v8 compatible) ============================
  const _TERRAIN_VS = `
attribute vec3 aPosition;
attribute vec2 aUV;
attribute float aTint;
uniform mat4 uMVP;
uniform vec3 uEye;
uniform vec4 uFog;
uniform vec2 uFogRange;
varying vec2 vUV;
varying float vTint;
varying vec3 vWorld;
void main() {
  gl_Position = uMVP * vec4(aPosition, 1.0);
  vUV = aUV; vTint = aTint; vWorld = aPosition;
}
`;

  const _TERRAIN_FS = `
precision mediump float;
varying vec2 vUV;
varying float vTint;
varying vec3 vWorld;
uniform sampler2D uSampler;
uniform vec3 uEye;
uniform vec4 uFog;
uniform vec2 uFogRange;
void main() {
  vec4 c = texture2D(uSampler, vUV);
  if (c.a < 0.25) discard;
  vec3 rgb = c.rgb * vTint;
  if (uFog.a > 0.0) {
    float f = clamp((distance(vWorld, uEye) - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
    rgb = mix(rgb, uFog.rgb * c.a, f);
  }
  gl_FragColor = vec4(rgb, c.a);
}
`;

  // ============================ matrix math ============================
  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ];
  }
  function lookAt(ex, ey, ez, tx, ty, tz) {
    let zx = ex - tx, zy = ey - ty, zz = ez - tz;
    const zl = Math.hypot(zx, zy, zz);
    zx /= zl; zy /= zl; zz /= zl;
    let xx = zz, xy = 0, xz = -zx;
    const xl = Math.hypot(xx, xy, xz);
    xx /= xl; xy /= xl; xz /= xl;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1,
    ];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }
  function project(mvp, x, y, z) {
    const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
    if (Math.abs(w) < 0.0001) return { x: 0, y: 0, w: 1 };
    return {
      x: (mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w,
      y: (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w,
      w: w,
    };
  }
  function hexRGB(s) {
    const v = parseInt(String(s || "").replace("#", ""), 16) || 0;
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  // ============================ bilinear height ============================
  function tileHeightAt(tx, ty) {
    if (!currentMap || !currentMap.heights) return 0;
    if (tx < 0 || ty < 0 || tx >= currentMap.width || ty >= currentMap.height) return 0;
    return Number(currentMap.heights[ty * currentMap.width + tx] || 0);
  }
  function sampleH(rx, ry) {
    if (!currentMap || !currentMap.heights) return 0;
    const { width } = currentMap;
    const heights = currentMap.heights;
    const x0 = Math.floor(rx), y0 = Math.floor(ry);
    const fx = rx - x0, fy = ry - y0;
    function hAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= currentMap.width || ty >= currentMap.height) return 0;
      return Number(heights[ty * width + tx] || 0);
    }
    const a = hAt(x0, y0) * (1 - fx) + hAt(x0 + 1, y0) * fx;
    const b = hAt(x0, y0 + 1) * (1 - fx) + hAt(x0 + 1, y0 + 1) * fx;
    return a * (1 - fy) + b * fy;
  }

  // ============================ chunk helpers ============================
  function chopBuffer(buf) {
    const list = [];
    for (let y = 0; y < buf.height; y += CHUNK) {
      for (let x = 0; x < buf.width; x += CHUNK) {
        const w = Math.min(CHUNK, buf.width - x), h = Math.min(CHUNK, buf.height - y);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(buf, x, y, w, h, 0, 0, w, h);
        list.push({ texture: PIXI.Texture.from(c), x, y, w, h });
      }
    }
    return list;
  }

  function tileUV(chunk, tx, ty) {
    const px = tx * TILE - chunk.x, py = ty * TILE - chunk.y;
    return { u0: px / chunk.w, v0: py / chunk.h, u1: (px + TILE) / chunk.w, v1: (py + TILE) / chunk.h };
  }

  // ============================ geometry builder ============================
  function addQuad(poses, uvs, tints,
    ax, ay, az, au, av,
    bx, by, bz, bu, bv,
    cx, cy, cz, cu, cv,
    dx, dy, dz, du, dv, tint) {
    // Triangle 1: a, b, c
    poses.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    uvs.push(au, av, bu, bv, cu, cv);
    tints.push(tint, tint, tint);
    // Triangle 2: c, b, d
    poses.push(cx, cy, cz, bx, by, bz, dx, dy, dz);
    uvs.push(cu, cv, bu, bv, du, dv);
    tints.push(tint, tint, tint);
  }

  function buildScene(lowerBuf, upperBuf, map) {
    const lower = chopBuffer(lowerBuf), upper = chopBuffer(upperBuf);

    _terrainMeshes = [];
    _overheadMeshes = [];
    _terrainContainer.removeChildren();
    _overheadContainer.removeChildren();

    // ---- Build terrain (lower) meshes ----
    for (const ch of lower) {
      const poses = [], uvs = [], tints = [];
      let vertCount = 0;

      addQuad(poses, uvs, tints,
        ch.x, 0, ch.y, 0, 0, ch.x + ch.w, 0, ch.y, 1, 0,
        ch.x, 0, ch.y + ch.h, 0, 1, ch.x + ch.w, 0, ch.y + ch.h, 1, 1, 1);
      vertCount += 6;

      const tx0 = ch.x / TILE, ty0 = ch.y / TILE;
      const tx1 = Math.min(map.width, (ch.x + ch.w) / TILE), ty1 = Math.min(map.height, (ch.y + ch.h) / TILE);
      for (let ty = ty0; ty < ty1; ty++) {
        for (let tx = tx0; tx < tx1; tx++) {
          const h = tileHeightAt(tx, ty);
          if (h <= 0) continue;
          const uv = tileUV(ch, tx, ty);
          const x0 = tx * TILE, x1 = x0 + TILE, z0 = ty * TILE, z1 = z0 + TILE, top = h * TILE;
          addQuad(poses, uvs, tints,
            x0, top, z0, uv.u0, uv.v0, x1, top, z0, uv.u1, uv.v0,
            x0, top, z1, uv.u0, uv.v1, x1, top, z1, uv.u1, uv.v1, 1);
          vertCount += 6;
          for (let k = tileHeightAt(tx, ty + 1); k < h; k++) {
            addQuad(poses, uvs, tints,
              x0, (k + 1) * TILE, z1, uv.u0, uv.v0, x1, (k + 1) * TILE, z1, uv.u1, uv.v0,
              x0, k * TILE, z1, uv.u0, uv.v1, x1, k * TILE, z1, uv.u1, uv.v1, TINT_S);
            vertCount += 6;
          }
          for (let k = tileHeightAt(tx + 1, ty); k < h; k++) {
            addQuad(poses, uvs, tints,
              x1, (k + 1) * TILE, z1, uv.u0, uv.v0, x1, (k + 1) * TILE, z0, uv.u1, uv.v0,
              x1, k * TILE, z1, uv.u0, uv.v1, x1, k * TILE, z0, uv.u1, uv.v1, TINT_EW);
            vertCount += 6;
          }
          for (let k = tileHeightAt(tx - 1, ty); k < h; k++) {
            addQuad(poses, uvs, tints,
              x0, (k + 1) * TILE, z0, uv.u0, uv.v0, x0, (k + 1) * TILE, z1, uv.u1, uv.v0,
              x0, k * TILE, z0, uv.u0, uv.v1, x0, k * TILE, z1, uv.u1, uv.v1, TINT_EW);
            vertCount += 6;
          }
        }
      }

      if (vertCount === 0) continue;

      const geometry = new PIXI.MeshGeometry();
      geometry.addAttribute('aPosition', { buffer: new Float32Array(poses), size: 3 });
      geometry.uvs = new Float32Array(uvs);
      geometry.addAttribute('aTint', { buffer: new Float32Array(tints), size: 1 });

      const shader = PIXI.Shader.from({
        gl: { vertex: _TERRAIN_VS, fragment: _TERRAIN_FS },
        resources: {
          uSampler: ch.texture.source,
          uMVP: new Float32Array(16),
          uEye: new Float32Array(3),
          uFog: new Float32Array([0, 0, 0, 0]),
          uFogRange: new Float32Array([1, 100]),
        },
      });

      const mesh = new PIXI.Mesh({ geometry, shader });
      mesh.state.depthTest = true;
      mesh.blendMode = 'normal';
      _terrainMeshes.push(mesh);
      _terrainContainer.addChild(mesh);
    }

    // ---- Build overhead (upper) meshes ----
    const over = map.layers && map.layers.over;
    for (const ch of upper) {
      const poses = [], uvs = [], tints = [];
      let vertCount = 0;

      const tx0 = ch.x / TILE, ty0 = ch.y / TILE;
      const tx1 = Math.min(map.width, (ch.x + ch.w) / TILE), ty1 = Math.min(map.height, (ch.y + ch.h) / TILE);
      for (let ty = ty0; ty < ty1; ty++) {
        for (let tx = tx0; tx < tx1; tx++) {
          if (!over || !over[ty * map.width + tx]) continue;
          const uv = tileUV(ch, tx, ty);
          const y = (tileHeightAt(tx, ty) + 1) * TILE;
          addQuad(poses, uvs, tints,
            tx * TILE, y, ty * TILE, uv.u0, uv.v0,
            (tx + 1) * TILE, y, ty * TILE, uv.u1, uv.v0,
            tx * TILE, y, (ty + 1) * TILE, uv.u0, uv.v1,
            (tx + 1) * TILE, y, (ty + 1) * TILE, uv.u1, uv.v1, 1);
          vertCount += 6;
        }
      }

      if (vertCount === 0) continue;

      const geometry = new PIXI.MeshGeometry();
      geometry.addAttribute('aPosition', { buffer: new Float32Array(poses), size: 3 });
      geometry.uvs = new Float32Array(uvs);
      geometry.addAttribute('aTint', { buffer: new Float32Array(tints), size: 1 });

      const shader = PIXI.Shader.from({
        gl: { vertex: _TERRAIN_VS, fragment: _TERRAIN_FS },
        resources: {
          uSampler: ch.texture.source,
          uMVP: new Float32Array(16),
          uEye: new Float32Array(3),
          uFog: new Float32Array([0, 0, 0, 0]),
          uFogRange: new Float32Array([1, 100]),
        },
      });

      const mesh = new PIXI.Mesh({ geometry, shader });
      mesh.state.depthTest = false;
      mesh.blendMode = 'normal';
      _overheadMeshes.push(mesh);
      _overheadContainer.addChild(mesh);
    }
  }

  // ============================ lighting helpers ============================
  function buildGradientTexture() {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.1, "rgba(255,255,255,0.9)");
    g.addColorStop(0.2, "rgba(255,255,255,0.7)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(0.5, "rgba(255,255,255,0.2)");
    g.addColorStop(0.7, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = PIXI.Texture.from(c);
    texture.baseTexture.scaleMode = "linear";
    return texture;
  }

  function acquireLightSpr() {
    let spr = lightSprPool.pop();
    if (!spr) {
      spr = new PIXI.Sprite(gradientTexture);
      spr.anchor.set(0.5);
      spr.blendMode = "add";
    }
    spr.visible = true;
    activeLightSprs.push(spr);
    return spr;
  }

  function releaseAllLights() {
    for (let i = 0; i < activeLightSprs.length; i++) {
      activeLightSprs[i].visible = false;
      activeLightSprs[i].parent && activeLightSprs[i].parent.removeChild(activeLightSprs[i]);
      lightSprPool.push(activeLightSprs[i]);
    }
    activeLightSprs.length = 0;
  }

  function releaseAllShadows() {
    for (let i = 0; i < activeShadowGraphics.length; i++) {
      activeShadowGraphics[i].visible = false;
      activeShadowGraphics[i].parent && activeShadowGraphics[i].parent.removeChild(activeShadowGraphics[i]);
      shadowGraphicsPool.push(activeShadowGraphics[i]);
    }
    activeShadowGraphics.length = 0;
  }

  function ensureLightMap(w, h) {
    if (!lightMapTexture || lightMapTexture.width !== w || lightMapTexture.height !== h) {
      if (lightMapTexture) lightMapTexture.destroy(true);
      lightMapTexture = PIXI.RenderTexture.create({ width: w, height: h, scaleMode: "linear" });
      if (lightMapSprite) lightMapSprite.texture = lightMapTexture;
    }
    if (lightMapSprite) { lightMapSprite.width = w; lightMapSprite.height = h; }
  }

  function projectShadowPoint(px, py, lx, ly, distance, maxDist) {
    const dx = px - lx, dy = py - ly;
    const len = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
    const projDist = Math.min(distance, maxDist || distance);
    return { x: px + (dx / len) * projDist, y: py + (dy / len) * projDist };
  }

  function buildShadowForTile(graphics, lightX, lightY, tx, ty, tileSize, projectionDistance, lightRadius) {
    const centerX = tx + tileSize * 0.5, centerY = ty + tileSize * 0.5;
    const dx = lightX - centerX, dy = lightY - centerY;
    const distToLight = Math.sqrt(dx * dx + dy * dy);
    const maxProjDist = Math.max(tileSize, lightRadius - distToLight);
    let c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) { c1x = tx; c1y = ty; c2x = tx; c2y = ty + tileSize; }
      else { c1x = tx + tileSize; c1y = ty; c2x = tx + tileSize; c2y = ty + tileSize; }
    } else {
      if (dy > 0) { c1x = tx; c1y = ty; c2x = tx + tileSize; c2y = ty; }
      else { c1x = tx; c1y = ty + tileSize; c2x = tx + tileSize; c2y = ty + tileSize; }
    }
    const f1 = projectShadowPoint(c1x, c1y, lightX, lightY, projectionDistance, maxProjDist);
    const f2 = projectShadowPoint(c2x, c2y, lightX, lightY, projectionDistance, maxProjDist);
    graphics.moveTo(c1x, c1y);
    graphics.lineTo(c2x, c2y);
    graphics.lineTo(f2.x, f2.y);
    graphics.lineTo(f1.x, f1.y);
    graphics.closePath();
    graphics.endFill();
  }

  // ============================ PIXI init ============================
  async function available() {
    if (ok) return true;
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      try {
        app = new PIXI.Application();
        await app.init({
          antialias: false,
          premultipliedAlpha: true,
          backgroundAlpha: 0,
        });

        // Verify PIXI has Mesh/Shader support
        if (typeof PIXI.Mesh === 'undefined' || typeof PIXI.Shader === 'undefined') {
          console.warn("HD-2D: PIXI Mesh/Shader not available in this version");
          return false;
        }

        const pixiCanvas = app.canvas;
        pixiCanvas.id = "pixicanvas";
        pixiCanvas.style.cssText = "position:absolute;inset:0;z-index:0;image-rendering:pixelated";
        const gameCanvas = document.getElementById("gamecanvas");
        if (gameCanvas) {
          gameCanvas.parentNode.insertBefore(pixiCanvas, gameCanvas);
        }

        sceneContainer = new PIXI.Container();
        app.stage.addChild(sceneContainer);

        _terrainContainer = new PIXI.Container();
        sceneContainer.addChild(_terrainContainer);

        spriteContainer = new PIXI.Container();
        spriteContainer.sortableChildren = true;
        sceneContainer.addChild(spriteContainer);

        _particleSystem = new ParticleSystem.System();
        sceneContainer.addChild(_particleSystem.container);

        _overheadContainer = new PIXI.Container();
        sceneContainer.addChild(_overheadContainer);

        lightRenderContainer = new PIXI.Container();

        lightMapTexture = PIXI.RenderTexture.create({ width: 1, height: 1, scaleMode: "linear" });
        lightMapSprite = new PIXI.Sprite(lightMapTexture);
        lightMapSprite.blendMode = "multiply";
        lightMapSprite.width = 1;
        lightMapSprite.height = 1;
        lightMapSprite.visible = false;

        _lightOverlay = new PIXI.Container();
        _lightOverlay.addChild(lightMapSprite);

        gradientTexture = buildGradientTexture();

        ok = true;
        return true;
      } catch (e) {
        console.error("PIXI init failed", e);
        return false;
      }
    })();
    const result = await _initPromise;
    _initPromise = null;
    return result;
  }

  // ============================ uniform helpers ============================
  function _updateTerrainUniforms(mvpArr, eyeArr, fogColor, fogRange) {
    const mvpF32 = new Float32Array(mvpArr);
    const eyeF32 = new Float32Array(eyeArr);
    const fogF32 = fogColor || new Float32Array([0, 0, 0, 0]);
    const rangeF32 = fogRange || new Float32Array([1, 100]);

    for (const mesh of _terrainMeshes) {
      const res = mesh.shader.resources;
      if (res.uMVP instanceof Float32Array) res.uMVP.set(mvpF32);
      if (res.uEye instanceof Float32Array) res.uEye.set(eyeF32);
      if (res.uFog instanceof Float32Array) res.uFog.set(fogF32);
      if (res.uFogRange instanceof Float32Array) res.uFogRange.set(rangeF32);
    }
  }

  function _updateOverheadUniforms(mvpArr, eyeArr, fogColor, fogRange) {
    const mvpF32 = new Float32Array(mvpArr);
    const eyeF32 = new Float32Array(eyeArr);
    const fogF32 = fogColor || new Float32Array([0, 0, 0, 0]);
    const rangeF32 = fogRange || new Float32Array([1, 100]);

    for (const mesh of _overheadMeshes) {
      const res = mesh.shader.resources;
      if (res.uMVP instanceof Float32Array) res.uMVP.set(mvpF32);
      if (res.uEye instanceof Float32Array) res.uEye.set(eyeF32);
      if (res.uFog instanceof Float32Array) res.uFog.set(fogF32);
      if (res.uFogRange instanceof Float32Array) res.uFogRange.set(rangeF32);
    }
  }

  // ============================ setMap ============================
  function setMap(lowerBuf, upperBuf, map) {
    if (!ok) return;
    currentMap = map || null;
    _mapDiag = map ? (map.width + map.height) * TILE : 0;

    const c = map && map.hd2d || {};
    camTilt = Math.min(89, Math.max(25, Number(c.tilt) || 50));

    _terrainContainer.removeChildren();
    _overheadContainer.removeChildren();
    _terrainMeshes = [];
    _overheadMeshes = [];
    spriteContainer.removeChildren();
    charSprites.clear();
    if (_particleSystem) _particleSystem.clear();

    if (lowerBuf && upperBuf && map) {
      buildScene(lowerBuf, upperBuf, map);
    }
  }

  // ============================ renderFrame ============================
  function renderFrame(w, h, camX, camY, sprites, extra) {
    if (!ok) return null;
    if (app.renderer.width !== w || app.renderer.height !== h) {
      app.renderer.resize(w, h);
    }

    const map = currentMap;
    if (!map || (!_terrainMeshes.length && !_overheadMeshes.length)) {
      app.renderer.render(app.stage);
      return extractCanvas(w, h);
    }

    const zoom = extra.zoom || 1;
    const shakeX = extra.shakeX || 0;
    const shakeY = extra.shakeY || 0;

    const tiltVal = extra.tilt != null ? Number(extra.tilt) : camTilt;
    const pitch = tiltVal * Math.PI / 180;
    const fovVal = extra.fov != null ? Number(extra.fov) : FOV;
    const dist = (h / 2) / Math.tan(fovVal / 2) / zoom;
    const near = dist / 10, far = dist * 2 + _mapDiag;
    const tX = camX + w / (zoom * 2), tZ = camY + h / (zoom * 2);
    const eyeX = tX, eyeY = dist * Math.sin(pitch), eyeZ = tZ + dist * Math.cos(pitch);
    const eyeArr = [eyeX, eyeY, eyeZ];
    const mvpArr = mul(perspective(fovVal, w / h, near, far), lookAt(eyeX, eyeY, eyeZ, tX, 0, tZ));

    const cfg = (map && map.hd2d) || {};
    const fog = cfg.fog ? {
      color: hexRGB((cfg.fog && cfg.fog.color) || "#101018"),
      near: Number(cfg.fog && cfg.fog.near) || 0,
      far: Number(cfg.fog && cfg.fog.far) || 0,
    } : null;
    let fogColor = null;
    if (fog) {
      fogColor = new Float32Array([fog.color[0], fog.color[1], fog.color[2], 1]);
    }
    const fogRange = fog ? new Float32Array([fog.near || dist, fog.far || dist * 2.2]) : null;

    // ---- Update terrain uniforms ----
    _updateTerrainUniforms(mvpArr, eyeArr, fogColor, fogRange);
    _updateOverheadUniforms(mvpArr, eyeArr, fogColor, fogRange);

    // ---- sprite projection (between terrain and overhead) ----
    function toScreen(wx, wy, wz) {
      const p = project(mvpArr, wx, wy, wz);
      return {
        x: (p.x * 0.5 + 0.5) * w + shakeX,
        y: (-p.y * 0.5 + 0.5) * h + shakeY,
        w: p.w,
      };
    }

    for (const [, spr] of charSprites) spr.visible = false;
    for (let i = 0; i < sprites.length; i++) {
      const sData = sprites[i];
      let spr = charSprites.get(sData.id);
      if (!spr) {
        spr = new PIXI.Sprite(PIXI.Texture.from(sData.canvas));
        spr._canvas = sData.canvas;
        charSprites.set(sData.id, spr);
        spriteContainer.addChild(spr);
      } else {
        spr.visible = true;
        if (spr._canvas !== sData.canvas) {
          spr._canvas = sData.canvas;
          spr.texture = PIXI.Texture.from(sData.canvas);
        }
      }

      const h = sampleH(sData.rx, sData.ry);
      const sc = toScreen(sData.rx * TILE + TILE / 2, h * TILE, sData.ry * TILE + TILE / 2);
      const depthScale = Math.max(0.25, Math.min(3, 1 / sc.w));
      spr.position.set(sc.x - (sData.canvas.width * depthScale) / 2, sc.y - sData.canvas.height * depthScale);
      spr.scale.set(depthScale);
      spr.zIndex = (map.height - sData.ry) * 10000 + (sData.pr || 1);
    }
    spriteContainer.sortChildren();

    // ---- Particles: update and sync sprites before scene render ----
    if (_particleSystem) {
      _particleSystem.updateEmitters(extra.particles || []);
      _particleSystem.update();
      _particleSystem.syncSprites(toScreen);
    }

    // ---- Render scene: terrain (depth on) → sprites → overhead (depth off) to _sceneRT ----
    _ensureSceneRT(w, h);
    lightMapSprite.visible = false;
    app.renderer.render(app.stage, { renderTexture: _sceneRT, clear: true });

    // ---- Lighting pass ----
    releaseAllLights();
    releaseAllShadows();

    const lights = extra.lights;
    const hasLights = lights && Array.isArray(lights) && lights.length > 0;
    const ambient = extra.ambient != null ? extra.ambient : 0.45;
    const doLighting = hasLights || ambient != null;

    if (doLighting) {
      ensureLightMap(w, h);
      lightMapSprite.visible = true;
      lightMapSprite.width = w;
      lightMapSprite.height = h;
      lightMapSprite.position.set(0, 0);
      lightRenderContainer.removeChildren();

      const ambientBg = Math.floor(ambient * 255);
      const bgGraphics = new PIXI.Graphics();
      bgGraphics.beginFill((ambientBg << 16) | (ambientBg << 8) | ambientBg, 1);
      bgGraphics.drawRect(0, 0, w, h);
      bgGraphics.endFill();
      lightRenderContainer.addChild(bgGraphics);

      const gradHalf = gradientTexture.width / 2;
      const tilePassable = extra.tilePassable;

      for (let i = 0; i < lights.length; i++) {
        const l = lights[i];
        if (!l || !l.color || typeof l.rx !== "number" || typeof l.ry !== "number" || typeof l.radius !== "number") continue;

        const spr = acquireLightSpr();
        spr.tint = l.color.startsWith("#") ? parseInt(l.color.slice(1), 16) : 0xffffff;

        const lsc = toScreen(l.rx * TILE + TILE / 2, sampleH(l.rx, l.ry) * TILE + TILE * 0.75, l.ry * TILE + TILE / 2);
        const depthScaleL = Math.max(0.25, Math.min(3, 1 / lsc.w));
        spr.position.set(lsc.x, lsc.y);
        spr.scale.set((l.radius / gradHalf) * depthScaleL);
        lightRenderContainer.addChild(spr);

        if (tilePassable && currentMap) {
          const radius = l.radius;
          const minTx = Math.max(0, Math.floor(l.rx - radius / TILE - 1));
          const maxTx = Math.min(currentMap.width, Math.ceil(l.rx + radius / TILE + 1));
          const minTy = Math.max(0, Math.floor(l.ry - radius / TILE - 1));
          const maxTy = Math.min(currentMap.height, Math.ceil(l.ry + radius / TILE + 1));
          for (let ty = minTy; ty < maxTy; ty++) {
            for (let tx = minTx; tx < maxTx; tx++) {
              const h = tileHeightAt(tx, ty);
              if (!(!tilePassable(tx, ty) || h > 0)) continue;
              const tsc = toScreen(tx * TILE, h * TILE, ty * TILE);
              const d = Math.hypot(tx - l.rx + 0.5, ty - l.ry + 0.5) * TILE;
              if (d > radius + TILE) continue;
              const shadow = acquireShadowGraphics();
              const pd = l.radius * (0.3 + h * 0.1) * (1 / Math.max(0.25, lsc.w));
              buildShadowForTile(shadow, lsc.x, lsc.y, tsc.x, tsc.y, TILE * (1 / Math.max(0.25, lsc.w)), pd, l.radius * (1 / Math.max(0.25, lsc.w)));
              lightRenderContainer.addChild(shadow);
            }
          }
        }
      }

      // Render light map to texture
      app.renderer.render(lightRenderContainer, {
        renderTexture: lightMapTexture,
        clear: true,
      });

      // Render light overlay on top of scene
      app.renderer.render(_lightOverlay, { renderTexture: _sceneRT, clear: false });
    } else {
      lightMapSprite.visible = false;
    }

    // ---- PIXI flash overlay (renders into _sceneRT so bloom/DOF apply) ----
    const flashIntensity = extra.flashIntensity != null ? Number(extra.flashIntensity) : 0;
    if (flashIntensity > 0.001) {
      if (!_flashOverlay) {
        _flashOverlay = new PIXI.Graphics();
        _flashOverlayContainer = new PIXI.Container();
        _flashOverlayContainer.addChild(_flashOverlay);
      }
      _flashOverlay.clear();
      const flashColorNum = parseInt(String(extra.flashColor || "#ffffff").replace("#", ""), 16) || 0xffffff;
      _flashOverlay.beginFill(flashColorNum, Math.min(1, flashIntensity));
      _flashOverlay.drawRect(0, 0, w, h);
      _flashOverlay.endFill();
      app.renderer.render(_flashOverlayContainer, { renderTexture: _sceneRT, clear: false });
    }

    // ---- Post-processing: bloom / DOF ----
    const hd2dCfg = (map && map.hd2d) || {};
    const useBloom = hd2dCfg.bloom === true;
    const useDOF = hd2dCfg.dof === true;

    if (useBloom || useDOF) {
      if (!_postPipeline) _postPipeline = new PostProcess.Pipeline(app);

      let dofFocusX = 0.5, dofFocusY = 0.5;
      if (extra.focus) {
        const fp = toScreen(
          extra.focus.rx * TILE + TILE / 2,
          sampleH(extra.focus.rx, extra.focus.ry) * TILE,
          extra.focus.ry * TILE + TILE / 2
        );
        dofFocusX = (fp.x - shakeX) / w;
        dofFocusY = (fp.y - shakeY) / h;
      }

      _postPipeline.apply(_sceneRT, w, h, {
        bloom: useBloom,
        dof: useDOF,
        bloomThreshold: hd2dCfg.bloomThreshold != null ? hd2dCfg.bloomThreshold : 0.8,
        bloomIntensity: hd2dCfg.bloomIntensity != null ? hd2dCfg.bloomIntensity : 1.5,
        dofFocusX,
        dofFocusY,
        dofRange: hd2dCfg.dofRange != null ? hd2dCfg.dofRange : 0.4,
        dofMaxBlur: hd2dCfg.dofMaxBlur != null ? hd2dCfg.dofMaxBlur : 3.0,
      });
    } else {
      _blitToCanvas(_sceneRT);
    }

    return extractCanvas(w, h);
  }

  function extractCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(app.canvas, 0, 0);
    return c;
  }

  function _ensureSceneRT(w, h) {
    if (!_sceneRT || _sceneRT.width !== w || _sceneRT.height !== h) {
      if (_sceneRT) _sceneRT.destroy(true);
      _sceneRT = PIXI.RenderTexture.create({ width: w, height: h, scaleMode: 'linear' });
    }
  }

  function _blitToCanvas(rt) {
    if (!_blitContainer) {
      _blitContainer = new PIXI.Container();
      _blitContainer.name = 'blit-container';
      _blitSprite = new PIXI.Sprite();
      _blitContainer.addChild(_blitSprite);
    }
    _blitSprite.texture = rt;
    app.renderer.render(_blitContainer, { clear: true });
  }

  return { available, setMap, renderFrame };
})();

window.Renderer = Renderer;
if (!window.GLRender) window.GLRender = Renderer;
