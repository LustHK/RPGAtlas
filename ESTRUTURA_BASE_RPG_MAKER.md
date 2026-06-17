# Documento de Especificação Técnica: Separação de Engine e Projeto (Estilo RPG Maker MV/MZ)

## 1. Objetivo Geral
O objetivo é reestruturar a arquitetura da engine de RPG de código aberto para separar completamente o **Runtime/Editor (Engine)** do **Conteúdo do Jogo (Projeto)**. Atualmente, os arquivos de sistema e de jogo estão misturados. Desejamos uma abordagem modular onde a engine possa carregar projetos dinamicamente e criar novos projetos a partir de um template padrão (RTP - Run-Time Package).

---

## 2. Divisão de Responsabilidades

Para atingir a separação de conceitos, a arquitetura deve ser dividida em duas entidades distintas:

### A. A Engine (Runtime e Editor)
*   **Papel:** É o executor do jogo (player) ou o ambiente de edição (editor). Ele deve ser estático e imutável pelo criador do jogo.
*   **Conteúdo:**
    *   Código-fonte do player (renderizadores, gerenciador de áudio, interpretador de eventos, etc.).
    *   Bibliotecas externas (ex: PixiJS, Howler.js).
    *   **Diretório de Templates (`/template`):** Uma pasta interna contendo a estrutura inicial do projeto e assets padrão (RTP), que será copiada ao criar um novo jogo.

### B. O Projeto do Usuário
*   **Papel:** Contém apenas as definições, roteiros, assets visuais, sonoros e plugins específicos daquele jogo.
*   **Conteúdo:** Segue estritamente a estrutura definida no próximo tópico.

---

## 3. Estrutura de Diretórios de um Novo Projeto (Template / RTP)

Quando um novo projeto for criado, o gerador deve clonar/copiar a seguinte estrutura contida no diretório `/template` da engine para o diretório de destino escolhido pelo usuário:

```text
[Nome do Projeto]/
├── index.html                  # Inicializador web do projeto (aponta para a engine)
├── package.json                # Metadados e dependências do projeto (NW.js / Electron)
├── Game.rpgproject             # Arquivo identificador do projeto (vazio ou com config básica)
├── audio/                      # Recursos de Áudio Padrão (RTP básico)
│   ├── bgm/
│   ├── bgs/
│   ├── me/
│   └── se/
├── data/                       # Arquivos JSON de Banco de Dados padrão
│   ├── Actors.json
│   ├── Classes.json
│   ├── Items.json
│   ├── Skills.json
│   ├── Weapons.json
│   ├── Armors.json
│   ├── Enemies.json
│   ├── Troops.json
│   ├── States.json
│   ├── Animations.json
│   ├── Tilesets.json
│   ├── CommonEvents.json
│   ├── System.json
│   ├── MapInfos.json
│   └── Map001.json             # Mapa inicial padrão
├── fonts/                      # Fontes do jogo
│   └── gamefont.css
├── img/                        # Recursos Gráficos Padrão (RTP básico)
│   ├── animations/
│   ├── battlebacks1/
│   ├── battlebacks2/
│   ├── characters/
│   ├── enemies/
│   ├── faces/
│   ├── parallaxes/
│   ├── pictures/
│   ├── sv_actors/
│   ├── sv_enemies/
│   ├── system/
│   ├── tilesets/
│   └── titles1/ / titles2/
├── js/                         # Lógica específica do projeto e scripts de inicialização
│   ├── plugins/                # Plugins de terceiros adicionados pelo usuário
│   ├── main.js                 # Ponto de entrada que chama a Engine externa
│   └── plugins.js              # Configurações de ativação dos plugins
├── movies/                     # Vídeos do projeto
└── save/                       # Pasta criada dinamicamente para saves de progresso
```

---

## 4. Fluxo de Criação de Novo Projeto (Bootstrapping)

A IA deve programar a ferramenta de linha de comando (CLI) ou a interface do Editor para realizar os seguintes passos ao criar um projeto:

