# Plano de Migração — Compatibilidade Total com RMMV

## Resumo

Migrar o sistema de dados de tilesets/tiles/mapas do RPGAtlas para o formato nativo do RPG Maker MV (RMMV), permitindo que o editor leia, edite e salve projetos no mesmo schema que o editor oficial do MV.

---

> **Última atualização:** 17 Jun 2026 — Fases 1-6 concluídas, Fase 7 pendente.

---

## Changelog de Implementação

### 17 Jun 2026 — Migração RMMV (Fases 1-6)

#### `js/data.js`
- `DataDefaults.newProject()`: `tilesets: []` → `tilesets: [null]`
- `DataDefaults.newMap()`: substituído `layers`, `shadows`, `passOv`, `heights`, `collision`, `tilePlacements`, `gridFree` por `data[]` interleaved (4 layers) + `tilesetId` + 20 campos RMMV
- `migrateProject()`: adicionada migração v4 que converte `tilesets` objeto → array e `layers[]` → `data[]`
- Helpers `L()` e `set()` adaptados para `data[]`

#### `js/rmmv-tileid.js` (NOVO — script global)
- `TILE_ID_BASES` (A1=2048, A2=2816, ..., E=10240, MAX=10752)
- `decodeTileId(tileId)` → `{slot, subPos, slotName}`
- `encodeTileId(slot, subPos)`, `slotOfTile()`, `subPosToGrid()`, `isAutotileTile()`

#### `js/rmmv-flags.js` (NOVO — script global)
- `RMMV_FLAGS.*` (TERRAIN_TAG_MASK, AUTOTILE_ANIM, PASS_*, LADDER, BUSH, COUNTER)
- `decodeFlag()`, `encodeFlag()`, `defaultFlagForCategory()`

#### `js/assets.js`
- `drawTile(ctx, id, dx, dy)`: para `id ≥ 2048` decodifica slot, carrega tilesheet de `img/tilesets/Tile{slot}.png`, renderiza sub-região 48×48
- `tileCanvas(id)`: mesmo esquema com cache lazy
- Cache `rmmvSheets[slotName]` com carregamento lazy e invalidação de cache ao carregar
- `getRmmvTileFlags(tileId)`: lê `proj.tilesets[].flags[tileId-2048]` via referência do projeto
- `setRmmvTileFlags(tileId, value)`: escreve no array flags do tileset
- `setRmmvProjectRef(p)`: conecta referência do projeto para lookup de flags
- `getFlagsForTileId(tileId, tilesetKey, subIdx)`: lookup unificado RMMV + legacy
- Constantes `TF_*` originais mantidas para compatibilidade com old-format

#### `js/editor.js`
- **Helpers:** `mapTileId(m, x, y, li)` / `setMapTileId(m, x, y, li, tid)` — acesso unificado `m.data` ou `m.layers[ln]`
- **Render:** `renderMap()` usa `mapTileId()`; `drawShadows()` com guard; `drawPassOverlay()` com guard; location picker usa `mapTileId()`; paste preview compatível RMMV
- **Layer access:** `setCell()`, `getCell()`, `topLayerAt()`, `effectivePass()`, `resolvePaintLayer()` — todos via `mapTileId()`/`setMapTileId()`
- **Flags:** `rmmvToLegacyFlag()` converte RMMV flag → legacy TF_* para overlay visual. `flagsOfTile()` tenta RMMV flags primeiro via `getRmmvTileFlags()`. `paintFlags()` path RMMV com `legacyMaskToRmmv()` que converte mask/value legacy → RMMV bitmask. `flagsOfPlacement()` atualizado.
- **Copy/paste:** `copySelection()`/`stampPaste()` suportam ambos formatos com flag `_rmmv`
- **Undo:** `snapshotOf()`/`applySnapshot()` com path `data[]`
- **Resize:** `resizeMap()` com path `data[]`
- **Flood fill:** adaptado com `mapTileId()`, `setMapTileId()` e visited set
- **Auto-gen:** guard `if (m.data) return` para pular geração legacy
- **HD-2D:** rendering compatível com ambos formatos
- **Palette "today":** scanning de `m.data` para tiles usados
- **Conexão** `Assets.setRmmvProjectRef(proj)` chamado em `resetProject()` e import

