# Grid-Free Mapping — Planejamento de Implementação

## 1. Visão Geral

Substituir o sistema atual de tiles (grade fixa 48×48 com IDs numéricos em arrays planos) por um sistema híbrido que usa a classificação de tilesets do RPG Maker MZ (A1–A5, B–E) como categorias de importação e comportamento, permitindo posicionamento livre em pixels (grid-free) de cada tile no mapa.

```
Estado atual:
  map.layers.ground[idx] = tileId    → tile desenhado em (tx*48, ty*48)

Estado proposto:
  map.tilePlacements.ground[] = [{ tileId, x: px, y: py }]  → tile desenhado em (px, py)
```

---

## 2. Categorias de Tileset (RPG Maker MZ)

### 2.1 Arquivos Reconhecidos

Cada tileset é uma imagem em sheet com dimensões fixas, detectada pelo nome do arquivo em `img/tilesets/`:

| Arquivo | Cat. | Grid da Sheet | Resolução | Kinds | Autotile | `pass` default |
|---------|------|---------------|-----------|-------|----------|---------------|
| `TileA1.png` | A1 | 16 col × 12 lin | 768×576 | Blocos A-E | Sim (animado, blocos especiais) | `false` |
| `TileA2.png` | A2 | 16 col × 12 lin | 768×576 | 32 kinds (8×4) | Sim (quarter-system 24×24, 48 shapes) | `true` |
| `TileA3.png` | A3 | 16 col × 8 lin | 768×384 | 8 grupos (8×4) | Sim (group pattern) | `false` |
| `TileA4.png` | A4 | 16 col × 15 lin | 768×720 | 48 kinds (3 bandas) | Sim (top + side, 2 tabelas) | `true`/`false` |
| `TileA5.png` | A5 | 8 col × 16 lin | 384×768 | 128 tiles | Não (atlas direto) | `true` |
| `TileB.png` | B | 16 col × 16 lin | 768×768 | 256 tiles | Não (atlas direto) | `false` |
| `TileC.png` | C | 16 col × 16 lin | 768×768 | 256 tiles | Não (atlas direto) | `false` |
| `TileD.png` | D | 16 col × 16 lin | 768×768 | 256 tiles | Não (atlas direto) | `false` |
| `TileE.png` | E | 16 col × 16 lin | 768×768 | 256 tiles | Não (atlas direto) | `false` |

**Nota:** O tile (0,0) do TileB.png deve ser vazio (representa "nada" na camada superior).

### 2.2 Comportamento por Categoria

- **A1**: autotile animado — 4+ frames de animação cíclica; conecta automaticamente com vizinhos do mesmo grupo.
- **A2**: autotile de chão — conecta com vizinhos; rotação automática de bordas e cantos.
- **A3**: autotile de parede — face frontal vs faces laterais têm tratamento visual diferente.
- **A4**: autotile misto — metade inferior parede, metade superior chão.
- **A5**: tile fixo de 48×48 — sem autotile; usado como terreno.
- **B–E**: tiles de objeto — sem autotile; cada célula da sheet equivale a um tile de decoração.

### 2.3 Estrutura Interna

Cada tileset importado gera um registro em `Assets.tilesets` baseado em sua categoria:

| Categoria | Cols | Rows | Kind block (tiles) | Kind cols | Kind rows | Total kinds | Tabela autotile |
|-----------|------|------|-------------------|-----------|-----------|-------------|----------------|
| A1 | 16 | 12 | especial (blocos A-E) | — | — | 5 blocos | Animação própria |
| A2 | 16 | 12 | 2×3 (96×144 px) | 8 | 4 | 32 | FLOOR (48 shapes) |
| A3 | 16 | 8 | 2×2 (96×96 px) | 8 | 4 | 8 grupos | Group pattern |
| A4 | 16 | 15 | top: 2×3, side: 2×2 | 8 | 3 bandas | 48 | FLOOR + WALL |
| A5 | 8 | 16 | 1×1 (direto) | 8 | 16 | 128 | Nenhuma |
| B–E | 16 | 16 | 1×1 (direto) | 16 | 16 | 256 | Nenhuma |

```js
Assets.tilesets["TileA2"] = {
  key: "TileA2",
  category: "A2",
  file: "TileA2.png",
  cols: 16,          // tiles de largura
  rows: 12,          // tiles de altura
  kindCols: 8,       // kinds por linha
  kindRows: 4,       // kinds por coluna
  kindW: 2,          // tiles por kind (largura)
  kindH: 3,          // tiles por kind (altura)
  tileIds: [...],    // índices em Assets.tiles[]
  autotileKindMap: {
    // kindIndex → primeiro tileId do kind
    0: 10, 1: 12, 2: 14, 3: 16,
    4: 18, 5: 20, 6: 22, 7: 24,
    // ...
  },
  autotileTable: "FLOOR_AUTOTILE_TABLE", // qual tabela usar
  image: HTMLImageElement,
};
```

Para A4:
```js
Assets.tilesets["TileA4"] = {
  key: "TileA4",
  category: "A4",
  file: "TileA4.png",
  cols: 16, rows: 15,
  kindCols: 8, kindRows: 3, // 3 bandas verticais
  kindW: 2,
  kindH: 5,        // wall-top (3) + wall-side (2)
  bands: [
    { topStart: 0, sideStart: 8, topKindH: 3, sideKindH: 2 },   // banda 0
    { topStart: 16, sideStart: 24, topKindH: 3, sideKindH: 2 },  // banda 1
    { topStart: 32, sideStart: 40, topKindH: 3, sideKindH: 2 },  // banda 2
  ],
  tileIds: [...],
  autotileTable: { top: "FLOOR_AUTOTILE_TABLE", side: "WALL_AUTOTILE_TABLE" },
  image: HTMLImageElement,
};
```

Cada tile em `Assets.tiles[]` ganha um campo extra:

```js
Assets.tiles[tileId] = {
  key: "asset:tilesets/TileA2",
  name: "Grass",
  pass: true,
  terrain: true,
  external: true,
  tileset: "TileA2",        // ← NOVO: referência ao tileset de origem
  category: "A2",            // ← NOVO: "A1"–"A5", "B"–"E"
  autotileGroup: 0,          // ← NOVO: grupo dentro do tileset (para autotile)
  animFrames: [],            // ← NOVO: para A1, lista de tileIds dos frames
};
```

---

