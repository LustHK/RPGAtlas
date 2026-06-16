# Pixel Movement e Grid-Free para RPGAtlas

Este documento descreve uma proposta de implementação para adicionar ao RPGAtlas:

- **Pixel movement nativo e opcional** para jogadores e NPCs.
- **Mapeamento grid-free** no editor, sem ficar preso estritamente à célula de 48×48.
- **Compatibilidade com tilesets do RPG Maker**, incluindo autotile e passabilidade existente.
- Um sistema de **colisão simples, prático e fácil de usar**, com automação para reduzir atrito.
- Uma aba de **Controles** no Database como última etapa do processo.

---

## 1. Estado atual do RPGAtlas

Atualmente, o RPGAtlas já é fortemente baseado em grade de tiles:

- Cada mapa tem 4 camadas (`ground`, `decor`, `decor2`, `over`).
- A passabilidade é determinada por célula, usando `map.passOv` e `Assets.tiles[].pass`.
- O motor usa coordenadas de célula para movimento e colisão de eventos.
- A edição de mapa no editor funciona em uma grade de 48×48 pixels.

Isso é ótimo para design clássico, mas a proposta é evoluir para uma camada extra de liberdade sem abandonar essa base sólida.

---

## 2. Divisão de responsabilidades: visual vs física

Essa é a parte mais importante para entender a proposta.

O RPGAtlas deve manter o renderer atual, mas separar o que está visível do que é "real" para o jogo.

1. **Camada Visual**
   - Renderiza tiles e sprites.
   - Desenha o mapa em coordenadas X/Y livres.
   - É responsável apenas pela aparência.

2. **Camada Física**
   - Mantém corpos invisíveis, colisões e movimento.
   - Responde se um personagem pode atravessar ou fica bloqueado.
   - Funciona como um motor físico simplificado e desacoplado da renderização.

Isso é igual à sugestão de PixiJS + Matter.js: o tile é desenhado independente de sua colisão.

### 2.1 Como essa separação funciona na prática

No editor, cada tile ainda pode ter posições de 48×48.
Mas, no runtime, o jogo pode representar esse mesmo tile como:

- um sprite que aparece na tela;
- um corpo de colisão que bloqueia o jogador.

A posição visual e a posição física serão mantidas sincronizadas, mas podem ser usadas com regras diferentes.

### 2.2 Exemplo de dados de tile/colisão

Um registro de tile no mapa poderia ser assim:

```json
{
  "id": 1,
  "x": 124,
  "y": 89,
  "width": 48,
  "height": 48,
  "solid": true,
  "collision": {
    "type": "box",
    "x": 0,
    "y": 0,
    "w": 48,
    "h": 48
  }
}
```

Nesse exemplo:

- a camada visual desenha o tile em `(124, 89)`;
- a camada física cria um corpo estático com a mesma posição e tamanho;
- se `solid` for `true`, o corpo bloqueia o jogador e NPCs.

### 2.3 Exemplo de corpo dinâmico para o jogador

O jogador pode ser representado assim:

```js
player.body = {
  type: "kinematic",
  x: 120,
  y: 88,
  w: 24,
  h: 32,
  vx: 0,
  vy: 0,
};
```

Em cada frame, o jogo atualiza `player.body.x` e `player.body.y` com base na entrada, então resolve colisões contra os corpos estáticos.

### 2.4 O que muda e o que permanece igual

Isso permite dois avanços sem abandonar a base existente:

- a arte pode continuar sendo criada por tile;
- a lógica de movimento passa a ser contínua;
- a passabilidade ainda pode ser inferida pelos tiles atuais;
- o editor não precisa eliminar a grade para suportar grid-free.

---

## 3. Como aplicar isso no RPGAtlas

### 3.1 Camada visual no RPGAtlas

No renderer atual do RPGAtlas, a camada visual segue:

- desenhando cada tile do mapa;
- desenhando sprites do jogador e dos eventos;
- aplicando camadas `ground`, `decor`, `decor2`, `over`.

A diferença no modo grid-free é apenas que cada tile também pode ter uma posição X/Y livre e um corpo físico correspondente.

### 3.2 Camada física no RPGAtlas

A camada física pode ser implementada com um sistema próprio ou inspirada em Matter.js.

- cada tile sólido cria um corpo estático;
- o jogador e NPCs são corpos kinematic ou dinâmicos;
- o movimento é resolvido no espaço contínuo;
- a física é independente da renderização.

Mesmo sem Matter.js, o modelo mental de `Bodies`, `World` e `engine.step()` é útil.