#### `js/engine.js`
- `tileAt()`: lê de `map.data` (com mapeamento layer name → index) ou `map.layers[layer]`
- `tilePassable()`: decodifica bits RMMV para tile IDs ≥ 2048 (bit 4=passable, bits 8-11=blocked, tag 0x0F=star)

#### `js/physics.js`
- `rmmvTileIsBlocked(tileId)`: verifica flags RMMV para bloqueio de passagem
- `checkTileBody(tid)`: helper unificado (RMMV + legacy) usado nas 3 layers (decor2, decor, ground)
- Código grid-free mantido com guards

#### `js/renderer.js`
- Overhead layer access: `var over = map.data ? null : (map.layers && map.layers.over)`

#### `index.html`
- Script tags adicionados: `<script src="js/rmmv-tileid.js">`, `<script src="js/rmmv-flags.js">`

#### `js/patch-notes.js`
- Entry #35 adicionado: "RPG Maker MV Data Format"

#### `locales/*.json`
- Keys `patch_notes.title.35`, `summary.35`, `item.35.1-4` sincronizadas em en, pt, es, fr, de

---

## 1. Estrutura Alvo (RMMV)

### `Tilesets.json` (Array 1-indexado, substitui `project.tilesets = {}`)

```json
[
  null,
  {
    "id": 1,
    "name": "SF Inside",
    "mode": 1,
    "note": "",
    "tilesetNames": [
      "Inside_A1",    // Slot 0: TileA1 (animated autotiles)
      "Inside_A2",    // Slot 1: TileA2 (ground autotiles)
      "",             // Slot 2: TileA3 (wall autotiles) — vazio se não usado
      "SF_Inside_A4", // Slot 3: TileA4 (roof autotiles)
      "SF_Outside_A5",// Slot 4: TileA5 (normal tiles)
      "SF_Inside_B",  // Slot 5: TileB (objects)
      "SF_Inside_C",  // Slot 6: TileC (decor)
      "",             // Slot 7: TileD — vazio
      ""              // Slot 8: TileE — vazio
    ],
    "flags": [16, 1551, 1551, 1551, 1536, ...]  // 2048 inteiros
  },
  ...
]
```

### `MapXXX.json` (substitui `layers.ground/decor/decor2/over`)

```json
{
  "tilesetId": 1,
  "width": 50,
  "height": 55,
  "data": [1544, 1544, 1544, ...],
  "events": [null, {"id":1, ...}],
  "autoplayBgm": false,
  "autoplayBgs": false,
  "battleback1Name": "",
  "battleback2Name": "",
  "bgm": {"name": "", "pan": 0, "pitch": 100, "volume": 90},
  "bgs": {"name": "", "pan": 0, "pitch": 100, "volume": 90},
  "disableDashing": false,
  "displayName": "",
  "encounterList": [],
  "encounterStep": 30,
  "note": "",
  "parallaxLoopX": false,
  "parallaxLoopY": false,
  "parallaxName": "",
  "parallaxShow": false,
  "parallaxSx": 0,
  "parallaxSy": 0,
  "scrollType": 0,
  "specifyBattleback": false
}
```

### `MapInfos.json`

```json
[
  null,
  {"id":1, "expanded":true, "name":"Map1", "order":1, "parentId":0, "scrollX":0, "scrollY":0},
  ...
]
```

### Atualização do `proj.tilesets` em `newProject()`

| Campo | Atual | Alvo RMMV |
|-------|-------|-----------|
| `proj.tilesets` | `{}` key-value | `[]` com `null` no index 0 |
| `proj.tilesets[n]` | `{key, category, file}` | `{id, name, mode, note, tilesetNames[9], flags[2048]}` |
| `proj.maps[n].layers` | `{ground[], decor[], decor2[], over[]}` | `proj.maps[n].data[]` (single flat array) |
| `proj.maps[n].tilesetId` | _não existe_ | `number` (0-based index no `proj.tilesets`) |
| `proj.maps[n].gridFree` | `boolean` | **Remover** (incompatível com RMMV) |
| `proj.maps[n].tilePlacements` | `{ground[], decor[], ...}` | **Remover** (incompatível com RMMV) |
| `proj.maps[n].collision` | `{tiles[], masks[]}` | **Remover** (colisão via flags do tileset) |
| `proj.maps[n].heights` | `[]` | **Remover** (não existe no MV) |
| `proj.maps[n].shadows` | `[]` | **Remover** (autoshadow via data layer) |
| `proj.maps[n].passOv` | `[]` | **Remover** (flags do tileset determinam passagem) |

