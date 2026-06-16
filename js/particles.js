/* RPGAtlas — particles.js
   3D particle system for HD-2D maps.
   PIXI v8 sprite-based particles projected to screen space.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
"use strict";

const ParticleSystem = (() => {
  const PIXI = window.PIXI;

  // ======================== built-in textures ========================
  const _texCache = {};

  function _makeTexture(name) {
    const sizes = { circle: 32, spark: 16, smoke: 64, star: 32 };
    const size = sizes[name] || 32;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const half = size / 2;
    const g = ctx.createRadialGradient(half, half, 0, half, half, half);

    if (name === "circle") {
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.85)");
      g.addColorStop(0.5, "rgba(255,255,255,0.4)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    } else if (name === "spark") {
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.3, "rgba(255,255,255,0.7)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    } else if (name === "smoke") {
      g.addColorStop(0, "rgba(255,255,255,0.4)");
      g.addColorStop(0.3, "rgba(255,255,255,0.15)");
      g.addColorStop(1, "rgba(255,255,255,0)");
    } else if (name === "star") {
      c.width = c.height = size;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? half : half * 0.3;
        i === 0 ? ctx.moveTo(half + Math.cos(a) * r, half + Math.sin(a) * r)
                : ctx.lineTo(half + Math.cos(a) * r, half + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      const g2 = ctx.createRadialGradient(half, half, 0, half, half, half);
      g2.addColorStop(0, "rgba(255,255,255,1)");
      g2.addColorStop(0.5, "rgba(255,255,255,0.3)");
      g2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, size, size);
      _texCache[name] = PIXI.Texture.from(c);
      return;
    }

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    _texCache[name] = PIXI.Texture.from(c);
  }

  function _getTexture(name) {
    name = name || "circle";
    if (!_texCache[name]) _makeTexture(name);
    return _texCache[name];
  }

  // ======================== presets ========================
  const PRESETS = {
    fire: {
      texture: "circle", vxMin: -8, vxMax: 8,
      vyMin: 30, vyMax: 80, vzMin: -8, vzMax: 8,
      gravity: -60, startSize: 8, endSize: 2,
      lifetime: 0.6, lifetimeVariance: 0.3,
      startAlpha: 1, endAlpha: 0.3,
      tint: 0xff8844, blendMode: "add",
    },
    smoke: {
      texture: "smoke", vxMin: -5, vxMax: 5,
      vyMin: 8, vyMax: 25, vzMin: -5, vzMax: 5,
      gravity: -10, startSize: 14, endSize: 40,
      lifetime: 1.8, lifetimeVariance: 0.6,
      startAlpha: 0.5, endAlpha: 0,
      tint: 0x888888, blendMode: "normal",
    },
    spark: {
      texture: "spark", vxMin: -40, vxMax: 40,
      vyMin: 40, vyMax: 100, vzMin: -40, vzMax: 40,
      gravity: -150, startSize: 4, endSize: 1,
      lifetime: 0.4, lifetimeVariance: 0.2,
      startAlpha: 1, endAlpha: 0,
      tint: 0xffffaa, blendMode: "add",
    },
    star: {
      texture: "star", vxMin: -15, vxMax: 15,
      vyMin: 25, vyMax: 55, vzMin: -15, vzMax: 15,
      gravity: -40, startSize: 6, endSize: 3,
      lifetime: 0.8, lifetimeVariance: 0.2,
      startAlpha: 1, endAlpha: 0.5,
      tint: 0xffddff, blendMode: "add",
    },
  };

  function expandConfig(cfg) {
    const preset = PRESETS[cfg.kind] || PRESETS.fire;
    const out = { ...preset, ...cfg };
    delete out.kind;
    return out;
  }

  // ======================== Particle ========================
  class Particle {
    constructor() {
      this.x = this.y = this.z = 0;
      this.vx = this.vy = this.vz = 0;
      this.life = this.maxLife = 1;
      this.size = this.startSize = this.endSize = 8;
      this.alpha = this.startAlpha = this.endAlpha = 1;
      this.color = 0xffffff;
      this.active = false;
    }

    init(opts) {
      this.x = opts.x || 0;
      this.y = opts.y || 0;
      this.z = opts.z || 0;
      this.vx = opts.vx || 0;
      this.vy = opts.vy || 0;
      this.vz = opts.vz || 0;
      this.maxLife = Math.max(0.016, opts.life || 1);
      this.life = this.maxLife;
      this.startSize = opts.startSize || 8;
      this.endSize = opts.endSize != null ? opts.endSize : this.startSize;
      this.size = this.startSize;
      this.startAlpha = opts.startAlpha != null ? opts.startAlpha : 1;
      this.endAlpha = opts.endAlpha != null ? opts.endAlpha : 0;
      this.alpha = this.startAlpha;
      this.color = opts.color || 0xffffff;
      this.gravity = opts.gravity || 0;
      this.active = true;
    }

    update(dt) {
      if (!this.active) return;
      this.life -= dt;
      if (this.life <= 0) { this.active = false; return; }
      const t = 1 - this.life / this.maxLife;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.z += this.vz * dt;
      this.vy += this.gravity * dt;
      this.size = this.startSize + (this.endSize - this.startSize) * t;
      this.alpha = this.startAlpha + (this.endAlpha - this.startAlpha) * t;
    }
  }

  // ======================== Emitter ========================
  class Emitter {
    constructor(id, config) {
      this.id = id;
      this.config = config;
      this._particles = [];
      this._timer = 0;
      this._burnt = false;
    }

    reconfigure(config) {
      this.config = config;
    }

    update(dt, pool) {
      const cfg = this.config;
      if (cfg.type !== "burst") {
        this._timer += dt;
        const rate = cfg.rate || 10;
        const interval = 1 / rate;
        while (this._timer >= interval) {
          this._timer -= interval;
          this._spawn(pool);
        }
      } else if (!this._burnt) {
        this._burnt = true;
        const count = cfg.count || 1;
        for (let i = 0; i < count; i++) this._spawn(pool);
      }

      for (const p of this._particles) p.update(dt);

      for (let i = this._particles.length - 1; i >= 0; i--) {
        if (!this._particles[i].active) {
          pool.push(this._particles[i]);
          this._particles.splice(i, 1);
        }
      }
    }

    _spawn(pool) {
      let p = pool.pop();
      if (!p) p = new Particle();
      const cfg = this.config;

      const r = () => Math.random();
      const vx = cfg.vxMin + r() * (cfg.vxMax - cfg.vxMin);
      const vy = cfg.vyMin + r() * (cfg.vyMax - cfg.vyMin);
      const vz = cfg.vzMin + r() * (cfg.vzMax - cfg.vzMin);
      const life = (cfg.lifetime || 1) + (r() - 0.5) * (cfg.lifetimeVariance || 0);

      let sx = cfg.x || 0, sy = cfg.y || 0, sz = cfg.z || 0;
      if (cfg.spawnRadius > 0) {
        const a = r() * 2 * Math.PI;
        const r2 = r() * cfg.spawnRadius;
        sx += Math.cos(a) * r2;
        sz += Math.sin(a) * r2;
      }
      if (cfg.spawnHeight > 0) {
        sy += (r() - 0.5) * cfg.spawnHeight;
      }

      p.init({
        x: sx, y: sy, z: sz,
        vx, vy, vz,
        life: Math.max(0.016, life),
        startSize: cfg.startSize, endSize: cfg.endSize,
        startAlpha: cfg.startAlpha, endAlpha: cfg.endAlpha,
        color: cfg.tint !== undefined ? cfg.tint : 0xffffff,
        gravity: cfg.gravity || 0,
      });

      this._particles.push(p);
    }

    get hasParticles() { return this._particles.length > 0; }
    destroy(pool) {
      for (const p of this._particles) { pool.push(p); p.active = false; }
      this._particles.length = 0;
    }
  }

  // ======================== System ========================
  class System {
    constructor() {
      this._container = new PIXI.Container();
      this._container.name = "particle-system";
      this._emitters = [];
      this._pool = [];
      this._lastTime = 0;
    }

    get container() { return this._container; }

    updateEmitters(configs) {
      const byId = new Map();
      for (const e of this._emitters) byId.set(e.id, e);

      const next = [];
      for (const cfg of configs) {
        if (!cfg || !cfg.id) continue;
        let e = byId.get(cfg.id);
        if (e) {
          e.reconfigure(expandConfig(cfg));
          byId.delete(cfg.id);
        } else {
          e = new Emitter(cfg.id, expandConfig(cfg));
        }
        next.push(e);
      }

      for (const [, e] of byId) {
        e.destroy(this._pool);
      }

      this._emitters = next;
    }

    update() {
      const now = performance.now();
      if (!this._lastTime) { this._lastTime = now; return; }
      const dt = Math.min((now - this._lastTime) / 1000, 0.05);
      this._lastTime = now;

      for (const e of this._emitters) e.update(dt, this._pool);
    }

    syncSprites(toScreen) {
      const children = this._container.children;
      let used = 0;

      for (const e of this._emitters) {
        const cfg = e.config;
        const tex = _getTexture(cfg.texture);
        const blendAdd = cfg.blendMode === "add";

        for (const p of e._particles) {
          if (!p.active) continue;
          let spr;
          if (used < children.length) {
            spr = children[used];
            spr.visible = true;
            if (spr.texture !== tex) spr.texture = tex;
          } else {
            spr = new PIXI.Sprite(tex);
            spr.anchor.set(0.5);
            this._container.addChild(spr);
          }
          used++;

          const sc = toScreen(p.x, p.y, p.z);
          const ds = Math.max(0.25, Math.min(3, 1 / Math.max(0.0001, sc.w)));
          spr.position.set(sc.x, sc.y);
          spr.scale.set(ds * (p.size / 16));
          spr.alpha = Math.max(0, Math.min(1, p.alpha));
          spr.tint = p.color;
          spr.blendMode = blendAdd ? "add" : "normal";
        }
      }

      while (used < children.length) { children[used].visible = false; used++; }
    }

    clear() {
      for (const e of this._emitters) e.destroy(this._pool);
      this._emitters.length = 0;
      this._container.removeChildren();
    }
  }

  return { System, expandConfig, PRESETS };
})();