### 3.3 Fluxo de carregamento

1. o mapa é carregado do JSON;
2. a camada visual posiciona os tiles em X/Y;
3. a camada física criará corpos estáticos para as colisões;
4. o jogador e eventos receberão corpos próprios;
5. cada frame atualiza a física antes de desenhar.

### 3.4 Por que usar Matter.js como referência

Matter.js não precisa ser incorporado ao projeto, mas é uma boa referência porque:

- resolve colisões contínuas;
- suporta corpos retangulares e poligonais;
- separa mundo físico e renderização;
- define claramente que o mapa visual não é o mesmo que o mapa de colisão.

No RPGAtlas, podemos reaproveitar essa ideia sem carregar toda a biblioteca.

---

## 4. Pixel movement nativo e opcional

### 4.1 Duplo modo de movimento

O motor precisa suportar dois modos em runtime:

1. **Tile movement** (atual) – movendo de célula para célula.
2. **Pixel movement** – movendo livremente em coordenadas de pixel.

A escolha pode ser feita por projeto, mapa ou até por evento especial.

### 4.2 Representação dos personagens

Para cada entidade, armazenar:

- `x`, `y`: posição de célula ou lógica.
- `px`, `py`: posição em pixels no mapa.
- `bounds`: caixa de colisão ou polígono.

Exemplo de padrão:

```js
player.bounds = { type: "box", w: 24, h: 32, ox: 12, oy: 16 };
```

Isso torna natural o movimento pixel-perfect e permite manter o sprite alinhado ao grid visual.

### 4.3 Transição suave entre modos

Quando pixel movement estiver desativado, o comportamento atual permanece.

Quando ativado:

- a entrada do jogador causa velocidade em pixels;
- a colisão é verificada continuamente a cada frame;
- ainda é possível manter `dir` e animação como hoje.

Uma implementação conservadora pode usar velocidade fixa de `2`, `4`, `6` px/frame para preservar o feel de RPG Maker.

---

## 5. Sistema de colisão para grid-free

### 4.1 Dados base de colisão

A proposta não substitui o mapa de tiles. Ela adiciona metadados de colisão em duas camadas:

- **por tile**: `Assets.tiles[id].collision` ou `Assets.tiles[id].pass` estendido.
- **por mapa**: `map.collisionMasks` ou `map.collision` opcional.

### 4.2 Tileset + autotile compatível

Para usar tilesets RPG Maker sem reinventar a arte:

- mantenha a forma de declarar passabilidade via nome de arquivo.
- estenda a convenção com sufixos de colisão mais ricos:
  - `_pass` ou `_0` = totalmente atravessável
  - `_block` ou `_1` = bloco completo
  - `_half`, `_top`, `_bottom`, `_left`, `_right` = colisão parcial
  - `_slope` ou `_poly` = formas livres

Para tiles padrões do RPG Maker, a engine já sabe que certos tiles são `terrain` ou `decor`. Basta mapear isso para um `collision` default.

Exemplo de metadados por tile:

```js
Assets.tiles[id] = {
  pass: false,
  collision: { type: "box", x: 0, y: 0, w: 48, h: 48 },
};
```

Ou para polígonos:

```js
collision: {
  type: "poly",
  points: [ [0,48], [48,48], [48,24], [24,0], [0,0] ]
}
```

### 4.3 Colisão de entidade

Cada personagem/evento terá também um corpo de colisão simples:

- `bounds` = caixa AABB.
- opcional: `poly` = polígono relativo ao sprite.

Default para o player:

```js
player.collision = { type: "box", w: 24, h: 32, ox: 12, oy: 16 };
```

Isso é fácil de explicar e simples de editar no Database se alguém quiser ajustar.

### 4.4 Detecção de colisão

Para pixel movement, a checagem deve ser feita contra:

1. máscaras de colisão de tiles sob o personagem.
2. `blockingEventAt` adaptado para colisão contínua.
3. outros objetos sólidos no mapa.

Um modelo simples e rápido é usar **AABB vs AABB** para a maior parte dos casos e só usar polígonos se necessário.

#### 4.4.1 Otimização espacial (Broadphase)

Como o mapa ainda está alinhado a uma grade de 48×48, não é preciso varrer todos os tiles a cada frame. O motor pode calcular um quadrante mínimo em torno do corpo do jogador e testar colisões apenas nesses tiles.

Exemplo:

```js
const minTileX = Math.floor(player.px / 48) - 1;
const maxTileX = Math.floor((player.px + player.bounds.w) / 48) + 1;
const minTileY = Math.floor(player.py / 48) - 1;
const maxTileY = Math.floor((player.py + player.bounds.h) / 48) + 1;

for (let ty = minTileY; ty <= maxTileY; ty++) {
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    const tile = mapTileAt(tx, ty);
    if (!tile || !tile.solid) continue;
    testCollision(player.body, tile.collision);
  }
}
```

Esse filtro reduz os testes para um pequeno conjunto de tiles próximos ao jogador — normalmente 9 a 12 tiles — e mantém a atualização leve mesmo em mapas grandes.

#### 4.4.2 Correção de quinas (Wall Sliding)

Motores de pixel movement feitos à mão podem travar em corredores estreitos se o jogador estiver desalinhado em poucos pixels. Para evitar isso, adicione uma correção de canto/sheet sliding.

- tente mover o corpo nas duas direções juntas (`dx`, `dy`).
- se colidir, tente apenas `dx`.
- se ainda colidir, tente apenas `dy`.
- se `dx` e `dy` não forem possíveis, mantenha o corpo parado.

Isso permite que o jogador escorregue pela parede em vez de travar na quina quando o corredor tem largura suficiente.

Um esboço simples:

```js
function moveWithSlide(body, dx, dy) {
  if (!wouldCollide(body, dx, dy)) {
    body.x += dx;
    body.y += dy;
    return;
  }
  if (!wouldCollide(body, dx, 0)) {
    body.x += dx;
    return;
  }
  if (!wouldCollide(body, 0, dy)) {
    body.y += dy;
    return;
  }
}
```

Para corredores de 48px com hitbox de 24px, isso é suficiente na maioria dos casos e evita o efeito de quina preso sem precisar de física complexa.

### 4.5 Integração com `tilePassable(x,y)`

O código atual tem esse fluxo:

- `tilePassable(x,y)` retorna false para fora do mapa.
- usa `map.passOv` para override auto/pass/block.
- decide com base no topmost decor/ground tile.

No modo pixel, ele deve continuar usando isso como fallback, mas com dois refinamentos:

- `tilePassable(x,y)` mantém a regra de override.
- se o tile for bloqueável (`pass: false`) mas sem máscara explícita, assume **bloqueio total da célula**.
- se houver máscara, testa apenas a região definida.

Assim, a arquitetura atual segue válida e evolui sem quebra.

---

## 5. Edição de mapa grid-free

### 5.1 O que significa grid-free aqui

Não precisamos descartar totalmente a grade de tiles.

A proposta é:

- pintar arte ainda em tiles de 48×48.
- permitir que objetos, colisão e posicionamento de elementos usem coordenadas de pixel.
- fornecer uma interface de edição livre para **máscaras de colisão** e **eventos/objetos**.

Isso já entrega a sensação de mapa livre que o usuário pediu.

### 5.2 Editor: modos e ferramentas

Adicionar ao editor:

- modo novo de **Colisão / Collision**.
- modo **Grid-free** opcional para ajuste fino de `event.x`, `event.y` em pixels.
- um botão de alternância `Snapping: Tile / Pixel`.
- desenho de collision boxes ou polígonos sobre o mapa.

### 5.3 Fluxo de uso simples

Para o desenvolvedor novato, o fluxo ideal deve ser:

1. pintar o mapa normalmente com tiles.
2. deixar o engine inferir passabilidade e colisão automaticamente.
3. abrir o modo Collision apenas quando precisar refinar algo.
4. ajustar caixas simples em vez de desenhar formas complexas.

### 5.4 Exemplo de modos no editor

- **Paint**: mantém tile painting como hoje.
- **Passability**: mantém overrides de `passOv`.
- **Collision**: mostra as máscaras de colisão geradas e permite editar caixas/polígonos.
- **Object placement**: permite posicionar eventos com precisão de pixel ou meio-tile.

Um efeito prático: o desenvolvedor arrasta um objeto ou NPC para posições entre tiles e o motor ainda respeita a colisão.

---

## 6. Compatibilidade com herbologias RPG Maker / autotile

### 6.1 Tile sets existentes

A ideia é ser compatível com os tilesets RPG Maker sem exigir novos assets.

- Tile files continuam carregando normalmente.
- a engine usa a mesma base de identificação de tile.
- nomes e metadados extras são apenas um aprimoramento opcional.

### 6.2 Autotile e camadas especiais