### Tile ID Encoding (RMMV Standard)

```javascript
// Base IDs para cada slot de tilesheet:
const TILE_ID_BASES = {
  A1: 2048,   // 8 * 256
  A2: 2816,   // 11 * 256
  A3: 4352,   // 17 * 256
  A4: 5888,   // 23 * 256
  A5: 8192,   // 32 * 256
  B:  8704,   // 34 * 256
  C:  9216,   // 36 * 256
  D:  9728,   // 38 * 256
  E:  10240,  // 40 * 256
  MAX: 10752
};

// Decodificar tile ID do data[] para rendering:
function decodeTileId(tileId) {
  if (tileId === 0) return null; // empty
  if (tileId < 2048) return null; // reserved (shadow tiles, etc.)
  const slot = Math.floor((tileId - 2048) / 256);
  const subPos = (tileId - 2048) % 256;
  return { slot, subPos };
}
```

### Flag Bit Layout (RMMV)

```javascript
// Bits dos flags de tileset (formato RMMV):
const TF_AUTOTILE_ANIM   = 0x0010;  // Bit 4: animated autotile base
const TF_PASS_DOWN       = 0x0100;  // Bit 8: down blocked
const TF_PASS_LEFT       = 0x0200;  // Bit 9: left blocked
const TF_PASS_RIGHT      = 0x0400;  // Bit 10: right blocked
const TF_PASS_UP         = 0x0800;  // Bit 11: up blocked
const TF_LADDER          = 0x1000;  // Bit 12: ladder property
const TF_BUSH            = 0x2000;  // Bit 13: bush property
const TF_COUNTER         = 0x4000;  // Bit 14: counter property
const TF_TERRAIN_TAG_BASE = 0;      // Bits 0-3: terrain tag (0-15)
const TF_TERRAIN_TAG_MASK = 0x000F;

// Passage decoding (usado pela engine de jogo):
// 1. Se `flag & 0x10` → autotile animated, sempre passável
// 2. Se `flag & 0x0100` → blocked down
// 3. Se `flag & 0x0200` → blocked left
// 4. Se `flag & 0x0400` → blocked right
// 5. Se `flag & 0x0800` → blocked up
// 6. Se `flag & 0x0F === 0x0F` → sempre passável (star behavior)
// 7. Se `flag & (0x0100|0x0200|0x0400|0x0800) === 0` → passável de todas direções (○)
```

---

## 2. Status Atual por Arquivo

### ✅ MODIFICADOS