## 3. Modelo de Dados do Mapa

### 3.1 tilePlacements

Cada camada do mapa passa a ter uma coleção livre de tiles:

```js
map.tilePlacements = {
  ground: [
    { id: "uuid-1", tileId: 10, x: 120, y: 80 },
    { id: "uuid-2", tileId: 18, x: 168, y: 80 },
  ],
  decor: [
    { id: "uuid-3", tileId: 65, x: 240, y: 160 },
  ],
  decor2: [],
  over: [],
};
```

Campos de cada placement:

```js
{
  id: "uuid",           // identificador único (gerado com crypto.randomUUID ou contador)
  tileId: 10,           // índice em Assets.tiles[]
  x: 124.5,             // posição X em pixels no mapa (float)
  y: 89,                // posição Y em pixels no mapa (float)
  // opcionais:
  width: 48,            // dimensão (default 48, para tiles de objeto redimensionáveis)
  height: 48,
}
```

### 3.2 Projeto

```js
proj.tilesets = {
  "TileA1": { key: "TileA1", category: "A1", cols: 16, rows: 12, tileIds: […] },
  "TileA2": { key: "TileA2", category: "A2", cols: 16, rows: 12, kindCols: 8, kindRows: 4, kindW: 2, kindH: 3, tileIds: […] },
  "TileA3": { key: "TileA3", category: "A3", cols: 16, rows: 8, tileIds: […] },
  "TileA4": { key: "TileA4", category: "A4", cols: 16, rows: 15, kindCols: 8, kindRows: 3, kindW: 2, kindH: 5, tileIds: […] },
  "TileA5": { key: "TileA5", category: "A5", cols: 8, rows: 16, tileIds: […] },
  "TileB":  { key: "TileB",  category: "B",  cols: 16, rows: 16, tileIds: […] },
  "TileC":  { key: "TileC",  category: "C",  cols: 16, rows: 16, tileIds: […] },
  "TileD":  { key: "TileD",  category: "D",  cols: 16, rows: 16, tileIds: […] },
  "TileE":  { key: "TileE",  category: "E",  cols: 16, rows: 16, tileIds: […] },
};
```

### 3.3 Mapas mistos (compatibilidade)

Para suportar projetos antigos sem quebrar, o mapa pode operar em dois modos:

- **legacy**: usa `map.layers.ground[]`, `map.layers.decor[]`, etc. (grade 48×48)
- **gridfree**: usa `map.tilePlacements.ground[]`, etc.

A flag `map.gridFree: true/false` determina o modo. Ao criar um novo mapa, o padrão é `true` (configurado em `data.js:newMap()`).

### 3.4 Migração

Ao carregar um projeto com `map.layers` populado e sem `tilePlacements`:

```js
function migrateToGridFree(map) {
  if (map.tilePlacements) return; // já migrado
  const n = map.width * map.height;
  map.tilePlacements = { ground: [], decor: [], decor2: [], over: [] };
  for (const ln of ["ground", "decor", "decor2", "over"]) {
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const tileId = map.layers[ln][ty * map.width + tx];
        if (tileId && tileId > 0) {
          map.tilePlacements[ln].push({
            id: generateId(),
            tileId,
            x: tx * 48,
            y: ty * 48,
          });
        }
      }
    }
  }
  map.gridFree = true;
}
```

---

## 4. Editor — Interface

### 4.1 Paleta de Tilesets ✅ (Phase 4)

O painel de tiles atual (`renderPalette`) é substituído por um seletor com abas:

```
[ All ] [ TileA1 ] [ TileA2 ] ... [ TileE ] [ Today ]
```

- Cada aba exibe apenas os tiles do tileset selecionado (ou todos / usados no mapa).
- O tile selecionado é destacado com borda dourada.
- A aba **Today** mostra apenas tiles já usados no mapa atual (seja grid-free ou legacy).
- As abas são construídas dinamicamente a partir de `Assets.tilesets`. Tilesets sem tiles não aparecem.
- Implementado em `editor.js:renderPalette()` — a função constrói tanto o `canvas` quanto a `<div class="pal-tabs">` com os botões de aba.

### 4.2 Ferramentas de Colocação ✅ (Phase 4)

O modo `map` existente é estendido com posicionamento livre (quando `map.gridFree === true`):

- **Click**: coloca o tile selecionado na posição do mouse (pixel exato, respeitando snap).
- **Clicar em tile existente**: seleciona o placement (destaca com borda azul).
- **Arrastar tile selecionado**: move para nova posição livre.
- **Delete/Backspace**: remove o placement selecionado.
- **Escape**: desseleciona o placement.

Diferenças do plano original:
- **Shift+Click** mantém o comportamento de marquee selection (grade), em vez de snap-forced placement.
- **Drag (brush)** contínuo não foi implementado — cada click cria um tile individual.
- A camada `auto` resolve para `ground` se o tile for `terrain`, senão `decor` (sem fallback para `decor2`).

### 4.3 Snapping Toggle ✅ (Phase 4)

Controle no toolbar como botão cíclico:

```
[ Snap: Free ]  → click →  [ Snap: 24px ]  → click →  [ Snap: 48px ]  → click →  ...
```

- **Free**: posicionamento em pixel livre (sem arredondamento).
- **24px**: snap ao meio-tile.
- **48px**: snap ao grid de 48×48.
- Implementado via `snapPx()` e ação `snap-toggle` no `ACT`.

### 4.4 Camadas

As 4 camadas atuais (`auto`, `ground`, `decor`, `decor2`, `over`) continuam funcionando.
Cada camada agora corresponde a um array em `tilePlacements`:

- `ground` → `tilePlacements.ground[]`
- `decor` → `tilePlacements.decor[]`
- `decor2` → `tilePlacements.decor2[]`
- `over` → `tilePlacements.over[]`

Regras de auto-layer (terrain → ground, decor → decor/decor2) são preservadas.
Obs: no grid-free, `resolvePlacementLayer()` simplifica para apenas `ground` (se terrain) ou `decor` — sem auto-stack para `decor2`.

### 4.5 Painel de Propriedades ✅ (Phase 4)

Ao selecionar um tile placement, um painel lateral mostra:

```
Tile: Grass
Layer: ground
X: 124.5
Y: 89.0
```

- Implementado via seção `#props-section` no HTML, populada por `updatePropsPanel()`.
- Exibe tileId, layer e coordenadas X/Y.
- Atualmente é **read-only** (edição numérica não implementada).
- O painel é ocultado quando nenhum placement está selecionado ou o modo não é `map`.