1.  **Solicitar Entrada:** Solicitar ao usuário o nome do projeto e o caminho de destino (ex: `/documentos/MeuJogo`).
2.  **Validar Destino:** Garantir que a pasta de destino esteja vazia ou criar uma nova pasta com o nome informado.
3.  **Copiar Template:** Copiar recursivamente todo o conteúdo do diretório de template da Engine (`engine/template/*`) para o diretório do projeto.
4.  **Ajustar Configurações:** Se necessário, reescrever campos específicos no `package.json` ou `Game.rpgproject` gerados, definindo o nome do projeto de forma dinâmica.

---

## 5. Como o Runtime Deve Carregar o Projeto (Engine Loading)

Para que a Engine (que está em outro diretório) consiga rodar o projeto do usuário sem misturar os arquivos, ela precisa ser capaz de ler os dados de forma relativa ao diretório do projeto ativo.

### Abordagens Recomendadas para Implementação:

#### Opção A: Passagem de Parâmetro via CLI / Executável
Ao abrir o jogo pelo editor ou executável do player, passa-se o caminho do projeto como argumento:
```bash
# Exemplo de comando executado em segundo plano pelo Editor:
player.exe --project-path="C:/User/Documents/MeuJogo"
```
No código da Engine, a leitura de arquivos (`fs` no Node.js ou requisições `fetch` no ambiente web) deve resolver o caminho base com base nesse argumento:
```javascript
// Exemplo conceitual em JavaScript
const path = require('path');
const projectPath = getCommandLineArgument('--project-path') || process.cwd();

// Para carregar o banco de dados de atores:
const actorsPath = path.join(projectPath, 'data', 'Actors.json');
```

#### Opção B: Inicialização Baseada no `index.html` do Projeto
O `index.html` gerado na pasta do usuário serve como o ponto de partida. Ele carrega os scripts globais da Engine por meio de caminhos relativos ou absolutos apontando para a pasta onde a Engine está instalada, mas executa o jogo lendo o diretório local (onde o `index.html` reside) como a raiz do projeto.

---

## 6. Instruções para a IA de Desenvolvimento

Ao processar este documento, a IA encarregada do desenvolvimento deve focar em:

1.  **Estruturação de Pastas:** Criar uma pasta `/engine` (contendo o interpretador, bibliotecas e o diretório `/template`) e documentar como o desenvolvedor final deve empacotá-la.
2.  **Script de Instanciação:** Desenvolver um script (em Node.js, Python ou na linguagem nativa do seu projeto) que realize a cópia segura dos assets padrão (RTP) sem corromper arquivos binários (imagens, áudios).
3.  **Abstração de Paths:** Modificar o sistema de gerenciamento de arquivos (File Manager/Resource Loader) da engine para que todas as buscas de assets (`img/`, `audio/`, `data/`) prefixem o caminho dinâmico do projeto ativo, em vez de assumir que estão rodando na mesma pasta do executável da engine.

# Especificação Técnica: Implementação do Gerador de Projetos (Fluxo de Criação e Cópia de RTP)

## 1. Fluxo de Experiência do Usuário (UX/UI)
O processo de criação de um novo jogo deve seguir os seguintes passos na interface da Engine (seja via Editor Gráfico ou CLI):

1.  **Ação de Gatilho:** O usuário seleciona a opção "Novo Projeto".
2.  **Entrada de Dados:** A interface solicita três informações essenciais:
    *   **Nome do Projeto (Pasta):** Usado para criar o diretório físico (ex: `meu_jogo_rpg`).
    *   **Título do Jogo:** Nome amigável que aparecerá na barra de título do jogo e nos metadados (ex: `As Aventuras de Aluxes`).
    *   **Caminho de Destino:** Um seletor de diretório para que o usuário escolha onde a pasta do projeto será criada (ex: `D:/MeusProjetos/`).
3.  **Processamento:** Ao clicar em "Confirmar", a engine executa o assistente de geração em segundo plano.

---

## 2. Mecânica de Geração do Projeto (Backend da Engine)

Quando o processo de criação é iniciado, a Engine deve executar a seguinte lógica programática:

```text
[Diretório Interno da Engine]                   [Pasta de Destino do Usuário]
├── resources/                                  ├── D:/MeusProjetos/
│   └── template/ (RTP Completo)  ─────────►    │   └── meu_jogo_rpg/ (Cópia idêntica)
```