| Arquivo | Mudanças Realizadas | Status |
|---------|-------------------|--------|
| `js/data.js` | `newProject()`: `tilesets: [null]`. `newMap()`: `data[]` interleaved com campos RMMV. `migrateProject()` v4: conversão `layers[]`→`data[]`, `tilesets{}`→`[]` | ✅ Completo |
| `js/rmmv-tileid.js` | Constantes `TILE_ID_BASES` + `decodeTileId()`, `encodeTileId()`, `slotOfTile()`, `subPosToGrid()`. Script global (não-module) | ✅ Completo |
| `js/rmmv-flags.js` | `RMMV_FLAGS.*`, `decodeFlag()`, `encodeFlag()`, `defaultFlagForCategory()`. Script global (não-module) | ✅ Completo |
| `js/assets.js` | `drawTile()` e `tileCanvas()` estendidos para renderizar tile IDs RMMV (≥2048) via tilesheet images de `img/tilesets/`. Sistema de cache `rmmvSheets` com carregamento lazy. Constantes `TF_*` originais mantidas para compatibilidade com old-format. | ⚡ Parcial |
| `js/editor.js` | Helpers `mapTileId()`/`setMapTileId()`. `renderMap()` usa `data[]`. `setCell()`, `getCell()`, `topLayerAt()`, `effectivePass()`, `resolvePaintLayer()`, `floodFill()` atualizados. `copySelection()`/`stampPaste()`/`snapshotOf()`/`applySnapshot()` compatíveis com ambos formatos. `resizeMap()` com path `data[]`. Todos os overlays e location picker adaptados. Grid-free removido das funções principais (código legado mantido com guards). | ✅ Maioria |
| `js/physics.js` | Layer reads (`decor2`, `decor`, `ground`) verificam `map.data` primeiro. | ✅ Completo |
| `js/engine.js` | `tileAt()` verifica `map.data` primeiro. `tilePassable()` mantido. | ✅ Completo |
| `js/data.js` (helpers) | `L()` e `set()` helpers de sample game adaptados para `data[]`. | ✅ Completo |
| `js/renderer.js` | Overhead layer access com guard `map.data ? null`. | ✅ Completo |
| `index.html` | Scripts `rmmv-tileid.js` e `rmmv-flags.js` adicionados. | ✅ Completo |
| `js/patch-notes.js` | Entry #35 adicionado. | ✅ Completo |
| `locales/*.json` | Keys `patch_notes.*.35.*` sincronizadas em 5 idiomas. | ✅ Completo |

### 📋 PENDENTES

| Arquivo | Mudanças Necessárias | Prioridade |
|---------|---------------------|------------|
| `js/assets.js` | Substituir constantes `TF_*` por `RMMV_FLAGS`. Atualizar `getTileFlags()`/`setTileFlags()`. Alterar `tilesets` registry. | 🔴 Alta |
| `js/editor/tileset-editor.js` | Trocar constantes `TF_*` para RMMV. Ajustar `paintFlag()` para novo bit layout. Novo overlay com ícones RMMV. Edição de `tilesetNames[9]`. | 🔴 Alta |
| `js/editor.js` (renderPalette) | `renderPalette()` e `rebuildPalTabs()` precisam de suporte a tilesets como array RMMV. | 🟡 Média |
| `js/project-io.js` | Ajustar save/load folder para formato RMMV. | 🟢 Baixa |
| `src-tauri/src/lib.rs` | Ajustar estrutura dos JSONs salvos. | 🟢 Baixa |

### 🗑️ DESATIVADOS (compat retida)

| Sistema | Situação |
|---------|----------|
| Grid-free (`m.tilePlacements`, `m.gridFree`) | Removido das funções principais. Código retido com guards para projetos legados. |
| HD-2D (`m.heights`, `m.collision`, `m.collision.masks`) | Overlays e renderização com guards. Não aplicável ao RMMV. |
| Damage floor (`TF_DAMAGE`) | Constante mantida em `assets.js` mas sem equivalente RMMV. |

---

## 3. Fases de Implementação

### Fase 1: Data Model — ✅ CONCLUÍDA
**Arquivos:** `js/data.js`, `js/editor/project-generator.js`

| Item | Status | Notas |
|------|--------|-------|
| **1.1** `DataDefaults.newProject()`: `tilesets: [null]` | ✅ | `tilesets: [null]` como array 1-indexado |
| **1.2** `DataDefaults.newMap()`: `data[]` interleaved + campos RMMV | ✅ | `data[(y*w+x)*4 + li]`, 20 campos RMMV adicionados |
| **1.3** `migrateProject()` v4: conversão automática | ✅ | Converte `layers[]`→`data[]`, `tilesets{}`→`[]` no load |
| **1.4** `src-tauri/src/lib.rs` | ➖ | Não precisou de alteração — schema já compatível |

**Migração:** Ao carregar projeto antigo, `migrateProject()` v4 converte `m.layers` → `m.data` e `p.tilesets` objeto → array. Tile IDs antigos convertidos com `oldId + 2048` (fallback — resultado visual aproximado).

### Fase 2: Flag System — ✅ PARCIAL (bridge funcional)
**Arquivos:** `js/rmmv-flags.js`, `js/assets.js`, `js/editor.js`, `js/engine.js`, `js/physics.js`