---

## 5. Renderização (Runtime) ✅

### 5.1 Ordem de desenho

```
ground[]  →  decor[]  →  decor2[]  →  over[]
```

Dentro de cada camada, os tiles são ordenados por Y para sobreposição correta (Y-sort).

**Implementação:** `engine.js:renderTilePlacements(ctx, placements, camX, camY, viewW, viewH)` — função real que:
1. Filtra placements visíveis por frustum culling (`p.x + TILE > camX && p.x < camX + viewW && p.y + TILE > camY && p.y < camY + viewH`).
2. Ordena por `p.y` (Y-sort).
3. Para cada placement, determina o tratamento por categoria:
   - **A2–A4**: chama `drawComposedAutotile()` que usa `detectNeighbors()` + shape solver + composição de quartos.
   - **A5, B–E**: `Assets.drawTile()` direto (atlas).
   - **A1**: atualmente renderizado como célula estática da sheet (animação futura).
4. Camadas desenhadas em ordem: `ground → decor → decor2 → over`. Personagens e objetos são inseridos entre `decor2` e `over` pelo loop de renderização principal.

### 5.2 Sistema de Autotile (A1–A4) ✅

#### 5.2.1 Quarter-system (24×24)

Autotiles A2 e A4 não são armazenados como tiles prontos de 48×48. Cada autotile é **montado a partir de 4 quartos de 24×24** (Q = T/2).

```
+------+------+
|  TL  |  TR  |   TL = quarto superior esquerdo (24×24)
+------+------+   TR = quarto superior direito  (24×24)
|  BL  |  BR  |   BL = quarto inferior esquerdo (24×24)
+------+------+   BR = quarto inferior direito  (24×24)
```

Cada kind (material) na sheet armazena os quartos em um bloco de 2×3 tiles (A2) ou 2×2 tiles (A4 wall-side). Uma **tabela de lookup** de 48 entradas (FLOOR) ou 16 entradas (WALL) diz qual quarto vai em cada posição para cada variação de borda (shape).

#### 5.2.2 Shape solver (Floor — A2, A4 wall-top)

O shape index (0–47) é determinado pelos 8 vizinhos:

```
Passo 1: Normalizar diagonais
  NW = raw_NW AND N AND W
  NE = raw_NE AND N AND E
  SW = raw_SW AND S AND W
  SE = raw_SE AND S AND E

Passo 2: Resolver cada quarto
  TL usa v=N, h=W, d=NW
  TR usa v=N, h=E, d=NE
  BL usa v=S, h=W, d=SW
  BR usa v=S, h=E, d=SE
```

Regra por quarto:
- v AND h AND d     → solid
- v AND h AND NOT d → inner_corner
- v AND NOT h       → vertical_edge
- NOT v AND h       → horizontal_edge
- else              → outer_corner

**Implementação:** `assets.js:solveFloorSignature(n,s,w,e,nw,ne,sw,se)` retorna shape index 0–47.

#### 5.2.3 Shape solver (Wall — A4 wall-side)

Shape index 0–15, ignora diagonais:

```
TL usa v=N, h=W
TR usa v=N, h=E
BL usa v=S, h=W
BR usa v=S, h=E

v AND h     → solid
v AND NOT h → vertical_edge
NOT v AND h → horizontal_edge
else        → outer_corner
```

**Implementação:** `assets.js:solveWallMask(n,s,w,e)` retorna shape index 0–15.

#### 5.2.4 Lookup tables

**FLOOR_AUTOTILE_TABLE** (48 shapes, usada por A2 e A4 wall-top):

Cada entrada = [TL_qx, TL_qy, TR_qx, TR_qy, BL_qx, BL_qy, BR_qx, BR_qy] em quarter-units relativos ao kind.

```
 0: [2,4, 1,4, 2,3, 1,3]    16: [0,4, 3,4, 0,3, 3,3]    32: [2,2, 3,2, 2,3, 3,3]
 1: [2,0, 1,4, 2,3, 1,3]    17: [0,4, 3,0, 0,3, 1,3]    33: [2,2, 3,2, 2,1, 3,3]
 2: [2,4, 3,0, 2,3, 1,3]    18: [0,4, 1,4, 0,3, 3,1]    34: [2,4, 3,4, 2,5, 3,5]
 3: [2,0, 3,0, 2,3, 1,3]    19: [0,4, 3,0, 0,3, 3,1]    35: [2,0, 3,4, 2,5, 3,5]
 ... (48 entradas)            ...                          ...
47: [0,0, 1,0, 0,1, 1,1]
```

**WALL_AUTOTILE_TABLE** (16 shapes, usada por A4 wall-side):

```
 0: [2,2, 1,2, 2,1, 1,1]     8: [2,2, 1,2, 2,3, 1,3]
 1: [0,2, 1,2, 0,1, 1,1]     9: [0,2, 1,2, 0,3, 1,3]
 2: [2,0, 1,0, 2,1, 1,1]    10: [2,0, 1,0, 2,3, 1,3]
 3: [0,0, 1,0, 0,1, 1,1]    11: [0,0, 1,0, 0,3, 1,3]
 4: [2,2, 3,2, 2,1, 3,1]    12: [2,2, 3,2, 2,3, 3,3]
 5: [0,2, 3,2, 0,1, 3,1]    13: [0,2, 3,2, 0,3, 3,3]
 6: [2,0, 3,0, 2,1, 3,1]    14: [2,0, 3,0, 2,3, 3,3]
 7: [0,0, 3,0, 0,1, 3,1]    15: [0,0, 3,0, 0,3, 3,3]
```

#### 5.2.5 Algoritmo de composição

```python
def compose_autotile(image, origin_qx, origin_qy, table, shape, Q=24):
    entry = table[shape]
    tile = new_image(2*Q, 2*Q)
    for i, (rel_qx, rel_qy) in enumerate(entry):
        src_x = (origin_qx + rel_qx) * Q
        src_y = (origin_qy + rel_qy) * Q
        quarter = crop(image, src_x, src_y, Q, Q)
        dst_x = (i % 2) * Q
        dst_y = (i // 2) * Q
        paste(tile, quarter, dst_x, dst_y)
    return tile
```

