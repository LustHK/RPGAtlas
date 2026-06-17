# Plano de Ação — Editor de Definições de Tileset (✓ CONCLUÍDO)

> **Objetivo:** Criar um componente "Editor de Definições de Tileset" idêntico ao Database → Tilesets do RPG Maker MZ, integrado como nova aba no modal Database existente.

---

## 1. Decisões de Design (validadas com o usuário)

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| **Layout de bits** | Manter o sistema 32-bit existente (`assets.js`) | Já integrado com save/load, física, engine de jogo e renderização. A UI apresentará visualmente o mesmo que o MZ. |
| **Localização na UI** | Nova aba no Database existente | Segue o padrão `dbTabs()` já estabelecido; reuso do modal, toolbar e estilos. |
| **Onde colocar o código** | Novo arquivo `js/editor/tileset-editor.js` | Evita inflar `editor.js` (já 10k+ linhas); módulo ES importado. |

---

## 2. Arquivos Impactados ✓

| Arquivo | Ação | Status |
|---------|------|--------|
| `js/editor/tileset-editor.js` | **CRIADO → EDITADO** | 659 linhas |
| `css/editor.css` | **EDITADO** | +44 linhas de estilos `.tse-*` |
| `locales/en.json` | **EDITADO** | +32 chaves namespace `tileset.*` + 13 chaves patch #34 |
| `locales/pt.json` | **EDITADO** | Sincronizado (inclusive patch #33 e #34) |
| `locales/es.json` | **EDITADO** | Sincronizado (inclusive patch #33 e #34) |
| `locales/fr.json` | **EDITADO** | Sincronizado (inclusive patch #33 e #34) |
| `locales/de.json` | **EDITADO** | Sincronizado (inclusive patch #33 e #34) |
| `js/patch-notes.js` | **EDITADO** | Entries #33 e #34 |
| `js/editor.js` | **EDITADO** | Import + tab entry em `dbTabs()` |
| `js/assets.js` | **EDITADO** | `TF_TERRAIN_SHIFT` exposto no objeto Assets |

---

## 3. Estrutura do Módulo `tileset-editor.js`

### 3.1 Export

```js
export function buildTilesetTab(proj, Assets, t, h, touch)
```

Retorna um elemento DOM (o `build()` da tab), seguindo o padrão existente em `dbTabs()`.

### 3.2 Layout Interno

```
┌─────────────────────────────────────────────────────────┐
│ .dbtab (flex row)                                       │
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │ .dbside  │  │ .dbform                              │ │
│  │          │  │  ┌─ Nome + Modo ──────────────────┐  │ │
│  │ Lista    │  │  │ [Name input] [Field/Area sel]   │  │ │
│  │ de       │  │  ├─ Abas de Categoria ────────────┤  │ │
│  │ tilesets │  │  │ [A1][A2][A3][A4][A5][B][C][D][E]│  │ │
│  │          │  │  ├─ Slot de Arquivo ──────────────┤  │ │
│  │ [+]      │  │  │ File: TileA2.png  [Change…]    │  │ │
│  │          │  │  ├─ Toolbar + Viewer ─────────────┤  │ │
│  │          │  │  │  ┌────┐ ┌───────────────────┐  │  │ │
│  │          │  │  │  │ ⬤ │ │   Canvas Viewer    │  │  │ │
│  │          │  │  │  │ × │ │   (grid 48x48 +    │  │  │ │
│  │          │  │  │  │ ↑↓│ │    overlay flags)   │  │  │ │
│  │          │  │  │  │ ⋮ │ │                    │  │  │ │
│  │          │  │  │  └────┘ └───────────────────┘  │  │ │
│  │          │  │  ├─ Zoom Bar ─────────────────────┤  │ │
│  │          │  │  │  [⊕] [⊖] [1:1] [☰ overlay]    │  │ │
│  │          │  │  ├─ Ações ────────────────────────┤  │ │
│  │          │  │  │  [Export JSON…] [Import JSON…] │  │ │
│  │          │  │  └────────────────────────────────┘  │ │
│  └──────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Estado Interno (closures)

```js
let curTilesetKey = null;   // e.g. "Dungeon"
let curCategory = "B";      // "A1" | "A2" | ... | "E"
let curTool = "passage";    // "passage" | "dir-n" | ... | "terrain"
let viewerZoom = 1.0;
let showOverlay = true;
let isPainting = false;
let lastPaintedIdx = -1;
```

### 3.4 Ciclo de Vida

1. **buildTilesetTab()** é chamado ao selecionar a tab
2. Escolhe o primeiro tileset da lista (ou cria um placeholder)
3. Renderiza o layout completo
4. Event listeners no canvas para click/drag
5. Trocas de aba/ferramenta/tileset atualizam o canvas via `redrawViewer()`
6. Nenhum ciclo de animação — redesenho sob demanda

---

## 4. Mapeamento Ferramenta → Operação de Bits

Usa as constantes `TF_*` existentes em `Assets` com o padrão `(cur & ~mask) | (value & mask)`.

| Ferramenta | `id` | Display | Operação |
|---|---|---|---|
| Passage | `"passage"` | Alterna ○ → × → ★ | `(f & ~TF_PASS_MASK) \| nextVal` |
| Dir N | `"dir-n"` | Toggle seta norte | `f ^ TF_DIR_N` |
| Dir S | `"dir-s"` | Toggle seta sul | `f ^ TF_DIR_S` |
| Dir E | `"dir-e"` | Toggle seta leste | `f ^ TF_DIR_E` |
| Dir W | `"dir-w"` | Toggle seta oeste | `f ^ TF_DIR_W` |
| Ladder | `"ladder"` | Toggle ícone escada | `f ^ TF_LADDER` |
| Bush | `"bush"` | Toggle ícone arbusto | `f ^ TF_BUSH` |
| Counter | `"counter"` | Toggle ícone balcão | `f ^ TF_COUNTER` |
| Damage | `"damage"` | Toggle ícone dano | `f ^ TF_DAMAGE` |
| Terrain | `"terrain"` | Incrementa tag (0-7) | `(f & ~TF_TERRAIN_MASK) \| (tag << 10)` |

### Passage Cycling Logic

```
state 0 (TF_PASS_O = ○) → state 1 (TF_PASS_X = ×) → state 2 (TF_PASS_STAR = ★) → state 0
```

Se a categoria atual for A (A1-A5), não permitir ★ (star).

---

## 5. Sobrecarga Visual no Canvas

Renderizada após o tileset, semi-transparente, igual ao `drawFlagsOverlay()` de `editor.js`:

- **Passagem geral**: Círculo verde (`○`) / X vermelho (`×`) / Estrela amarela (`★`) no centro
- **Bloqueio direcional**: Barras laranja/vermelhas nas bordas (N/S/E/W)
- **Ladder**: "L" roxo no canto superior esquerdo
- **Bush**: "B" verde no canto superior
- **Counter**: "C" laranja no canto superior
- **Damage**: "D" vermelho no canto superior
- **Terrain tag**: "T#" azul no canto inferior direito

Toggle "Show overlay" controla a exibição.

---

## 6. Interatividade do Canvas

### Click
- **Botão esquerdo**: Aplica a ferramenta atual no tile sob o cursor
  - Passage: avança para o próximo estado do ciclo
  - Dir: toggle do bit
  - Special flags (L/B/C/D): toggle
  - Terrain: incrementa (1→2→...→7→0)
- **Botão direito**: No modo Terrain, decrementa; nos demais, sem efeito

### Drag
- `mousedown`: Marca `isPainting = true`, aplica no tile atual
- `mousemove` (com botão pressionado): Aplica no tile sob o cursor se diferente do último
- `mouseup`: Marca `isPainting = false`

### Hover
- Destaca o tile sob o cursor com borda amarela `rgba(255,216,106,0.6)`

### Scroll
- Ajusta `viewerZoom` em ±0.25 (limitado entre 0.25 e 4.0)

---

## 7. Abas de Categoria e Slots de Arquivo

As abas A1–E filtram a exibição do canvas para mostrar apenas as tiles daquela categoria.

Para cada categoria, há um slot de arquivo que exibe:
- Se o tileset está carregado: `"File: Dungeon_A2.png"` + botão "Change…"
- Se não está: `"No image loaded"` + botão "Browse…"

O botão "Change…" abre um file picker (`<input type="file">`) que carrega a imagem e registra via `Assets.bindExternalAssets()`.

---

## 8. Export/Import JSON

### Export
Gera um objeto JSON por tileset no formato:
```json
{
  "id": 1,
  "name": "Dungeon",
  "mode": 1,
  "tilesetNames": ["Dungeon_A1", "Dungeon_A2", "", "", "", "Dungeon_B", "Dungeon_C", "", ""],
  "flags": [16, 16, 0, 15, 3840, ...]
}
```
Usa `Assets.exportTileFlags(tsKey)` para obter o array de flags.

### Import
Parseia o JSON e aplica via `Assets.loadTileFlags(tsKey, data.flags)`.

---

## 9. Ordem de Implementação ✓

| Passo | Descrição | Status |
|-------|-----------|--------|
| 1-10 | `tileset-editor.js` completo (scaffold, lista, toolbar, canvas, overlay, drag, zoom, export/import) | ✓ FEITO |
| 11 | Estilos CSS `.tse-*` adicionados ao `editor.css` | ✓ FEITO |
| 12 | 32 chaves i18n adicionadas em en.json + sincronizadas em pt/es/fr/de | ✓ FEITO |
| 13 | Integração em editor.js: import estático + entry em `dbTabs()` | ✓ FEITO |
| 14 | Patch note #33 prepended | ✓ FEITO |
| 15 | **Bugfix #4**: Índice de flag corrigido (`tileSubIndex()` substitui `subTile`) | ✓ FEITO |
| 16 | **Bugfix #4**: Propagação de flags em autotile groups (A1–A4) | ✓ FEITO |
| 17 | **Bugfix #4**: Hover `lineWidth` ajustado ao zoom (`2 / viewerZoom`) | ✓ FEITO |
| 18 | **Bugfix #1**: Abas de categoria tornadas clicáveis (navegação) | ✓ FEITO |
| 19 | **Bugfix #2**: Botão "Change…" + Galeria modal de tilesets | ✓ FEITO |
| 20 | Patch note #34 + i18n sync (5 locales) | ✓ FEITO |

### Problemas resolvidos durante implementação

**Original**: O diretório `img/tilesets/` continha apenas `README.md` — nenhuma imagem PNG. Imagens copiadas do template e renomeadas para o padrão `*_Tile*.png`.

**Original**: `TF_TERRAIN_SHIFT` exposto no `Assets` (assets.js:1626).

**Bugfix #4 (flag index)**: A raiz do bug era o uso de `tile.subTile` como índice do array de flags. `subTile` é a posição _dentro do grupo kind_ (sempre 0 para B–E), não o índice linear verdadeiro. Correção: função `tileSubIndex(tile)` que calcula `tile.tilesetY * ts.cols + tile.tilesetX`, mesma fórmula usada em `editor.js:929` e `physics.js:71`.

**Bugfix #4 (propagação)**: Ao alterar uma flag num tile de autotile, a mudança é propagada para todos `tileIds` com o mesmo `kindIndex`, usando `_applyFlag()` para evitar side effects (chamadas duplicadas de `touch()`/`redrawViewer()`).

### Mudanças em relação ao plano original (após bugfixes)

- **Categorias**: Originalmente abas informativas. **Após bugfix #1**: abas clicáveis que navegam para o tileset da categoria clicada, encontrando-o via `Object.values(Assets.tilesets).find(ts => ts.category === cat)`.
- **Slots de arquivo**: Originalmente texto estático. **Após bugfix #2**: botão "Change…" que abre uma galeria modal (`tse-gallery-overlay`) que consulta `img/assets.json`, agrupa imagens por categoria, exibe thumbnails em canvas, e ao clicar navega para o tileset correspondente.
- **`MZ_TILESET_SPECS`**: Copiado localmente no módulo (inalterado).
- **`TF_TERRAIN_SHIFT`**: Exposição no `Assets` (inalterado).

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Tileset não carregado ao abrir o editor | Lista lateral mostra apenas tilesets carregados; se vazia, exibe "(no tilesets loaded)" |
| Arquivo de imagem muito grande (>4096px) | `imageSmoothingEnabled = false` + zoom limitado a 4× |
| Conflito com grid-free mapping | O editor opera sobre `tilesetKey` + `subIndex`, independente do sistema de grid |
| Performance com tilesets grandes (768 tiles B-E) | Canvas 2D com `drawImage` por tile é eficiente; zoom reduz área visível |
| Dados não salvos ao fechar modal | `touch()` chamado em cada edição; autosave existente cobre |

---

## 11. Critérios de Aceite ✓

- [x] Abrir Database → aba "Tilesets" exibe a lista de tilesets carregados
- [x] Selecionar um tileset mostra o visualizador com grid 48x48
- [x] Abas A1–E exibem a categoria do tileset selecionado
- [x] Cada ferramenta (passage, dir, ladder, bush, counter, damage, terrain) funciona via click
- [x] Drag-to-draw aplica a ferramenta em múltiplos tiles
- [x] Zoom in/out/reset funcionam
- [x] Toggle overlay mostra/oculta ícones de propriedade
- [x] Export gera JSON válido; Import restaura as flags
- [x] Slots de arquivo exibem o nome do arquivo carregado
- [x] Botão "Change…" abre galeria modal com thumbnails de todas as tilesheets
- [x] Abas de categoria (A1–E) são clicáveis e navegam para o tileset correspondente
- [x] Flag index usa `tile.tilesetY * ts.cols + tile.tilesetX` (não `subTile`)
- [x] Autotile flags propagam automaticamente para todos sub-tiles do mesmo kind group
- [x] Hover highlight respeita o nível de zoom (lineWidth escalado)
- [x] Alterações persistem via `touch()` e autosave
- [x] Todas as strings em en.json e sincronizadas nos demais locales