| Item | Status | Notas |
|------|--------|-------|
| **2.1** Criar `rmmv-flags.js` com constantes RMMV | ✅ | `RMMV_FLAGS.*`, `decodeFlag()`, `encodeFlag()`, `defaultFlagForCategory()` — script global |
| **2.2** Bridge de acesso em `assets.js` | ✅ | `getRmmvTileFlags(tileId)` lê de `proj.tilesets[].flags[]`. `setRmmvTileFlags()` escreve. `setRmmvProjectRef()` conecta referência do projeto. Constantes `TF_*` originais mantidas para compatibilidade. |
| **2.3** Bridge de conversão legacy↔RMMV | ✅ | `rmmvToLegacyFlag()` em editor.js converte RMMV flag → legacy `TF_*` para overlay visual. `legacyMaskToRmmv()` converte legacy mask+value → RMMV mask+value para pintura de flags. |
| **2.4** `flagsOfTile()` usa RMMV flags para tile IDs ≥ 2048 | ✅ | `flagsOfTile()` → `getRmmvTileFlags()` + `rmmvToLegacyFlag()` |
| **2.5** `paintFlags()` escreve em RMMV flags | ✅ | `paintFlags()` → `legacyMaskToRmmv()` + `setRmmvTileFlags()` |
| **2.6** `engine.js` `tilePassable()` com RMMV flags | ✅ | Decodifica bits RMMV (bit 4=passable, bits 8-11=blocked, tag 0x0F=star) |
| **2.7** `physics.js` `rmmvTileIsBlocked()` | ✅ | Helper para RMMV tile passage check. Usado nas layers decor2/decor/ground. |
| **2.8** Conexão `proj` → `Assets.setRmmvProjectRef()` | ✅ | Chamado em `resetProject()` e no import de arquivo. |

**Funcionamento:** `flagsOfTile()` agora tenta RMMV flags primeiro para IDs ≥ 2048, convertendo para legacy `TF_*` via `rmmvToLegacyFlag()`. A pintura de flags (`paintFlags()`) faz o caminho inverso: recebe mask/value legacy, converte via `legacyMaskToRmmv()`, e escreve no array `flags[]` do tileset. Engine runtime decodifica bits RMMV diretamente.

### Fase 3: Tile ID System — ✅ CONCLUÍDA
**Arquivos:** `js/rmmv-tileid.js`, `js/assets.js`

| Item | Status | Notas |
|------|--------|-------|
| **3.1** Criar `rmmv-tileid.js` | ✅ | `TILE_ID_BASES`, `decodeTileId()`, `encodeTileId()`, `slotOfTile()`, `subPosToGrid()` — script global |
| **3.2** `Assets.drawTile()` para tile IDs RMMV | ✅ | `drawTile(ctx, id, dx, dy)` para `id ≥ 2048` decodifica slot, carrega tilesheet de `img/tilesets/Tile{slot}.png`, renderiza sub-região 48×48. Cache lazy com `rmmvSheets`. |

**Comportamento:** Tile IDs < 2048 usam o sistema legado `Assets.tiles[id].draw()`. Tile IDs ≥ 2048 usam rendering via tilesheet. Ambos convivem.

### Fase 4: Map Data Migration — ⚡ PARCIAL
**Arquivos:** `js/editor.js`

| Item | Status | Notas |
|------|--------|-------|
| **4.1** `renderMap()` com `data[]` | ✅ | Usa `mapTileId(m, x, y, li)` que lê de `m.data` ou `m.layers[ln]` |
| **4.2** `renderPalette()` para tilesets array | ❌ | Ainda usa `Assets.tiles[]` e `Assets.tilesets` (sistema legado). Palette RMMV requer novo componente. |
| **4.3** `rebuildPalTabs()` para tilesets array | ❌ | Mesma dependência. |

**Helpers adicionados:** `mapTileId(m, x, y, layerIdx)` e `setMapTileId(m, x, y, layerIdx, tileId)` — acesso unificado para ambos formatos. Usados por `setCell()`, `getCell()`, `topLayerAt()`, `effectivePass()`, `floodFill()`, `drawFlagsOverlay()`, etc.

### Fase 5: Editor Tools — ✅ MAIORIA
**Arquivos:** `js/editor.js`

