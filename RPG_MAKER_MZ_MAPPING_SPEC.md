# Especificação Técnica: Motor de Mapping RPG Maker MZ

Guia de implementação para motor open-source compatível com o padrão MZ.

## 1. Fundamentos do Sistema
- **Tile Size**: 48x48 px.
- **Sub-tile (Quadrant)**: 24x24 px. Cada tile é um grid 2x2 de sub-tiles.
- **Autotile Block**: Imagem base de 96x144 px (2x3 tiles) dividida em 4x6 sub-tiles (24 total).

## 2. Estrutura de Arquivos (Tilesets)
O motor deve ler os arquivos prefixados como A1-A5 e B-E:

| Arquivo | Nome | Tipo | Função |
| :--- | :--- | :--- | :--- |
| **A1** | Animation | Autotile | Água, cachoeiras (3 frames de animação). |
| **A2** | Ground | Autotile | Chão base e camadas de solo. |
| **A3** | Building | Autotile | Paredes e telhados (conexão simplificada). |
| **A4** | Wall | Autotile | Paredes de dungeon e topos de muro. |
| **A5** | Normal | Estático | Escadas e pisos básicos (8x16 tiles). |
| **B-E** | Add-on | Estático | Decoração, móveis, árvores (16x16 tiles). |

## 3. Lógica de Autotile (47-Tile Method)
Para renderizar um autotile A1-A4, usa-se um `Shape_ID` (0-47) calculado pela vizinhança.

### 3.1. Sub-tile Index (Grid 4x6)
Mapeamento de coordenadas `[x, y]` no bloco de autotile:
```
[0,0][1,0] | [2,0][3,0]  <-- Topo
[0,1][1,1] | [2,1][3,1]  
-----------------------
[0,2][1,2] | [2,2][3,2]  <-- Centro (Shape 46)
[0,3][1,3] | [2,3][3,3]  
-----------------------
[0,4][1,4] | [2,4][3,4]  <-- Cantos (Shape 0)
[0,5][1,5] | [2,5][3,5]
```

### 3.2. Tabelas de Lookup (LUT)
O motor reconstrói o tile 48x48 escolhendo 4 sub-tiles (TL, TR, BL, BR):
- **Floor LUT**: 48 formas (reconhece 8 vizinhos).
- **Wall LUT**: 16 formas (reconhece 4 vizinhos).
- **Waterfall LUT**: 4 formas (horizontal).

## 4. Estrutura de Camadas (MZ Manual Layers)
Diferente do MV, o MZ permite controle manual. No `MapXXX.json`, o array `data` é dividido em 6 camadas fixas:

| Layer | Conteúdo MZ | Função |
| :--- | :--- | :--- |
| **0** | Tileset A | Geralmente chão base. |
| **1** | Camada Manual 1 | Pode conter Set A ou B-E. |
| **2** | Camada Manual 2 | Pode conter Set A ou B-E. |
| **3** | Camada Manual 3 | Pode conter Set A ou B-E. |
| **4** | Shadows | Bitmask de sombra (4 bits: TL, TR, BL, BR). |
| **5** | Regions | IDs de 0 a 255. |

**Indexação no JSON**: `(LayerIndex * Width * Height) + (Y * Width) + X`.

## 5. Mapeamento de IDs (Tile ID)
- **0**: Transparente (Vazio).
- **1 - 1023**: Sets B, C, D, E.
- **1536 - 1663**: Set A5.
- **2048 - 8191**: Autotiles (A1, A2, A3, A4).
  - `Kind = Math.floor((ID - 2048) / 48)`
  - `Shape = (ID - 2048) % 48`

## 6. Passabilidade e Flags
Cada Tile ID aponta para uma flag de 32 bits no `Tilesets.json`:

- **0x0001 - 0x0008**: Colisão direcional (Baixo, Esq, Dir, Cima).
- **0x0010 (16)**: **Star** (O tile é renderizado acima do jogador).
- **0x0020 (32)**: **Ladder** (Personagem em modo escalada).
- **0x0040 (64)**: **Bush** (Transparência nos pés).
- **0x0080 (128)**: **Counter** (Ativa eventos através do tile).
- **0x0100 (256)**: **Damage Floor** (Piso que tira HP).
- **0xF000 (Bits Superiores)**: **Terrain Tag** (ID customizado 0-31).

## 7. Implementação Sugerida
1. **Render**: Use **PixiJS**. Renderize as camadas 0-3 em ordem.
2. **Y-Sorting**: Sprites de personagens devem ter Z-index dinâmico baseado no `Y` atual, ficando entre a camada de chão (A) e os tiles "Star" (B-E com flag 0x10).
3. **Animação (Set A1)**: Ciclo `0 -> 1 -> 2 -> 1` a cada 30 frames para água. Cachoeiras são cíclicas `0-1-2`.
4. **Sombras**: Bit 1 = Desenhar preto 50% alfa no quadrante correspondente.
