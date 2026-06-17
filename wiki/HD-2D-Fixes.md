# HD-2D — Erros e Próximos Passos

## Status Atual (2026-06-17)

O modo HD-2D foi **temporariamente desativado** no editor e no runtime do jogo devido
a erros no pipeline PIXI v8 que impedem o preview e a renderização 3D.

### O que foi desativado

- **HD-2D Preview** (`Game` ▸ `HD-2D Preview`) — botão da toolbar e atalho
- **Runtime do jogo** — `hdWanted()` sempre retorna `false` (exceto `?hd2d=1`
  na URL)
- **Height Mode** continua ativo (pode pintar elevação), mas a renderização
  3D não acontece

### O que permanece ativo

- Map Properties ainda exibe as configs de HD-2D (tilt, fog, luzes, bloom, DOF)
- O mapa pode ter `hd2d` configurado, mas o engine ignora
- Hability mode (pintura de altura) continua funcionando normalmente

---

## Erros Conhecidos

### 1. `extractCanvas` — `Uncaught TypeError: Cannot read properties of null (reading 'texture')`

**Stack:**
```
new pe (pixi.min.js:20:51882)
extractCanvas (renderer.js:752)
renderFrame (renderer.js:538)
hdRenderOnce (editor.js:3701)
hdFrame (editor.js:3710)
toggleHdPreview (editor.js:3783)
```

**Causa:** `_sceneRT` é `null` quando `extractCanvas` é chamado pelo early
return de `renderFrame` (linha 536-538). O early return ocorre quando não há
mapa ou não há meshes de terreno/overhead, mas antes de `_ensureSceneRT` ser
chamado.

**Fix aplicado:** Adicionar `_ensureSceneRT(w, h)` no início de `extractCanvas`
(anteriormente não era chamado nesse caminho). **Pendente:** verificar se o
fix é suficiente após reativar o preview.

### 2. `buildScene` — `Uncaught TypeError: Cannot read properties of undefined (reading 'source')`

**Stack:**
```
new ee (pixi.min.js:38:12104)
ee.from (pixi.min.js:38:13235)
buildScene (renderer.js:248)
setMap (renderer.js:524)
hdRenderOnce (editor.js:3672)
```

**Causa:** `ch.texture.source` retorna `undefined` dentro de
`PIXI.Shader.from()`. O recurso `uSampler` fica `undefined`, e o construtor
do Shader tenta ler `p.source` em um valor `undefined`.

`ch.texture` é criado via `PIXI.Texture.from(c)` em `chopBuffer` (linha 163).
Aparentemente, em PIXI v8.19.0, texturas criadas a partir de canvas
(`HTMLCanvasElement`) podem ter `.source` como `undefined` em alguns cenários,
possivelmente quando o canvas é pequeno ou recém-criado.

**Fix tentativo:** Extrair `ch.texture.source` para uma variável e pular chunks
cujo `source` seja `undefined`. Também removido `uSampler_sampler` dos recursos
(parâmetro não usado em PIXI v8 para GLSL 100). **Pendente:** confirmar que a
renderização funciona com esse skip. Possível causa-raiz alternativa: o
`TextureSource` associado ao canvas não ter sido inicializado corretamente.

### 3. `PIXI.Shader.from` — uso de recursos

**Detalhe:** Em PIXI v8, `Shader.from()` espera que cada recurso seja um
objeto com propriedade `.source` (ex.: `Texture`, `TextureSource`) ou um
`UniformGroup`. Atualmente estamos passando `ch.texture.source` que deveria
ser um `TextureSource`. Se o `TextureSource` não tem `.source` (o getter
retorna `this`), passa direto.

**Pendente:** Investigar se deveríamos passar `ch.texture` (objeto `Texture`)
em vez de `ch.texture.source`.

---

## Próximos Passos

1. **Diagnosticar a causa-raiz do erro #2** — entender por que
   `ch.texture.source` é `undefined` para alguns chunks.
   - Verificar se `PIXI.Texture.from(c)` retorna corretamente em diferentes
     tamanhos de chunk
   - Testar com `PIXI.Texture.from(c, { resolution: 1 })` explícito
   - Verificar se o canvas precisa estar "committed" (ex.: `drawImage` não
     basta)
2. **Testar fix #1** — reativar HD-2D Preview e verificar se `_sceneRT` é
   sempre inicializado
3. **Reativar preview** — remover a desativação temporária após os fixes
4. **Reativar runtime** — restaurar `hdWanted()` original e testar no
   playtest
5. **Atualizar este documento** com os resultados dos testes

---

## Locais Relevantes no Código

| Arquivo | Linha(s) | Descrição |
|---------|----------|-----------|
| `js/renderer.js` | 163 | `PIXI.Texture.from(c)` — criação de textura de chunk |
| `js/renderer.js` | 190-317 | `buildScene()` — construção de meshes e shaders |
| `js/renderer.js` | 248, 298 | Uso de `ch.texture.source` em `Shader.from` |
| `js/renderer.js` | 528-538 | `renderFrame()` — early return que causou erro #1 |
| `js/renderer.js` | 745-753 | `extractCanvas()` — onde erro #1 ocorria |
| `js/renderer.js` | 756-761 | `_ensureSceneRT()` — cria o RenderTexture |
| `js/editor.js` | 3851-3897 | `hdRenderOnce()` — orquestra preview |
| `js/editor.js` | 3914-3975 | `toggleHdPreview()` — abre/fecha preview |
| `js/engine.js` | 406-423 | `hdWanted()` — lógica de ativação HD-2D no jogo |