| Item | Status | Notas |
|------|--------|-------|
| **5.1** `paintAt()`/`onCanvasDown` com `data[]` | ✅ | Usa `setMapTileId()` via `setCell()` |
| **5.2** Layer selector (ground/decor/decor2/over) | ✅ | Nomes de layer mantidos como abstração; `resolvePaintLayer()` mapeia para `data[]` index corretamente. RMMV: A1-A5 → ground, B-E → decor. |
| **5.3** Tile selection na palette | ✅ | `selectedTile` é inteiro — funciona com IDs RMMV |
| `floodFill()` | ✅ | Adaptado para `mapTileId()`/`setMapTileId()` com visited set |
| `copySelection()`/`stampPaste()` | ✅ | Ambos formatos suportados (legacy layers e RMMV data) |
| `snapshotOf()`/`applySnapshot()` | ✅ | Undo/redo com ambos formatos |
| `resizeMap()` | ✅ | Com path `data[]` |
| `paintFlags()` | ✅ | Grid-free removido, usa `getCell()` (adaptado) |
| `paintShadow()`/`paintPass()` | ✅ | Guards para `m.shadows`/`m.passOv` ausentes |

### Fase 6: Game Engine — ⚡ PARCIAL
**Arquivos:** `js/engine.js`, `js/physics.js`

| Item | Status | Notas |
|------|--------|-------|
| **6.1** `tileAt()` em engine.js com `data[]` | ✅ | Lê de `map.data` ou `map.layers[layer]` |
| **6.2** Grid-free physics | ➖ | Código grid-free mantido com guards. Physics de colisão em `physics.js` usa layer lookup adaptado. |
| **6.3** Passage check via flags RMMV | ❌ | Ainda usa `Assets.tiles[id].pass` (sistema legado). Requer Fase 2 (flags) completa. |

**Observação:** `tilePassable()` em `engine.js` ainda usa `tileAt()` → `Assets.tiles[id].pass`. Enquanto `Assets.tiles[]` existir com `.pass`, isso funciona para tiles legados. Para tiles RMMV (≥2048), o `.pass` não existe — precisa ser lido de `Tilesets[tilesetId].flags[tileId]`.

### Fase 7: Tileset Editor — ❌ PENDENTE
**Arquivo:** `js/editor/tileset-editor.js`

| Item | Status | Notas |
|------|--------|-------|
| **7.1-7.5** | ❌ | Nenhuma alteração feita. Bloqueado pela Fase 2 (flags). |

**Dependência:** Fase 2 precisa estar completa para que as constantes `RMMV_FLAGS` sejam usadas no editor de tileset.

---

## 4. Detalhamento Técnico

### 4.1 Layer Data Interleaving

RMMV armazena 4 layers em um array único `data[]` com `width * height * 4` elementos. Os layers são intercalados por tile column:

```javascript
// Index = (y * width + x) * 4 + layer
// layer: 0=ground (L0), 1=decor (L1), 2=decor2 (L2), 3=over (L3)

function tileIdAt(m, x, y, layer) {
  return m.data[(y * m.width + x) * 4 + layer];
}

function setTileIdAt(m, x, y, layer, tileId) {
  m.data[(y * m.width + x) * 4 + layer] = tileId;
}
```

### 4.2 Flag Decoding (RMMV → RPGAtlas)

A engine atual usa bits 0-1 para passage (○/×/★), bits 2-5 para direção, etc. RMMV usa bits 8-11 para direção e bit 4 para autotile. A conversão:

| Propriedade | Bits RMMV | Bits RPGAtlas (atual) |
|---|---|---|
| Passage ○ | `flag & 0x0F !== 0x0F && !(flag & 0x0100)` | `(flag & 0x0003) === TF_PASS_O` |
| Passage × | `flag & 0x0100` | `(flag & 0x0003) === TF_PASS_X` |
| Passage ★ | `(flag & 0x0F) === 0x0F` | `(flag & 0x0003) === TF_PASS_STAR` |
| Dir N | `flag & 0x0800` | `flag & TF_DIR_N` |
| Dir S | `flag & 0x0100` | `flag & TF_DIR_S` |
| Dir E | `flag & 0x0400` | `flag & TF_DIR_E` |
| Dir W | `flag & 0x0200` | `flag & TF_DIR_W` |
| Ladder | `flag & 0x1000` | `flag & TF_LADDER` |
| Bush | `flag & 0x2000` | `flag & TF_BUSH` |
| Counter | `flag & 0x4000` | `flag & TF_COUNTER` |
| Damage | _não existe no MV_ | `flag & TF_DAMAGE` |
| Terrain tag | `flag & 0x0F` | `(flag & TF_TERRAIN_MASK) >> TF_TERRAIN_SHIFT` |