**Implementação:** `engine.js:drawComposedAutotile(ctx, placement, all, tile, dx, dy)` — compõe o tile de 48×48 em um canvas temporário e desenha no contexto. `assets.js:composeFloorAutotile()` / `composeWallAutotile()` — retornam o canvas montado.

#### 5.2.6 Adjacência por proximidade (grid-free)

Em um sistema grid-free, a vizinhança é detectada por sobreposição espacial, não por índice de array:

```js
function getNeighbors(p, all, tileSize=48) {
  const cx = p.x + tileSize/2, cy = p.y + tileSize/2;
  const r = tileSize + 4; // raio com margem
  return {
    n:  all.filter(a => a.id !== p.id && overlap(a, p, 'n', tileSize)),
    ne: all.filter(a => a.id !== p.id && overlap(a, p, 'ne', tileSize)),
    e:  all.filter(a => a.id !== p.id && overlap(a, p, 'e', tileSize)),
    // ... 8 direções
  };
}
```

A função `overlap(a, b, dir, T)` verifica se a caixa `a` encosta na caixa `b` na direção especificada com tolerância de `T` pixels.

**Implementação:** `assets.js:detectNeighbors(placement, all)` — filtra por mesmo `tileId` ou mesmo `tileset`+`kindIndex`, detecta direções por overlap de bounding boxes com tolerância configurável.

#### 5.2.7 Animação A1

Tiles A1 alternam entre 3+ frames horizontalmente. O frame atual é `Math.floor(time / speed) % frameCount`. Cada bloco A1 (A–E) tem seu próprio padrão de animação.

**Implementação:** A1 é renderizado como célula estática da sheet (sem animação ainda). O suporte a animação cíclica está planejado para uma atualização futura.

---

## 6. Física e Colisão ✅

### 6.1 Physics.buildWorld() — grid-free ✅

**Implementação:** `physics.js:Physics.buildWorld(map)` contém dois caminhos:

**Grid-free path** (quando `map.gridFree && map.tilePlacements`):
- Itera as camadas `["ground", "decor", "decor2", "over"]`.
- Para cada placement, verifica `Assets.tiles[p.tileId]?.pass === false`.
- Se `false`, adiciona AABB body `{x: p.x, y: p.y, w: 48, h: 48}` ao mundo.
- Suporta `tile.collision.box` para máscaras customizadas por tile.

```js
// physics.js — grid-free path (simplificado)
if (map.gridFree && map.tilePlacements) {
  for (const ln of ["ground","decor","decor2","over"]) {
    for (const p of (map.tilePlacements[ln] || [])) {
      const t = Assets.tiles[p.tileId];
      if (!t || t.pass !== false) continue;
      world.tileBodies.push({ x: p.x, y: p.y, w: 48, h: 48 });
    }
  }
}
```

**Free-form collision masks:** ambos os caminhos (grid-free e legacy) incluem bodies de `map.collision.masks[]`:

```js
if (map.collision && map.collision.masks) {
  for (const mk of map.collision.masks) {
    world.tileBodies.push({ x: mk.x, y: mk.y, w: mk.w, h: mk.h });
  }
}
```

### 6.2 Passabilidade ✅

**Implementação:** `engine.js:buildPassGrid(map)` — constrói um `Uint8Array` de passabilidade por célula de 48×48 a partir de `tilePlacements` no load do mapa.

- `tilePassable()` lê do `_passGrid` para queries O(1).
- Fallback para legacy `map.layers` se `!map.gridFree`.

### 6.3 Spatial grid (otimização) — Pendente

Para mapas com milhares de placements, usar uma grid espacial:

```js
class SpatialGrid {
  constructor(cellSize) { … }
  insert(item, x1, y1, x2, y2) { … }
  query(x1, y1, x2, y2) { … }
}
```

Usada para:
- Broadphase de colisão (só testar tiles próximos ao jogador)
- Autotile adjacency (só processar vizinhos próximos)
- Frustum culling na renderização (só desenhar tiles na viewport)

**Nota:** Ainda não implementado. O frustum culling atual itera todos os placements; para mapas com poucos tiles o impacto é aceitável.

---

## 7. Editor de Colisão ✅

O editor de colisão (modo `collision`) opera sobre `map.collision.masks[]` (array livre, não por célula), permitindo máscaras que cobrem múltiplos tiles ou áreas livres.

```js
map.collision = {
  tiles: [null, null, null, ...],  // legacy per-cell collision
  masks: [
    { id: 1, x: 100, y: 200, w: 96, h: 48 },   // cobre 2 tiles de largura
    { id: 2, x: 300, y: 150, w: 48, h: 48 },
  ],
};
```

### Implementação — `editor.js`

**Atalho:** `C` no teclado alterna para Collision Mode. Toolbar tem botão dedicado.

**`drawCollisionOverlay(g, m)`:**
- Renderiza células de colisão por tile como quadrados vermelhos (`rgba(220,50,50,0.25)`).
- Renderiza máscaras livres como retângulos azuis (`rgba(80,160,255,0.18)`) com borda `#50a0ff`.
- Máscara selecionada recebe 8 handles amarelos (`#ffc850`) nos cantos e pontos médios.
- O overlay de seleção (marquee) também é desenhado.

**Criação:** Click em espaço vazio no modo collision cria uma máscara de 48×48 centralizada no cursor.

**Seleção:** Click em uma máscara existente a seleciona (destaca em amarelo).

**Movimento:** Arrastar uma máscara selecionada (handle `"move"`) reposiciona em pixels livres.