Autotiles do RPG Maker representam grupos de tiles com comportamento visual.
Para colisão, eles podem mapear para formas simples e reutilizáveis:

- chão = passável.
- parede = bloco total.
- borda = meia-célula ou barricada.

Isso significa que um autotile padrão pode manter a lógica de passabilidade e ainda servir ao novo motor.

### 6.3 Automação por arte

Se o designer não marcar nada explicitamente, o sistema deve seguir regras automáticas:

- tile transparente / chão = passável.
- tile decorativo em `decor`/`decor2` = passável por default, a menos que seja `block`.
- tile em `ground` com `pass: false` = full-block.

Em outras palavras: a maioria dos mapas funciona sem ajuste extra. Somente exceções demandam edição de máscara.

---

## 7. Dados e esquema sugeridos

### 7.1 Extensões em projeto/mapa

Adicionar campos opcionais:

```js
map.collision = {
  tiles: [], // máscaras por célula, se houver
  groups: [], // área de colisão customizada
};
```

Mas a principal fonte continua sendo o tile mesmo:

```js
Assets.tiles[id].collision = {
  type: "box",
  x: 0,
  y: 0,
  w: 48,
  h: 48,
};
```

E permitir esse atalho em `map.passOv` apenas para overrides de passabilidade.

### 7.2 Entidades/eventos

Para cada entidade/evento:

```js
event.bounds = { type: "box", w: 24, h: 36, ox: 12, oy: 12 };
event.solid = true;
```

Se `event.page.through` for `true`, a colisão é ignorada conforme o padrão atual.

### 7.3 Sistema de movimento

No Database ou runtime, `proj.system` pode receber:

```js
system.controls = {
  pixelMovement: false,
  diagonalMove: true,
  dashButton: "shift",
  confirmButton: "z",
  cancelButton: "x",
};
```

Esse objeto pode ficar em `proj.system` para ser fácil de acessar no editor e no jogo.

---

## 8. Fácil, rápido e prático para o desenvolvedor

### 8.1 Regras de ouro

- **Defaults automáticos primeiro**: o motor funciona sem configuração extra.
- **Override apenas quando precisar**: o editor só abre a edição de colisão na exceção.
- **Interface visual simples**: caixas de colisão, não polígonos complexos, para 90% dos casos.
- **Sem quebra da grade de tiles**: o mapeamento de arte continua clássico.

### 8.2 O que o desenvolvedor vê

- no editor de mapas: o mesmo layout, só com um novo botão `Collision`.
- no modo `Pixel movement` do jogo: controles familiares, mas deslocamento livre.
- no Database: um novo conjunto de opções opcionais de controle.

### 8.3 Automação útil

Sugestões de automação para reduzir atrito:

- ao importar um tileset, gerar colisões padrão a partir de nomes/sufixos.
- no modo Collision, oferecer um botão `Auto-fill collision deste tile`.
- em tiles bloqueadores simples, desenhar automaticamente uma caixa de 48×48.
- no modo grid-free, ao colocar um evento, posicioná-lo no centro da célula por padrão.

---

## 9. Aba de Database "Controles" (última etapa)

A aba `Controles` entra por último e deve ser simples:

- **Exibir** o esquema de controle do jogo.
- **Ativar/desativar** movimento diagonal.
- **Ativar/desativar** pixel movement.
- **Escolher** quais inputs fazem o quê.
- **Mostrar** dicas de tecla/botão no jogo.

### 9.1 Campos sugeridos

- `Pixel movement` (checkbox)
- `Diagonal movement` (checkbox)
- `Dash input` (string / seletor)
- `Confirm input` (string / seletor)
- `Cancel input` (string / seletor)
- `Show controls in game` (checkbox)
- `Control help text` (textarea)

### 9.2 Onde aparecer

A aba `Controles` pode ser colocada em `Database ▸ Controls` ao lado de `System`.

Ela não é obrigatória para o motor funcionar; é uma camada de conforto para o desenvolvedor.

---

## 10. Plano de implementação passo a passo

A funcionalidade deve ser ativada por padrão desde o início, com o modo tile movement preservado e o modo pixel movement opcional por configuração. O foco inicial é entregar um protótipo funcional, depois refinar o editor e os metadados.

### 10.1 Prioridades

1. **Nível 1 — Base funcional**
   - manter o mapa tile-based atual funcionando sem alterações.
   - criar a camada física mínima para corpos e colisões.
   - carregar tiles sólidos e gerar colisões automáticas a partir de `Assets.tiles[].pass`.
   - manter `tilePassable(x,y)` como fallback para compatibilidade.
   - ativar o novo sistema por padrão no runtime, mas com opção de usar `tileMovement` tradicional.