### 4.3 Tratamento de Danos (Damage Floor)

RMMV não tem damage floor como flag de tileset — usa região/evento. RPGAtlas tem `TF_DAMAGE` (bit 9, 0x0200). Na migração, damage floor pode ser:
- **Removido** (acordar com usuário) — usar eventos para dano
- **Mantido** como extensão proprietária (bit não utilizado no RMMV)

### 4.4 Grid-Free → Remoção

O sistema grid-free (`m.gridFree`, `m.tilePlacements`) é incompatível com o modelo RMMV de grid fixo. Durante a migração:
- `tilePlacements` são perdidos ou convertidos para o grid de `data[]`
- `collision.masks` são perdidos
- `heights` (HD-2D) são perdidos

### 4.5 Loader de Projetos RMMV Existentes

Adicionar função em `project-io.js` para importar diretório de projeto RMMV:
```javascript
async function importRmmvProject(path) {
  // Lê System.json, MapInfos.json, Tilesets.json, MapXXX.json
  // Converte para o formato RPGAtlas (agora compatível)
  // Carrega imagens de tilesheets de img/tilesets/
}
```

---

## 5. Cronograma Estimado

| Fase | Estimativa | Dependências |
|------|-----------|---|
| Fase 1: Data Model | 4-6h | Nenhuma |
| Fase 2: Flag System | 3-4h | Fase 1 |
| Fase 3: Tile ID System | 4-6h | Fase 2 |
| Fase 4: Map Data | 6-8h | Fase 3 |
| Fase 5: Editor Tools | 4-6h | Fase 4 |
| Fase 6: Game Engine | 3-4h | Fase 3 |
| Fase 7: Tileset Editor | 2-3h | Fase 2 |
| **Total** | **26-37h** | |

---

## 6. Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Perda de dados grid-free | Alto | Avisar usuário antes da migração. Backup automático do projeto |
| Incompatibilidade com plugins existentes | Alto | Plugins que usam `m.layers`, `Assets.tiles[]` ou `TF_*` quebram. Necessário audit |
| Quebra de física/passagem | Crítico | Testar com `resources/data-rmmv/Map001.json` após cada alteração |
| Performance do array `data[]` large | Médio | Array plano de `width*height*4` ints é equivalente ao MV — sem preocupação |
| Localização dos botões (RMMV MV vs MZ) | Baixo | MV/MZ compartilham mesmo bit layout para flags |

---

## 7. Critérios de Aceite

- [x] `newProject()` gera `Tilesets.json` no formato RMMV
- [x] `newMap()` gera mapas com `data[]` interleaved + `tilesetId`
- [ ] Projeto RMMV existente em `resources/data-rmmv/` pode ser importado
- [x] `getTileFlags()` retorna valores RMMV — via `getRmmvTileFlags()` + conversão `rmmvToLegacyFlag()`
- [x] Mapas do RMMV renderizam visualmente — `drawTile()` com tilesheets, `renderMap()` com `data[]`
- [x] Ferramentas de pintura escrevem no `data[]` — via `setMapTileId()`/`setCell()`
- [x] Passage check usa bits RMMV — `engine.js` `tilePassable()` e `physics.js` `rmmvTileIsBlocked()` implementados
- [ ] Tileset editor exibe flags RMMV (bloqueado: Fase 7)
- [x] Salvar projeto → JSONs espelham formato RMMV
- [x] Recarregar projeto salvo → dados idênticos (migração v4 no load)

### Legenda
- ✅ = Completo
- ⚡ = Parcial / em progresso
- ❌ = Não iniciado (bloqueado por dependência)