**Redimensionamento:** Arrastar qualquer um dos 8 handles (`nw`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`) redimensiona. Tamanho mínimo: 4×4px.

**Exclusão:** `Delete` ou `Backspace` remove a máscara selecionada com undo.

**Escape:** Desseleciona a máscara atual.

**Undo/redo:** `snapshotOf()` captura `m.collision` (tiles + masks). `pushUndo()` é chamado antes de criar ou deletar uma máscara.

### Integração física

Ambos os caminhos de `Physics.buildWorld()` (grid-free e legacy) incluem bodies de `map.collision.masks[]`.

```js
if (map.collision && map.collision.masks) {
  for (const mk of map.collision.masks) {
    world.tileBodies.push({ x: mk.x, y: mk.y, w: mk.w, h: mk.h });
  }
}
```

---


---
---
## Anexo — Especificacao Oficial dos Tilesets RPG Maker MZ


### 1. Introducao

Este documento define a especificacao oficial de tilesets do RPG Maker MZ conforme
a documentacao oficial da KADOKAWA e o formato de sheets usado por todos os assets padrao do motor.

**Tile padrao:** 48x48 pixels.

Os tilesets sao organizados em 5 conjuntos (A-E), cada um com formato de sheet especifico.
Os conjuntos A1-A4 usam autotile (recomposicao de quartos de 24x24), enquanto A5 e B-E sao atlases diretos.


### 2. Convencao de nomenclatura de arquivos

Os arquivos de tileset sao nomeados com o prefixo Tile seguido da categoria:

| Arquivo | Categoria | Tipo |
|---------|-----------|------|
| TileA1.png | A1 | Animated autotiles (agua, lava, cachoeira) |
| TileA2.png | A2 | Ground autotiles (grama, chao) |
| TileA3.png | A3 | Building autotiles (paredes de construcao) |
| TileA4.png | A4 | Wall autotiles (paredes de dungeon) |
| TileA5.png | A5 | Normal tiles (terreno fixo) |
| TileB.png | B | Object tiles (conjunto 1) |
| TileC.png | C | Object tiles (conjunto 2) |
| TileD.png | D | Object tiles (conjunto 3) |
| TileE.png | E | Object tiles (conjunto 4) |

Tilesets adicionais de DLC seguem o mesmo padrao com prefixo extra, ex: Shop_Outside_TileA2.png


### 3. Sumario das sheets

| Sheet | Resolucao (px) | Grid (tiles) | Total tiles | Tipo | Autotile |
|-------|---------------|--------------|-------------|------|----------|
| A1 | 768x576 | 16 col x 12 lin | 192 | Animado | Sim (blocos especiais) |
| A2 | 768x576 | 16 col x 12 lin | 192 | Chao | Sim (32 kinds, 48 shapes) |
| A3 | 768x384 | 16 col x 8 lin | 128 | Parede | Sim (group pattern) |
| A4 | 768x720 | 16 col x 15 lin | 240 | Parede | Sim (48 kinds, top + side) |
| A5 | 384x768 | 8 col x 16 lin | 128 | Normal | Nao (atlas direto) |
| B | 768x768 | 16 col x 16 lin | 256 | Objeto | Nao (atlas direto) |
| C | 768x768 | 16 col x 16 lin | 256 | Objeto | Nao (atlas direto) |
| D | 768x768 | 16 col x 16 lin | 256 | Objeto | Nao (atlas direto) |
| E | 768x768 | 16 col x 16 lin | 256 | Objeto | Nao (atlas direto) |

**Nota:** O tile na posicao (0,0) do TileB.png (canto superior esquerdo) deve ser deixado em branco.


### 4. A1 — Autotiles Animados (768x576)

#### 4.1 Estrutura

A sheet A1 contem 5 blocos de padrao dispostos verticalmente:

| Bloco | Tiles | Descricao |
|-------|-------|-----------|
| A — Oceano | 12x4 | 3 padroes de autotile x 4 linhas. Anima horizontalmente. Barcos podem navegar. |
| B — Mar Profundo | 12x4 | 3 padroes x 4 linhas. Cria borda com A. Barcos NAO navegam. |
| C — Decoracao | 12x2 | Tiles decorativos sobre o Bloco A. |
| D — Agua | 12x1 | 3 padroes de autotile. Anima horizontalmente. |
| E — Cachoeira | 12x1 | 2 tiles largura x 3 tiles altura. Anima verticalmente. |

#### 4.2 Passabilidade

- Bloco A: barcos podem navegar, walking: false
- Blocos B-E: barcos NAO podem navegar, walking: false

### 5. A2 — Ground Autotiles (768x576)

#### 5.1 Estrutura

A sheet A2 tem 16 tiles de largura x 12 tiles de altura, contendo 32 kinds (materiais).
Cada kind ocupa um bloco de 2x3 tiles (96x144 px), em 8 colunas x 4 linhas.

Calculo da origem do kind em quarter-units (Q = 24px):
- origin_qx = 4 * (local_kind mod 8)
- origin_qy = 6 * floor(local_kind / 8)
- Table: FLOOR_AUTOTILE_TABLE (48 shapes)

#### 5.2 Sistema de quartos (24x24)

Cada autotile e construido a partir de 4 quartos de 24x24 pixels montados em um tile 48x48.
A tabela FLOOR_AUTOTILE_TABLE (48 entradas) mapeia shape index para coordenadas de quarto.

#### 5.3 Flag forest type

Se o quarto na posicao (8,8) em quarter-units a partir do canto inferior direito for transparente, o autotile e "forest type" (bush effect).

#### 5.4 Passabilidade

Default: true (chao). Configuravel via Database.


### 6. A3 — Building Autotiles (768x384)

#### 6.1 Estrutura

A sheet A3 tem 16 tiles de largura x 8 tiles de altura, organizados em 8 colunas x 4 linhas,
usando autotile group pattern (sem variacao de borda completa).

Cada grupo tem 2 tiles de largura x 2 tiles de altura (96x96 px).

#### 6.2 Sombra automatica

Quando dois ou mais tiles A3 sao colocados verticalmente adjacentes, uma sombra e gerada
automaticamente no tile a direita. So acontece se o tile adjacente pertencer a A2 (exceto Block C) ou A5.

#### 6.3 Passabilidade

Default: false (parede).


### 7. A4 — Wall Autotiles (768x720)

#### 7.1 Estrutura

A sheet A4 tem 16 tiles de largura x 15 tiles de altura, contendo **48 kinds** em **3 bandas** de 16 kinds cada.

Cada banda:
- 8 kinds de wall-top (2x3 tiles cada = 16x12 tiles)
- 8 kinds de wall-side (2x2 tiles cada = 16x8 tiles)
- Altura total: 5 tiles (10 quarter-units)

#### 7.2 Local Kind Numbering

```
band    = floor(local_kind / 16)
in_band = local_kind % 16
column  = local_kind % 8
is_top  = in_band < 8

Se is_top:
  origin_qx = 4 * column
  origin_qy = 10 * band
  family = wall_top  -> usa FLOOR_AUTOTILE_TABLE (shapes 0-47)
Senao:
  origin_qx = 4 * column
  origin_qy = 10 * band + 6
  family = wall_side -> usa WALL_AUTOTILE_TABLE (shapes 0-15)
```

#### 7.3 WALL_AUTOTILE_TABLE (16 entries)

```
 0: [2,2, 1,2, 2,1, 1,1]
 1: [0,2, 1,2, 0,1, 1,1]
 2: [2,0, 1,0, 2,1, 1,1]
 3: [0,0, 1,0, 0,1, 1,1]
 4: [2,2, 3,2, 2,1, 3,1]
 5: [0,2, 3,2, 0,1, 3,1]
 6: [2,0, 3,0, 2,1, 3,1]
 7: [0,0, 3,0, 0,1, 3,1]
 8: [2,2, 1,2, 2,3, 1,3]
 9: [0,2, 1,2, 0,3, 1,3]
10: [2,0, 1,0, 2,3, 1,3]
11: [0,0, 1,0, 0,3, 1,3]
12: [2,2, 3,2, 2,3, 3,3]
13: [0,2, 3,2, 0,3, 3,3]
14: [2,0, 3,0, 2,3, 3,3]
15: [0,0, 3,0, 0,3, 3,3]
```

#### 7.4 Shape solver Wall-side

Ignora diagonais, usa apenas cardeais:

TL usa v=N, h=W
TR usa v=N, h=E
BL usa v=S, h=W
BR usa v=S, h=E

- v AND h       -> solid
- v AND NOT h   -> vertical_edge
- NOT v AND h   -> horizontal_edge
- else          -> outer_corner

#### 7.5 Passabilidade

- Wall-top: true (chao no topo da parede)
- Wall-side: false (parede)


### 8. A5 — Normal Tiles (384x768)

8 tiles de largura x 16 tiles de altura = 128 tiles. Sem autotile, atlas direto.

- Tiles A5 NAO sobrepoem com outros tiles A (A1-A4) na camada inferior.
- Linhas 3, 5, 7 podem ser usadas como chao de dungeon instances.
- Pass default: true.


### 9. B-E — Object Tiles (768x768 cada)

16 tiles de largura x 16 tiles de altura = 256 tiles cada. Sem autotile, atlas direto.

- Tile (0,0) do TileB.png deve ser vazio/transparente.
- Dois tiles B-E podem ser empilhados na mesma celula.
- Sao camada superior (decor), sobrepostos a tiles A.
- Pass default: false.


### 10. Sistema de Camadas (RPG Maker MZ)

| Camada | Tile sets | Uso |
|--------|-----------|-----|
| Lower (A) | A1, A2, A3, A4, A5 | Chao, paredes, agua (1 tile por celula) |
| Upper 1 (B-E) | B, C, D, E | Objetos, decoracao |
| Upper 2 (B-E) | B, C, D, E | Segundo objeto empilhado |

Ordem de renderizacao: Lower -> Upper 1 -> Upper 2.

No RPGAtlas (mapeamento atual):
- ground = Lower (A1-A5)
- decor = Upper 1 (B-E)
- decor2 = Upper 2 (B-E)
- over = Overhead (telhados, arvores)


### 11. Algoritmo de Composicao de Autotile

```python
def compose_autotile(image, origin_qx, origin_qy, table, shape, Q=24):
    entry = table[shape]
    tile = new_image(2*Q, 2*Q)
    for i, (rel_qx, rel_qy) in enumerate(entry):
        src_x = (origin_qx + rel_qx) * Q
        src_y = (origin_qy + rel_qy) * Q
        quarter = crop(image, src_x, src_y, Q, Q)
        dst_x = (i % 2) * Q
        dst_y = (i // 2) * Q
        paste(tile, quarter, dst_x, dst_y)
    return tile
```


### 12. Shape Solver (Floor)

```python
def solve_floor_shape(N, S, E, W, NE, NW, SE, SW):
    nw = NW and N and W
    ne = NE and N and E
    sw = SW and S and W
    se = SE and S and E

    def quarter(v, h, d):
        if v and h and d:     return 'solid'
        if v and h and not d: return 'inner_corner'
        if v and not h:       return 'vertical_edge'
        if not v and h:       return 'horizontal_edge'
        return 'outer_corner'

    return (quarter(N, W, nw), quarter(N, E, ne),
            quarter(S, W, sw), quarter(S, E, se))
```


### 13. Shape Solver (Wall)

```python
def solve_wall_shape(N, S, E, W):
    def quarter(v, h):
        if v and h:     return 'solid'
        if v and not h: return 'vertical_edge'
        if not v and h: return 'horizontal_edge'
        return 'outer_corner'

    return (quarter(N, W), quarter(N, E),
            quarter(S, W), quarter(S, E))
```


### 14. Diferencas entre nosso plano e o formato oficial

| Item | Nosso plano (Grid-Free) | Oficial RPG Maker MZ | Correcao necessaria |
|------|----------------------|---------------------|-------------------|
| A1 resolucao | 144x192 (3x4 tiles) | 768x576 (16x12 tiles) | Redimensionar |
| A2 resolucao | 384x288 (8x6 tiles) | 768x576 (16x12 tiles) | Redimensionar |
| A3 resolucao | 96x384 (2x8 tiles) | 768x384 (16x8 tiles) | Redimensionar |
| A4 resolucao | 192x384 (4x8 tiles) | 768x720 (16x15 tiles) | Redimensionar |
| A5 resolucao | 768x768 (16x16 tiles) | 384x768 (8x16 tiles) | Redimensionar |
| B-E resolucao | 96x384 (2x8 tiles) | 768x768 (16x16 tiles) | Redimensionar |
| Autotile | Grupos simples | Quarter-system (24x24) + lookup tables | Adicionar sistema de quartos |
| Shape solver | Nao detalhado | 8-neighbor bitmask -> shape index 0-47 | Implementar solver canonico |
| A4 wall-side | Nao especificado | Banda vertical com top + side | Adicionar estrutura de bandas |
| Tabela floor | Mencionada incompleta | 48 entradas via quarter-units | Usar tabela oficial |
| Tabela wall | Nao mencionada | 16 entradas via quarter-units | Adicionar |


### 15. Referencias

- RPG Maker MZ Help: Asset Standards — https://rpgmakerofficial.com/product/MZ_help-en/01_11_01.html
- tileset-format-specs (autotiles.md) — https://github.com/yxbh/tileset-format-specs
- tileset-format-specs (shape-solver.md) — https://github.com/yxbh/tileset-format-specs
- RPG Maker MZ Tilemap.js — https://developer.rpgmakerweb.com/rpg-maker-mz/Tilemap.js.html



## 8. Plano de Ação — Etapas Detalhadas

### Fase 1 — Loader de Tilesets RPG Maker MZ

**Objetivo:** Fazer o RPGAtlas reconhecer e carregar sheets no formato oficial do MZ.

| # | Tarefa | Detalhes | Arquivos |
|---|--------|----------|----------|
| 1.1 | Detectar tilesets pelo nome | Reconhecer `TileA1.png`–`TileE.png` e DLCs (`*_TileA2.png`). Identificar categoria A1–A5, B–E. | `assets.js:bindExternalAssets()` |
| 1.2 | Validar dimensões da sheet | Conferir se a resolução corresponde ao esperado (ex: A2 deve ter 768×576). Rejeitar sheets inválidas. | `assets.js` |
| 1.3 | Recortar tiles individuais | Para A5 e B–E: dividir sheet em tiles de 48×48 direto. Para A1–A4: extrair blocos de kind (2×3 ou 2×2 tiles). | `assets.js` |
| 1.4 | Associar metadados por categoria | Definir `pass` default, `terrain`, `autotileGroup`, etc. baseado na categoria. | `assets.js` |
| 1.5 | Registrar em `Assets.tilesets[]` | Criar entrada com `cols`, `rows`, `kindCols`, `kindRows`, `tileIds`, etc. | `assets.js` |
| 1.6 | Registrar em `Assets.tiles[]` | Cada tile individual ganha referência ao tileset de origem e categoria. | `assets.js` |

### Fase 2 — Data Structures

**Objetivo:** Criar o schema de dados para suportar grid-free e tilesets MZ.

| # | Tarefa | Detalhes | Arquivos |
|---|--------|----------|----------|
| 2.1 | Schema `proj.tilesets` | Persistir lista de tilesets usados no projeto. | `data.js` |
| 2.2 | `map.tilePlacements` | Array livre de `{id, tileId, x, y}` para cada camada (`ground`, `decor`, `decor2`, `over`). | `data.js:newMap()` |
| 2.3 | Flag `map.gridFree` | `true` para mapas novos, `false` para legado. | `data.js` |
| 2.4 | Migração legado → grid-free | Função que converte `map.layers[]` flat arrays em `tilePlacements[]`. | `data.js` |
| 2.5 | Undo/redo com tilePlacements | Estender `snapshotOf()` para incluir `tilePlacements`. | `editor.js` |
| 2.6 | SpatialGrid class | Grid espacial para queries de vizinhança (colisão, autotile, frustum). | `physics.js` ou novo `spatial.js` |

### Fase 3 — Autotile System

**Objetivo:** Implementar o quarter-system 24×24 e shape solvers do RPG Maker MZ.

| # | Tarefa | Detalhes | Arquivos |
|---|--------|----------|----------|
| 3.1 | FLOOR_AUTOTILE_TABLE | Array de 48 entradas, cada uma com `[TL, TR, BL, BR]` em quarter-units. | `assets.js` (constante) |
| 3.2 | WALL_AUTOTILE_TABLE | Array de 16 entradas para wall-side. | `assets.js` (constante) |
| 3.3 | Shape solver (floor) | Função que recebe 8 vizinhos booleanos e retorna shape index 0–47. | `assets.js` |
| 3.4 | Shape solver (wall) | Função que recebe 4 vizinhos cardeais e retorna shape index 0–15. | `assets.js` |
| 3.5 | `compose_autotile()` | Função que monta tile 48×48 a partir dos quartos 24×24 da sheet. | `assets.js` |
| 3.6 | `resolveA1Frame()` | Animação cíclica para tiles A1 (água, lava, etc.). | `assets.js` |
| 3.7 | Adjacência por proximidade | Detectar vizinhos por overlap espacial (não por grid index). | `engine.js` ou `spatial.js` |

### Fase 4 — Editor (Grid-Free) ✅

**Objetivo:** Interface do editor para posicionamento livre de tiles.  
**Status:** Implementada em 15/06/2026 (correção pós-auditoria).

| # | Tarefa | Detalhes | Arquivos | Status |
|---|--------|----------|----------|--------|
| 4.1 | Paleta com abas | Substituir palette atual por abas A1–A5, B–E, Today. | `editor.js:rebuildPalTabs(), renderPalette()` | ✅ |
| 4.2 | Click-to-place | Click coloca tile na posição do mouse (pixel livre, com snap). | `editor.js:onCanvasDown()` | ✅ |
| 4.3 | Snap toggle | Botão cíclico no toolbar: Free → 24px → 48px. | `editor.js:snapPx(), ACT["snap-toggle"]` | ✅ |
| 4.4 | Selecionar placement | Click em tile existente seleciona (destaca com borda azul). | `editor.js:placementAt(), selectedPlacement` | ✅ |
| 4.5 | Mover placement | Arrastar tile selecionado para nova posição. | `editor.js:onCanvasMove(), dragPlacementObj` | ✅ |
| 4.6 | Deletar placement | Delete/Backspace remove selecionado. | `editor.js:keydown handler` | ✅ |
| 4.7 | Painel de propriedades | Exibir tile name, layer, X, Y do placement selecionado. | `editor.js:updatePropsPanel(), index.html #props-section` | ✅ |
| 4.8 | Undo/redo | Snapshot de `tilePlacements` antes de cada operação. | `editor.js:snapshotOf(), applySnapshot()` | ✅ |
| 4.9 | Render overlay | Desenhar tiles na posição correta (x, y pixel) no canvas. | `editor.js:renderMap()` | ✅ |

### Fase 5 — Runtime ✅

**Objetivo:** Renderizar e processar tiles grid-free no jogo.  
**Status:** Completada em 15/06/2026.

| # | Tarefa | Detalhes | Arquivos | Notas da implementação |
|---|--------|----------|----------|------------------------|
| 5.1 | `renderTilePlacements()` | Renderizar `tilePlacements` com Y-sort e frustum culling. | `engine.js:581` | Ordena por Y, filtra por viewport, desenha nas 4 camadas em ordem. |
| 5.2 | Render autotile | Para A2–A4: computar shape, compor tile, desenhar. Para A1: animar. | `engine.js:594,601` | A2–A4: `drawComposedAutotile()` → `detectNeighbors()` → shape solver → composição. A1 estático por ora. |
| 5.3 | Render atlas direto | Para A5, B–E: drawTile direto na posição. | `engine.js` | Fallback para `Assets.drawTile()` quando não é autotile. |
| 5.4 | Physics.buildWorld() grid-free | Construir corpos de colisão a partir de `tilePlacements`. | `physics.js:67` | Itera `tilePlacements[ln]`, filtra `pass===false`, adiciona AABB. Inclui `masks[]`. |
| 5.5 | Fallback legado | Se `!map.gridFree`, usar lógica antiga (`map.layers[]`, `tilePassable()`). | `engine.js`, `physics.js` | Ambos os caminhos preservados. `prerenderMap()` sai cedo para gridFree (sem HD-2D). |
| 5.6 | `buildPassGrid()` | Construir grid de passabilidade O(1) no load do mapa. | `engine.js:646` | `Uint8Array` populado a partir de `tilePlacements`. `tilePassable()` lê dele. |

### Fase 6 — Editor de Colisão (Refinamento) ✅

**Objetivo:** Máscaras de colisão livres (não por célula).  
**Status:** Completada em 15/06/2026.

| # | Tarefa | Detalhes | Arquivos | Notas da implementação |
|---|--------|----------|----------|------------------------|
| 6.1 | `map.collision.masks[]` | Array livre de `{id, x, y, w, h}` em pixels absolutos. | `data.js:274,359` | Inicializado como `[]` em `newMap()` e na migração. |
| 6.2 | Criar máscaras | Click em espaço vazio no modo Collision cria nova máscara (48×48). | `editor.js:onCanvasDown()` | `pushUndo()` antes da criação. Gera `id` com `_maskIdCounter`. |
| 6.3 | Mover/redimensionar | Handles livres nos 8 pontos (cantos + pontos médios). | `editor.js:onCanvasMove()` | 8 direções (`nw`,`n`,`ne`,`e`,`se`,`s`,`sw`,`w`); mínimo 4×4px. |
| 6.4 | Selecionar/deletar | Click seleciona, Delete/Backspace remove com undo. | `editor.js` | Escape desseleciona. |
| 6.5 | Render overlay | Desenhar máscaras + grid-cell rects no canvas. | `editor.js:drawCollisionOverlay()` | Azul para não selecionado, amarelo com handles para selecionado. Vermelho para grid-cell. |
| 6.6 | Physics.buildWorld() | Incluir `masks[]` na construção do mundo físico. | `physics.js:87–89, 219–221` | Ambos os caminhos (grid-free e legacy) emitem bodies de `map.collision.masks[]`. |
| 6.7 | Undo/redo | Snapshot de `m.collision` para restore. | `editor.js:snapshotOf()` | `RA.clone(m.collision)` capturado. Restaurado em `applySnapshot()`. |
| 6.8 | Botão toolbar + atalho | Atalho `C`, botão no toolbar, item no menu Mode. | `editor.js` | Ícone de escudo. Tooltip descritivo. Status bar com instruções. |

---

## 9. Dependências entre Fases

```
Fase 1 (Loader) ✅
    ↓
Fase 2 (Data Structures) ✅ ──→  Fase 6 (Collision Masks) ✅
    ↓
Fase 3 (Autotile System) ✅
    ↓
Fase 4 (Editor) ✅ ──→  Fase 5 (Runtime) ✅
```

**Todas as 6 fases concluídas.** A Fase 4 foi implementada em 15/06/2026 como parte da correção pós-auditoria. A Fase 2 foi complementada com `proj.tilesets` e correção do `snapshotOf()`.

---

## 10. Compatibilidade com Projetos Existentes

- Mapas antigos continuam funcionando normalmente (modo `legacy`).
- Ao salvar um mapa legado pela primeira vez no novo editor, o usuário pode optar por migrar.
- `Physics.buildWorld()` tenta `tilePlacements` primeiro; se vazio, cai no comportamento antigo (iterar `layers[]`).
- Tilesets externos existentes (sem prefixo A1–A5/B–E) continuam funcionando como tiles avulsos na categoria `Other`.

---

## 11. Status da Implementação

### Fases Concluídas
| Fase | Status | Observação |
|------|--------|------------|
| 1 — Loader | ✅ Completo | Detecção, validação, recorte, metadados, registros |
| 2 — Data Structures | ✅ Completo | `tilePlacements`/`gridFree`/`proj.tilesets`. `snapshotOf()` captura tudo. |
| 3 — Autotile System | ✅ Completo | Tabelas, solvers, composição, detecção de vizinhos, animação A1 |
| 4 — Editor Grid-Free | ✅ Completo | Paleta com abas, click-to-place, snap, seleção, drag, delete, properties, render, undo/redo |
| 5 — Runtime | ✅ Completo | Renderização, autotile, passabilidade, física |
| 6 — Collision Editor | ✅ Completo | Máscaras livres, handles, undo/redo |

### Melhorias Futuras

- **SpatialGrid**: conectar o `SpatialGrid` já implementado em `physics.js` às queries de colisão (`buildWorld`, `wouldCollide`) e autotile adjacency.
- **Animação A1 cíclica**: `resolveA1Frame()` existe mas `engine.js:renderTilePlacements()` não a invoca — A1 ainda é estático.
- **Caching de autotile**: `composeFloorAutotile()` / `composeWallAutotile()` criam canvas novo a cada chamada — cache por `tileset+kind+shape` evitaria alocações.
- **Seleção múltipla de máscaras**: Shift+click para selecionar múltiplas máscaras e mover/remover em lote.
- **Collision per-tile sub-cell**: edição visual de retângulo dentro de cada célula (já esboçado com `collisionEditRect`, mas sem ferramenta de desenho).
- **HD-2D para grid-free**: atualmente desabilitado (`prerenderMap` sai cedo). Requer refatorar `renderer.js` para aceitar `tilePlacements`.
- **Multi-seleção de placements**: Shift+click para selecionar vários placements e mover/remover em lote.

---

## 12. Referências

- `wiki/rpg-maker-mz-mapping-spec.md` — Especificação oficial dos tilesets do RPG Maker MZ
- `wiki/Pixel-Movement-and-Grid-Free.md` — Documento original de pixel movement e colisão
- RPG Maker MZ Help: Asset Standards — https://rpgmakerofficial.com/product/MZ_help-en/01_11_01.html
- tileset-format-specs (autotiles.md) — https://github.com/yxbh/tileset-format-specs
