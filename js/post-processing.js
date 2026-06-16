/* RPGAtlas — post-processing.js
   Bloom + Depth-of-Field pipeline for HD-2D.
   PIXI v8 Filter-based post-processing.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
"use strict";

const PostProcess = (() => {
  const PIXI = window.PIXI;

  // ---- shared fullscreen quad vertex shader ----
  const FSQ_VS = `
    attribute vec2 aPosition;
    uniform mat3 uProjectionMatrix;
    varying vec2 vTextureCoord;
    void main() {
      gl_Position = vec4((uProjectionMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
      vTextureCoord = aPosition;
    }
  `;

  // ---- bloom: bright-pass extraction ----
  const BRIGHT_FS = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float uThreshold;
    uniform float uIntensity;
    void main() {
      vec4 c = texture2D(uSampler, vTextureCoord);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      float bright = max(0.0, l - uThreshold) / max(1.0 - uThreshold, 0.001);
      gl_FragColor = vec4(c.rgb * bright * uIntensity, 1.0);
    }
  `;

  // ---- bloom: gaussian blur (horizontal) ----
  const BLUR_H_FS = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec2 uBlurSize;
    void main() {
      vec4 color = vec4(0.0);
      vec2 off = vec2(uBlurSize.x, 0.0);
      color += texture2D(uSampler, vTextureCoord - 4.0 * off) * 0.016216;
      color += texture2D(uSampler, vTextureCoord - 3.0 * off) * 0.054054;
      color += texture2D(uSampler, vTextureCoord - 2.0 * off) * 0.121622;
      color += texture2D(uSampler, vTextureCoord - 1.0 * off) * 0.194595;
      color += texture2D(uSampler, vTextureCoord)             * 0.227027;
      color += texture2D(uSampler, vTextureCoord + 1.0 * off) * 0.194595;
      color += texture2D(uSampler, vTextureCoord + 2.0 * off) * 0.121622;
      color += texture2D(uSampler, vTextureCoord + 3.0 * off) * 0.054054;
      color += texture2D(uSampler, vTextureCoord + 4.0 * off) * 0.016216;
      gl_FragColor = color;
    }
  `;

  // ---- bloom: gaussian blur (vertical) ----
  const BLUR_V_FS = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec2 uBlurSize;
    void main() {
      vec4 color = vec4(0.0);
      vec2 off = vec2(0.0, uBlurSize.y);
      color += texture2D(uSampler, vTextureCoord - 4.0 * off) * 0.016216;
      color += texture2D(uSampler, vTextureCoord - 3.0 * off) * 0.054054;
      color += texture2D(uSampler, vTextureCoord - 2.0 * off) * 0.121622;
      color += texture2D(uSampler, vTextureCoord - 1.0 * off) * 0.194595;
      color += texture2D(uSampler, vTextureCoord)             * 0.227027;
      color += texture2D(uSampler, vTextureCoord + 1.0 * off) * 0.194595;
      color += texture2D(uSampler, vTextureCoord + 2.0 * off) * 0.121622;
      color += texture2D(uSampler, vTextureCoord + 3.0 * off) * 0.054054;
      color += texture2D(uSampler, vTextureCoord + 4.0 * off) * 0.016216;
      gl_FragColor = color;
    }
  `;

  // ---- bloom: composite original + bloom ----
  const COMPOSITE_FS = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform sampler2D uBloomTexture;
    uniform float uBloomIntensity;
    void main() {
      vec4 scene = texture2D(uSampler, vTextureCoord);
      vec4 bloom = texture2D(uBloomTexture, vTextureCoord);
      gl_FragColor = vec4(mix(scene.rgb, scene.rgb + bloom.rgb, uBloomIntensity), scene.a);
    }
  `;

  // ---- DOF: screen-distance blur (center-focused) ----
  const DOF_FS = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec2  uFocusPoint;
    uniform float uFocusRange;
    uniform float uMaxBlur;
    uniform vec2  uPixelSize;
    void main() {
      vec2 uv = vTextureCoord;
      float dist = distance(uv, uFocusPoint);
      float blur = smoothstep(uFocusRange * 0.3, uFocusRange, dist) * uMaxBlur;
      if (blur < 0.5) {
        gl_FragColor = texture2D(uSampler, uv);
        return;
      }
      vec2 offsets[12];
      offsets[0]  = vec2( 0.0,      0.0 );
      offsets[1]  = vec2(-0.326,   -0.406);
      offsets[2]  = vec2( 0.527,   -0.120);
      offsets[3]  = vec2(-0.466,    0.476);
      offsets[4]  = vec2( 0.316,    0.418);
      offsets[5]  = vec2(-0.176,   -0.022);
      offsets[6]  = vec2( 0.415,    0.285);
      offsets[7]  = vec2(-0.561,   -0.073);
      offsets[8]  = vec2( 0.159,   -0.358);
      offsets[9]  = vec2(-0.345,    0.132);
      offsets[10] = vec2( 0.669,   -0.238);
      offsets[11] = vec2(-0.185,   -0.561);
      vec4 color = vec4(0.0);
      for (int i = 0; i < 12; i++) {
        vec2 suv = uv + offsets[i] * blur * uPixelSize * 2.0;
        color += texture2D(uSampler, clamp(suv, 0.0, 1.0));
      }
      gl_FragColor = color / 12.0;
    }
  `;

  // ======================== Pipeline ========================

  class Pipeline {
    constructor(app) {
      this._app = app;
      this._w = 0;
      this._h = 0;

      this._tmpContainer = new PIXI.Container();
      this._tmpContainer.name = 'postprocess-tmp';

      // ---- filters ----
      this._brightFilter = new PIXI.Filter({
        gl: { vertex: FSQ_VS, fragment: BRIGHT_FS },
        resources: { uThreshold: 0.8, uIntensity: 1.5 },
      });
      this._blurHFilter = new PIXI.Filter({
        gl: { vertex: FSQ_VS, fragment: BLUR_H_FS },
        resources: { uBlurSize: new Float32Array([0, 0]) },
      });
      this._blurVFilter = new PIXI.Filter({
        gl: { vertex: FSQ_VS, fragment: BLUR_V_FS },
        resources: { uBlurSize: new Float32Array([0, 0]) },
      });
      this._compositeFilter = new PIXI.Filter({
        gl: { vertex: FSQ_VS, fragment: COMPOSITE_FS },
        resources: { uBloomTexture: null, uBloomIntensity: 1.0 },
      });
      this._dofFilter = new PIXI.Filter({
        gl: { vertex: FSQ_VS, fragment: DOF_FS },
        resources: {
          uFocusPoint: new Float32Array([0.5, 0.5]),
          uFocusRange: 0.4,
          uMaxBlur: 3.0,
          uPixelSize: new Float32Array([0, 0]),
        },
      });

      // ---- render textures ----
      this._brightRT = null;
      this._blurHRT = null;
      this._blurVRT = null;
      this._compositeRT = null;
      this._dofRT = null;
    }

    _ensureRTs(w, h) {
      if (this._w === w && this._h === h) return;
      this._destroyRTs();
      this._w = w;
      this._h = h;
      const mk = () =>
        PIXI.RenderTexture.create({ width: w, height: h, scaleMode: 'linear' });
      this._brightRT = mk();
      this._blurHRT = mk();
      this._blurVRT = mk();
      this._compositeRT = mk();
      this._dofRT = mk();
      this._blurHFilter.resources.uBlurSize[0] = 1 / w;
      this._blurVFilter.resources.uBlurSize[1] = 1 / h;
      this._dofFilter.resources.uPixelSize[0] = 1 / w;
      this._dofFilter.resources.uPixelSize[1] = 1 / h;
    }

    _destroyRTs() {
      for (const rt of [
        this._brightRT, this._blurHRT, this._blurVRT,
        this._compositeRT, this._dofRT,
      ]) {
        if (rt) rt.destroy(true);
      }
      this._brightRT = this._blurHRT = this._blurVRT = null;
      this._compositeRT = this._dofRT = null;
    }

    _renderWithFilter(srcRT, filter, destRT) {
      this._tmpContainer.removeChildren();
      const spr = new PIXI.Sprite(srcRT);
      spr.filters = [filter];
      this._tmpContainer.addChild(spr);
      this._app.renderer.render(this._tmpContainer, {
        renderTexture: destRT,
        clear: true,
      });
    }

    _blitToScreen(srcRT) {
      this._tmpContainer.removeChildren();
      const spr = new PIXI.Sprite(srcRT);
      this._tmpContainer.addChild(spr);
      this._app.renderer.render(this._tmpContainer, { clear: true });
    }

    /**
     * Main entry: apply bloom/DOF to a scene render texture,
     * then render the final output to the PIXI canvas.
     * @param {PIXI.RenderTexture} sceneRT  – rendered scene (terrain + sprites + lighting)
     * @param {number}  w, h      – viewport dimensions
     * @param {object}  opts
     * @param {boolean} opts.bloom
     * @param {boolean} opts.dof
     * @param {number}  opts.bloomThreshold   – luminance threshold (0-1), default 0.8
     * @param {number}  opts.bloomIntensity   – bloom strength, default 1.5
     * @param {number}  opts.bloomBlurScale   – blur radius multiplier, default 1.0
     * @param {number}  opts.dofFocusX        – focus U (0-1), default 0.5
     * @param {number}  opts.dofFocusY        – focus V (0-1), default 0.5
     * @param {number}  opts.dofRange         – focus range, default 0.4
     * @param {number}  opts.dofMaxBlur       – max blur pixels, default 3.0
     */
    apply(sceneRT, w, h, opts = {}) {
      this._ensureRTs(w, h);

      const doBloom = opts.bloom === true;
      const doDOF = opts.dof === true;

      if (doBloom) {
        // update bloom parameters
        if (opts.bloomThreshold != null)
          this._brightFilter.resources.uThreshold = opts.bloomThreshold;
        if (opts.bloomIntensity != null) {
          this._brightFilter.resources.uIntensity = opts.bloomIntensity;
          this._compositeFilter.resources.uBloomIntensity = opts.bloomIntensity;
        }
        const bs = opts.bloomBlurScale != null ? opts.bloomBlurScale : 1.0;
        if (bs !== 1.0) {
          this._blurHFilter.resources.uBlurSize[0] = bs / this._w;
          this._blurVFilter.resources.uBlurSize[1] = bs / this._h;
        }

        // 1. bright-pass
        this._renderWithFilter(sceneRT, this._brightFilter, this._brightRT);
        // 2. horizontal blur
        this._renderWithFilter(this._brightRT, this._blurHFilter, this._blurHRT);
        // 3. vertical blur
        this._renderWithFilter(this._blurHRT, this._blurVFilter, this._blurVRT);
        // 4. composite
        this._compositeFilter.resources.uBloomTexture = this._blurVRT.source;
        this._renderWithFilter(sceneRT, this._compositeFilter, this._compositeRT);

        var intermediateRT = this._compositeRT;
      } else {
        var intermediateRT = sceneRT;
      }

      if (doDOF) {
        if (opts.dofFocusX != null) this._dofFilter.resources.uFocusPoint[0] = opts.dofFocusX;
        if (opts.dofFocusY != null) this._dofFilter.resources.uFocusPoint[1] = opts.dofFocusY;
        if (opts.dofRange != null)  this._dofFilter.resources.uFocusRange = opts.dofRange;
        if (opts.dofMaxBlur != null) this._dofFilter.resources.uMaxBlur = opts.dofMaxBlur;

        this._renderWithFilter(intermediateRT, this._dofFilter, this._dofRT);
        var finalRT = this._dofRT;
      } else {
        var finalRT = intermediateRT;
      }

      // final blit to screen
      this._blitToScreen(finalRT);
    }

    destroy() {
      this._destroyRTs();
      this._tmpContainer.removeChildren();
    }
  }

  return { Pipeline };
})();