### Passo 1: Criação da Pasta de Destino
*   Concatenar o *Caminho de Destino* com o *Nome do Projeto* (ex: `D:/MeusProjetos/meu_jogo_rpg`).
*   Verificar se a pasta já existe. Se não existir, criá-la. Se existir e não estiver vazia, retornar um erro amigável ao usuário antes de prosseguir.

### Passo 2: Cópia Recursiva do RTP (Template)
*   A engine deve conter uma pasta interna (ex: `resources/template/` ou similar) com toda a estrutura básica de arquivos (conforme o padrão RPG Maker MV/MZ) e os assets padrão (imagens, áudios, fontes, scripts iniciais).
*   Realizar a cópia de todos os arquivos e subpastas desse template para a nova pasta criada no *Passo 1*.
*   *Nota de implementação:* Certifique-se de usar métodos de cópia que preservem a integridade de arquivos binários (imagens `.png`, áudios `.ogg`/`.m4a`, etc.).

### Passo 3: Injeção de Metadados
Após a cópia, a engine deve abrir e atualizar os arquivos de configuração do novo projeto com as informações inseridas pelo usuário:

1.  **`package.json`:**
    *   Substituir o campo `"name"` pelo *Nome do Projeto* limpo (sem caracteres especiais).
    *   Se houver um campo para o título da janela (como no NW.js ou Electron), atualizar para o *Título do Jogo*.
2.  **`Game.rpgproject` (ou arquivo equivalente de identificação):**
    *   Gravar informações básicas de compatibilidade e versão da engine.
3.  **`data/System.json` (ou arquivo equivalente do banco de dados):**
    *   Atualizar o campo correspondente ao título do jogo (ex: `"gameTitle": "Título do Jogo"`) para garantir que o título apareça corretamente na tela inicial do jogo.

---

## 3. Diretrizes de Implementação para a IA

Ao programar esta funcionalidade, implemente as seguintes boas práticas:

*   **Feedback Visual:** Forneça uma barra de progresso ou um indicador de carregamento ("Criando projeto, por favor aguarde..."), pois a cópia do RTP pode levar alguns segundos dependendo do tamanho dos assets padrão.
*   **Tratamento de Erros:** Adicione blocos `try-catch` ao redor de operações de criação de pastas e cópia de arquivos. Se o usuário selecionar um diretório sem permissão de escrita (ex: partições protegidas do sistema), mostre uma mensagem clara indicando o erro de permissão.
*   **Independência de Plataforma:** Utilize utilitários de caminho robustos (como o módulo `path` do Node.js) para garantir que a concatenação de caminhos de arquivos funcione tanto em Windows quanto em macOS e Linux (usando separadores de caminho corretos `/` ou `\`).

### Exemplo de Pseudocódigo para o Gerador:

```javascript
const fs = require('fs-extra'); // ou fs.promises nativo
const path = require('path');

async function createNewProject(projectName, gameTitle, destinationDir) {
    const projectPath = path.join(destinationDir, projectName);
    const templatePath = path.join(__dirname, 'resources', 'template');

    try {
        // 1. Criar pasta do projeto
        await fs.ensureDir(projectPath);

        // 2. Copiar estrutura padrão (RTP)
        await fs.copy(templatePath, projectPath);

        // 3. Atualizar package.json
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            const packageData = await fs.readJson(packageJsonPath);
            packageData.name = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            // se houver window title config:
            if (packageData.window) packageData.window.title = gameTitle;
            await fs.writeJson(packageJsonPath, packageData, { spaces: 2 });
        }

        // 4. Atualizar System.json (Título interno do jogo)
        const systemJsonPath = path.join(projectPath, 'data', 'System.json');
        if (await fs.pathExists(systemJsonPath)) {
            const systemData = await fs.readJson(systemJsonPath);
            systemData.gameTitle = gameTitle;
            await fs.writeJson(systemJsonPath, systemData, { spaces: 2 });
        }

        return { success: true, path: projectPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

# Plano de Implementação

## Sumário das Fases

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Criar template/RTP em `resources/template/` | ✅ Concluído |
| 2 | Criar módulo gerador de projetos (`js/editor/project-generator.js`) | ✅ Concluído |
| 3 | Adicionar novos comandos Tauri (`src-tauri/src/lib.rs`) | ✅ Concluído |
| 4 | Atualizar `host.js` e `project-io.js` | ✅ Concluído |
| 5 | Novo diálogo "Novo Projeto" no editor (`editor.js`) | ✅ Concluído |
| 6 | Carregar projeto do sistema de arquivos | ✅ Concluído |
| 7 | Playtest com pasta de projeto (`play.html`, `engine.js`) | ✅ Concluído |
| 8 | Adicionar novas chaves i18n | ✅ Concluído |
| 9 | Adicionar entrada em `patch-notes.js` | ✅ Concluído |

---

## Fase 1 — Template / RTP (`resources/template/`)

### Objetivo
Criar a estrutura de diretórios do projeto padrão (RTP) dentro da engine, que será copiada toda vez que um novo projeto for criado.

### Estrutura a criar

```
resources/template/
├── index.html                  # Carrega scripts da engine
├── package.json                # Metadados do projeto
├── Game.rpgproject             # Identificador do projeto
├── audio/
│   ├── bgm/
│   ├── bgs/
│   ├── me/
│   └── se/
├── data/                       # JSONs padrão (RPG Maker MZ compatível)
│   ├── Actors.json
│   ├── Classes.json
│   ├── Items.json
│   ├── Skills.json
│   ├── Weapons.json
│   ├── Armors.json
│   ├── Enemies.json
│   ├── Troops.json
│   ├── States.json
│   ├── Animations.json
│   ├── Tilesets.json
│   ├── CommonEvents.json
│   ├── System.json             # gameTitle será injetado na criação
│   ├── MapInfos.json
│   └── Map001.json             # Mapa inicial vazio
├── fonts/
│   └── gamefont.css
├── img/
│   ├── animations/
│   ├── battlebacks1/
│   ├── battlebacks2/
│   ├── characters/
│   ├── enemies/
│   ├── faces/
│   ├── parallaxes/
│   ├── pictures/
│   ├── sv_actors/
│   ├── sv_enemies/
│   ├── system/
│   ├── tilesets/
│   ├── titles1/
│   └── titles2/
├── js/
│   ├── plugins/
│   ├── main.js                 # Ponto de entrada que carrega a engine
│   └── plugins.js              # Configurações de plugins
├── movies/
└── save/                       # (criado dinamicamente em runtime)
```

### Arquivos de dados (JSON)
Os arquivos em `data/` seguem o schema do RPGAtlas (objetos `RA.*` em `data.js`). Cada JSON conterá arrays vazios ou defaults mínimos. O `System.json` terá `gameTitle` como placeholder e `startMapId: 1`. O `Map001.json` será um mapa 20×15 vazio (só terreno grama).

### Template `index.html`
O `index.html` do projeto carregará os scripts da engine por caminhos relativos que apontam para a instalação da engine (ex: `../engine/js/` ou um caminho configurável). Ele também conterá um `<script>` que define `window.RPGATLAS_PROJECT_PATH` com o caminho da pasta do projeto, para que a engine saiba onde ler `data/`, `img/` e `audio/`.

---

## Fase 2 — Módulo Gerador de Projetos (`js/editor/project-generator.js`)

### Objetivo
Criar o módulo JavaScript responsável por orquestrar a criação de um novo projeto no sistema de arquivos.

### Interface
```js
export async function createNewProject(projectName, gameTitle, destinationDir)
```

### Lógica
1. Valida o nome do projeto (sanitizado, sem caracteres especiais)
2. Concatena `destinationDir/projectName` como caminho final
3. Verifica se a pasta já existe e não está vazia → retorna erro
4. Cria a pasta de destino
5. Copia recursivamente `resources/template/` para a pasta de destino
6. Lê e injeta metadados:
   - `package.json`: `name` (sanitizado), `window.title` (gameTitle)
   - `data/System.json`: `gameTitle`
   - `Game.rpgproject`: metadados (engine version, title)
7. Retorna `{ success: true, path: projectPath }` ou `{ success: false, error }`

### Dependências
- No Tauri: usa comandos nativos Rust para I/O de arquivos
- No browser: fallback cria um `.zip` para download (ou usa File System Access API se disponível)

---

## Fase 3 — Comandos Tauri (`src-tauri/src/lib.rs`)

### Objetivo
Adicionar comandos nativos Rust necessários para criar pastas, copiar templates e ler/escrever projetos como pastas.

### Novos comandos

| Comando | Descrição | Retorno |
|---------|-----------|---------|
| `pick_folder()` | Diálogo nativo para selecionar pasta de destino | `Option<String>` (caminho ou null se cancelado) |
| `create_project_folder(projectName, gameTitle, destinationDir)` | Cria pasta, copia template, injeta metadados | `String` (caminho do projeto criado) |
| `load_project_folder(path)` | Lê todos `data/*.json` da pasta, monta objeto projeto | `String` (JSON completo do projeto) |
| `save_project_folder(path, projectJson)` | Recebe projeto completo, salva cada seção em `data/*.json` | `()` |
| `read_template_file(relativePath)` | Lê um arquivo do template da engine | `String` (conteúdo) |

### Implementação em Rust
Usar `std::fs` para operações de arquivo e `tauri_plugin_dialog` para os diálogos de pasta. A cópia do template será recursiva, preservando arquivos binários.

---

## Fase 4 — Atualizar `host.js` e `project-io.js`

### `js/editor/host.js`
Adicionar métodos:
- `pickFolder()` → invoca `pick_folder` Tauri
- `createProject(projectName, gameTitle, destinationDir)` → invoca `create_project_folder`
- `loadProjectFromFolder(path)` → invoca `load_project_folder`
- `saveProjectToFolder(path, project)` → invoca `save_project_folder`

### `js/editor/project-io.js`
Exportar funções:
- `openProjectFromFolder()` — wrapper que usa host (Tauri) ou fallback browser
- `saveProjectAsFolder()` — wrapper que serializa projeto para `data/*.json`
- `sanitizeProjectName(name)` — sanitiza nome para nome de pasta seguro

---

## Fase 5 — Novo Diálogo "Novo Projeto" (UI no `editor.js`)

### Objetivo
Substituir o "Novo Projeto" atual (que só reseta para o jogo de exemplo) por um diálogo completo que permite criar um projeto no sistema de arquivos.

### Fluxo
1. Usuário clica em "New Project…" no menu File
2. Modal aparece com 3 campos:
   - **Project Name** (folder name, ex: `my_rpg_game`)
   - **Game Title** (display name, ex: `My RPG Game`)
   - **Destination** (texto + botão "Browse…" que abre seletor de pasta)
3. Ao clicar "Create":
   - Se Tauri: chama `host.createProject()` nativo
   - Se browser: fallback cria projeto em memória + download como `.zip` ou avisa que precisa do Tauri
4. Após criação bem-sucedida:
   - Abre o projeto no editor (carrega os dados da pasta)
   - Mostra status `"Project created at {path}"`

---

## Fase 6 — Carregar Projeto do Sistema de Arquivos

### Objetivo
Permitir que o editor abra projetos salvos como pastas no sistema de arquivos (não só `.json` único).

### Alterações no `editor.js`
- `boot()`: após `loadStored()`, tentar restaurar último caminho de projeto
- Novo menu "Open Project Folder…" que abre seletor de pasta
- `desktopSave()`: se projeto vinculado a uma pasta, salvar para lá (individual `data/*.json`); senão, salvar `.json` único como hoje
- Indicador visual mostrando qual projeto está aberto (caminho da pasta)

### `js/editor/project-fs.js` (novo)
Módulo auxiliar:
- `loadProjectFromFolder(path)` — lê todos `data/*.json`, monta objeto projeto
- `saveProjectToFolder(path, project)` — salva cada seção do projeto em `data/*.json`
- `readDataFile(path, filename)` — lê JSON individual
- `writeDataFile(path, filename, data)` — escreve JSON individual

---

## Fase 7 — Playtest com Pasta de Projeto

### Objetivo
Permitir que o playtest carregue o projeto diretamente da pasta no sistema de arquivos, em vez de depender apenas de `localStorage`.

### `play.html`
- Aceitar parâmetro `?projectPath=` na URL
- Se presente, carregar `data/*.json` da pasta informada
- Montar `window.RPGATLAS_PROJECT` a partir dos arquivos

### `engine.js`
- Nova função `loadProjectFromPath(path)` que lê `data/*.json` por fetch (file:// ou http://)
- No Tauri: usar comando `load_project_folder` para ler os arquivos
- Fallback: manter comportamento atual (window.RPGATLAS_PROJECT, localStorage)

---

## Fase 8 — Novas Chaves i18n

### `locales/en.json`
```json
"action.new_project_folder": "New Project Folder…",
"action.open_project_folder": "Open Project Folder…",
"action.save_project_folder": "Save Project to Folder…",
"dialog.new_project": "Create New Project",
"dialog.new_project_name": "Project Name",
"dialog.new_project_title": "Game Title",
"dialog.new_project_destination": "Destination Folder",
"dialog.browse": "Browse…",
"dialog.create": "Create",
"status.project_created": "Project created at {path}",
"status.project_loaded": "Project loaded from {path}",
"tip.new_project_folder": "Create a new RPG project folder using the engine template (RTP)"
```

### Demais locales
Adicionar as mesmas chaves traduzidas em `pt.json`, `es.json`, `fr.json`, `de.json`.

---

## Fase 9 — Patch Notes

### `js/patch-notes.js`
Adicionar entrada ao topo do array `PATCH_NOTES`:
```js
{
  title: "Engine/Project Separation + RTP Generator",
  summary: "Separated the engine runtime from user projects. Added a complete RTP template system and project generator following RPG Maker MZ folder conventions.",
  items: [
    "Created resources/template/ with full RPG Maker MZ-style project structure (data/, img/, audio/, fonts/, js/plugins/)",
    "Added project generator module that copies the RTP template and injects project metadata (title, name) into System.json, package.json, and Game.rpgproject",
    "New Tauri native commands for folder picking, template copying, and project folder I/O",
    "Refreshed New Project dialog with Project Name, Game Title, and destination folder selector",
    "Editor can now open and save projects as folder structures on the filesystem",
    "Playtest can load projects directly from a filesystem folder path",
    "New i18n keys for project management across all 5 supported languages"
  ]
}
```

---

## Checklist de Progresso

- [x] **Fase 1** — resources/template/ com estrutura completa
- [x] **Fase 2** — project-generator.js implementado
- [x] **Fase 3** — Comandos Tauri adicionados
- [x] **Fase 4** — host.js e project-io.js atualizados
- [x] **Fase 5** — Novo diálogo "Novo Projeto" no editor
- [x] **Fase 6** — Carregar/salvar projetos como pastas
- [x] **Fase 7** — Playtest com pasta de projeto
- [x] **Fase 8** — Novas chaves i18n em todos os locales
- [x] **Fase 9** — Entrada em patch-notes.js

## Bugfixes Aplicados (Revisão Profunda)

| # | Bug | Severidade | Arquivo | Fix |
|---|-----|-----------|---------|-----|
| 1 | `save_project_folder` nunca salvava mapas individuais | Crítico | `src-tauri/src/lib.rs:366-401` | Adicionada serialização de `MapInfos.json` + `MapXXX.json` |
| 2 | Template `index.html` referenciava scripts inexistentes no projeto | Crítico | `resources/template/index.html` | Reescrito para carregar scripts da engine via `RPGATLAS_ENGINE_PATH` configurável |
| 3 | `CommonEvents.json` ignorado no load/save do Rust | Alto | `src-tauri/src/lib.rs:271,352` | Adicionado `("CommonEvents", "commonEvents")` aos mapeamentos |
| 4 | `engine.js:loadProjectFromPath` não carregava Animations, Tilesets, CommonEvents | Alto | `js/engine.js:3413-3415` | Adicionadas 3 seções ao array `sections` |
| 5 | Ações do menu usavam strings hardcoded em vez de chaves i18n | Alto | `js/editor.js:5196-5222` | Substituído `label`/`tip` por chaves i18n (`action.*`, `tip.*`) |
| 6 | Tilesets salvos redundantemente em System.json + Tilesets.json | Alto | `src-tauri/src/lib.rs:330` | Removido `"tilesets"` do System.json (só Tilesets.json) |
| 7 | Chaves i18n `tip.open_project_folder`, `tip.save_project_folder`, `dialog.confirm_new_project` inexistentes | Alto | `locales/*.json` | Adicionadas a todos os 5 idiomas |
| 8 | Diálogo `pick_folder` usava `.file().blocking_pick_folder()` em vez de `.folder().blocking_pick_folder()` | Menor | `src-tauri/src/lib.rs:70` | Corrigido para `app.dialog().folder()` |