2. **Nível 2 — Pixel movement e broadphase**
   - adicionar propriedades contínuas ao jogador/NPC (`px`, `py`, `bounds`).
   - usar AABB vs AABB para colisões de corpo.
   - implementar `Broadphase` de seleção de tiles ao redor do corpo, como `minTileX/maxTileX`.
   - criar lógica de movimentação que teste `dx+dy`, depois `dx` e `dy` separadamente (wall sliding).
   - oferecer uma configuração em `proj.system` para **pixelMovement: true/false**.

3. **Nível 3 — Editor e grid-free**
   - manter o editor de tiles como está, com pintura em 48×48.
   - adicionar um modo de edição `Collision` para visualizar/ajustar máscaras.
   - adicionar `Snapping: Tile / Pixel` para eventos e objetos.
   - permitir edição de `event.x`/`event.y` em valor contínuo no editor.

4. **Nível 4 — Metadados e refinamento**
   - estender tile metadata com `collision` e suportar boxes/polygons.
   - automatizar colisoes padrão e preenchimento por nome de arquivo.
   - documentar os sufixos de tile (`_block`, `_top`, `_left`, `_slope`).
   - ajustar casos especiais de autotile.

5. **Nível 5 — Controles e UX final**
   - adicionar aba `Database ▸ Controles` e expor `pixelMovement`, `diagonalMove`, `dashButton`, `confirmButton`, `cancelButton`.
   - mostrar ajuda de controles no jogo.
   - validar a experiência com exemplos de mapas estreitos e transições suaves.

### 10.2 Etapas detalhadas

#### Etapa 1 — Preparar o motor físico mínimo

- crie um módulo ou extensão leve de colisão para RPGAtlas.
- defina corpos estáticos para tiles sólidos e corpos kinematic para o jogador/NPC.
- mantenha a renderização e o editor de tiles sem dependências novas.
- use a grade de tiles como indice para construir o mundo físico rapidamente.

#### Etapa 2 — Converter o jogador para coordenadas contínuas

- adicione `player.px`, `player.py`, `player.bounds`.
- no loop de atualização, calcule `dx`, `dy` a partir do input.
- antes de aplicar a movimentação, faça a broadphase no quadrante do jogador.
- teste colisão contra tiles sólidos e eventos bloqueadores.
- se houver contato, execute a correção de canto.

#### Etapa 3 — Manter compatibilidade com o modo atual

- preserve o modo antigo como fallback.
- permita habilitar/desabilitar pixel movement via `proj.system.pixelMovement`.
- se desativado, mantenha o fluxo atual de `startMove` / `updateEntityMotion`.
- se ativado, desvie para o novo motor contínuo.

#### Etapa 4 — Adicionar o editor de colisão

- crie um novo modo `Collision` no editor.
- desenhe boxes sobre tiles e eventos que têm colisão.
- permita alternar `Snapping: Tile / Pixel`.
- a edição deve ser opcional, usada somente para refinamento.

#### Etapa 5 — Refinar metadados e automação

- suporte `Assets.tiles[id].collision` e `map.collision` opcional.
- gere automaticamente colisões para tiles bloqueadores.
- ofereça uma função de `Auto-fill collision` no editor.
- documente como criar formas básicas e ajustar casos de autotile.

#### Etapa 6 — Criar a aba de controles

- implemente `Database ▸ Controles` como última etapa.
- mantenha o editor simples: configurações de input e flags de movimento.
- deixe `pixelMovement` ativado por padrão nessa aba, com opção para desativar.

### 10.3 Observação importante

Ativar o novo sistema desde o início ajuda a testar a integração completa, mas mantenha o comportamento tile-based como fallback seguro. A primeira versão deve focar em estabilidade e compatibilidade; só depois evoluir para designer-facing grid-free completo.

---

## 11. Resumo da solução

1. Manter o tilemap como base e adicionar uma **camada de colisão contínua**.
2. Tornar a movimentação em pixels uma opção no runtime.
3. Usar **boxes simples** como padrão e permitir polígonos apenas quando necessário.
4. Reusar a passabilidade atual para compatibilidade com tilesets RPG Maker.
5. Adicionar um modo de editor de colisão leve, com automação.
6. Incluir a aba `Controles` no Database como última etapa.

Essa abordagem entrega o que foi pedido:

- **Pixel movement** nativo e opcional.
- **Grid-free** no editor e no comportamento do jogador.
- **Uso de tilesets RPG Maker** sem forçar reforma completa.
- **Colisão fácil** para novatos, com ajustes pontuais quando necessário.
- **Solução prática** com mínima ruptura da arquitetura existente.

---

## Implementação — Progresso

Status de implementação completa das etapas do plano:

### Etapas Concluídas

- [x] **Etapa 1 — Motor físico mínimo**: `js/physics.js` implementado com AABB collision, broadphase por faixa de tiles, wall sliding (`moveWithSlide`), e detecção de corpos estáticos vs dinâmicos.

- [x] **Etapa 2 — Jogador em coordenadas contínuas**: `player.px`, `player.py`, `player.bounds` com hitbox de 24×32px (offset 12×16); corpo dinâmico registrado no `physicsWorld` em cada mapa.

- [x] **Etapa 3 — Compatibilidade com modo tile**: `proj.system.pixelMovement` ativado por padrão; fallback automático para movimento baseado em célula se desativado. Modo preserva `player.dir`, `player.moving`, `player.animT` e animação de caminhada.

- [x] **Etapa 4 — Broadphase + AABB + wall sliding**: `Physics.buildWorld(map, assets, tileSize)` cria corpos estáticos para tiles sólidos (via `Assets.tiles[id].collision` ou `map.passOv`); `Physics.moveWithSlide` testa movimento diagonal, depois horizontal/vertical separadamente para evitar travamento em corredores.

- [x] **Etapa 5 — Editor: modo Collision visual**: Modo `Collision` adicionado ao editor com botão `C`; desenha overlay de máscaras de colisão; permite seleção e visualização por célula.

- [x] **Etapa 6 — Metadados de colisão**: Suporte a `Assets.tiles[id].collision` (type: "box" com x, y, w, h); `map.collision.tiles[]` armazena máscaras por célula; `Physics.buildWorld` respeta ambas as fontes; fallback para full-block em tiles com `pass: false`.

- [x] **Etapa 7 — Editor: visual collision mask editor**: In-map editor com **8 handles** (4 cantos + 4 bordas midpoints), renderização de overlays, seleção de área com drag, movimento livre de máscara sem quantização a grid, suporte a Undo/Redo.
  - Clique simples: seleciona máscara existente na célula.
  - Arraste em área: seleciona múltiplas células e aplica full-tile collision.
  - Drag corner/edge: redimensiona máscara livremente.
  - Drag interior: move máscara dentro do tile.

- [x] **Fixes adicionais**:
  - Player `px/py` sincronizado com `rx/ry` em pixel movement.
  - Direção do player mantida corretamente durante movimento.
  - Animação de caminhada (`animT`) incrementada e renovada a cada frame.
  - Diagonal input com prioridade: mantém primeira tecla pressionada até soltar.
  - NPCs e eventos têm corpos dinâmicos registrados em `physicsWorld`.
  - `play.html` reordenado: `physics.js` antes de `engine.js` para evitar `ReferenceError`.
  - `proj.system.pixelMovement` padrão: `true` (ativado por padrão).
  - Patch notes registrado em `js/patch-notes.js`.

### Etapas Pendentes

- [ ] **Etapa 8 — Aba "Controles" no Database**: Interface para exibir/editar `pixelMovement`, `diagonalMove`, input bindings (`dashButton`, `confirmButton`, `cancelButton`), help text de controles. Será adicionada como última etapa de UX.

- [ ] **Refinamentos futuros**:
  - Automação de colisão por sufixo de tile (`_block`, `_slope`, `_top`, `_left`, `_right`).
  - Suporte a polígonos simples em `map.collision.tiles[]` (além de boxes).
  - Modo grid-free para posicionamento de eventos em coordenadas de pixel contínuo.
  - Integração com autotile do RPG Maker.

### Notas Técnicas

- `js/physics.js` é modular e não intrusivo; expõe `Physics.buildWorld`, `Physics.wouldCollide`, `Physics.moveWithSlide`.
- Collision overlay renderizado em `drawCollisionOverlay(g, m)` durante `mode === "collision"`.
- Handles hit-test com tolerância dinâmica: `hs = Math.max(10, TILE * 0.12)` (aprox. 10-15px em 48px tile).
- Estado de edição de colisão separado em `collisionEditCell`, `collisionEditRect`, `collisionDragState` ('handle'|'move'|'select'|'maybe').
- Seleção de área (`collisionSelection`) com `normRect` para aplicar full-tile a múltiplas células.
