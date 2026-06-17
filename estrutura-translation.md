gostaria de separar oque é Engine do que é jogo. As traduções de jogo devem estar na pasta do projeto, onde o usuário consegue escrever as falas e etc.


Separar as traduções da **Engine** (interface do editor, menus de sistema, logs padrões de batalha) das traduções do **Jogo** (diálogos, nomes de itens customizados, textos de missões criados pelo usuário) é uma excelente prática de arquitetura. Isso garante que atualizações na engine não sobrescrevam o conteúdo criado pelo desenvolvedor do jogo.

Uma abordagem para implementar essa separação envolve estruturar os arquivos de forma independente e adaptar o sistema de busca de chaves da função `t()`.

---

### 1. Nova Estrutura de Diretórios

As traduções do núcleo da engine continuam na pasta raiz ou do editor, enquanto as traduções do jogo ficam dentro do diretório do projeto ativo.

```text
rpg-atlas/
├── locales/                 <-- Traduções exclusivas da ENGINE (Editor e Runner Core)
│   ├── en.json
│   └── pt.json
├── js/
│   └── i18n.js              <-- Gerenciador unificado
└── projects/                
    └── meu-jogo-rpg/        <-- Pasta do projeto do usuário
        ├── data/
        └── locales/         <-- Traduções exclusivas do JOGO do usuário
            ├── en.json
            └── pt.json
```

---

### 2. Adaptação do `js/i18n.js` (Gerenciador de i18n)

O gerenciador precisa ser capaz de carregar os arquivos de tradução da engine e, de forma condicional, os arquivos de tradução do projeto ativo. 

A resolução da tradução deve seguir uma **fila de prioridade (cascata)** ao buscar uma chave com `t()`:
1. Buscar no idioma selecionado do **Jogo** (`projects/meu-jogo/locales/[lang].json`).
2. Se não encontrar, buscar no idioma de fallback (inglês) do **Jogo**.
3. Se não encontrar, buscar no idioma selecionado da **Engine** (`locales/[lang].json`).
4. Se não encontrar, usar o fallback (inglês) da **Engine**.
5. Em última instância, retornar a própria chave enviada.

#### Exemplo de implementação para o `js/i18n.js`:

```javascript
class RPGAtlasI18n {
  constructor() {
    this.engineTranslations = {};
    this.engineFallback = {};
    this.gameTranslations = {};
    this.gameFallback = {};
    
    this.currentLanguage = 'en';
    this.fallbackLanguage = 'en';
    this.projectPath = null;
  }

  /**
   * Inicializa o sistema de i18n para a Engine
   */
  async init(lang) {
    this.currentLanguage = lang;
    
    // 1. Carrega idioma principal da Engine
    this.engineTranslations = await this.loadJson(`./locales/${lang}.json`) || {};
    
    // 2. Carrega fallback da Engine (se o idioma atual não for o padrão)
    if (lang !== this.fallbackLanguage) {
      this.engineFallback = await this.loadJson(`./locales/${this.fallbackLanguage}.json`) || {};
    }
  }

  /**
   * Carrega as traduções do jogo atual quando um projeto é aberto
   */
  async loadProjectLocales(projectPath, lang) {
    this.projectPath = projectPath;
    
    // Caminho para a pasta locales dentro do projeto do usuário
    const basePath = `${projectPath}/locales`;
    
    // Carrega idioma do jogo
    this.gameTranslations = await this.loadJson(`${basePath}/${lang}.json`) || {};
    
    // Carrega fallback do jogo
    if (lang !== this.fallbackLanguage) {
      this.gameFallback = await this.loadJson(`${basePath}/${this.fallbackLanguage}.json`) || {};
    } else {
      this.gameFallback = {};
    }
  }

  /**
   * Função auxiliar para carregar arquivos JSON
   */
  async loadJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.warn(`Não foi possível carregar o arquivo de tradução: ${url}`);
      return null;
    }
  }

  /**
   * Resolve chaves aninhadas como "menu.items.heal" em objetos
   */
  resolveKey(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
  }

  /**
   * Substitui variáveis dinâmicas em strings, ex: "Olá, {name}"
   */
  interpolate(string, variables) {
    return string.replace(/{([^}]+)}/g, (match, key) => {
      return typeof variables[key] !== 'undefined' ? variables[key] : match;
    });
  }

  /**
   * Função de tradução principal com cascata de busca
   */
  t(key, variables = {}) {
    let text;

    // 1. Tenta achar no arquivo de idioma atual do Jogo
    text = this.resolveKey(this.gameTranslations, key);
    if (text !== undefined) return this.interpolate(text, variables);

    // 2. Tenta achar no fallback (inglês) do Jogo
    text = this.resolveKey(this.gameFallback, key);
    if (text !== undefined) return this.interpolate(text, variables);

    // 3. Tenta achar no arquivo de idioma atual da Engine
    text = this.resolveKey(this.engineTranslations, key);
    if (text !== undefined) return this.interpolate(text, variables);

    // 4. Tenta achar no fallback (inglês) da Engine
    text = this.resolveKey(this.engineFallback, key);
    if (text !== undefined) return this.interpolate(text, variables);

    // 5. Retorna a chave crua se nada for encontrado
    return key;
  }
}

// Expõe globalmente
window.RPGAtlasI18n = new RPGAtlasI18n();
window.t = (key, variables) => window.RPGAtlasI18n.t(key, variables);
```

---

### 3. Como integrar no fluxo do Editor e Runner

* **No Editor (ao carregar um projeto):**
  Quando o usuário abrir o projeto "meu-jogo-rpg", o editor chama o método de carregamento do projeto:
  ```javascript
  await RPGAtlasI18n.init('pt'); // Inicializa engine em Português
  await RPGAtlasI18n.loadProjectLocales('projects/meu-jogo-rpg', 'pt'); // Inicializa jogo do usuário
  ```

* **No Runner (play.html):**
  O runner lê as configurações do jogo e descobre qual projeto está rodando. Ele carrega os recursos da pasta desse projeto e, em seguida, as traduções correspondentes:
  ```javascript
  const projectPath = 'projects/meu-jogo-rpg';
  const gameLang = config.language || 'en';
  
  await RPGAtlasI18n.init(gameLang);
  await RPGAtlasI18n.loadProjectLocales(projectPath, gameLang);
  ```

---

### 4. Estrutura dos Arquivos de Tradução

Com essa separação, os arquivos JSON se tornam mais focados e organizados.

* **Tradução da Engine (`/locales/pt.json`):**
  ```json
  {
    "menu": {
      "save": "Salvar Jogo",
      "load": "Carregar Jogo",
      "options": "Opções"
    },
    "battle": {
      "victory": "Vitória!",
      "defeat": "Fim de Jogo"
    }
  }
  ```

* **Tradução do Jogo do Usuário (`/projects/meu-jogo-rpg/locales/pt.json`):**
  ```json
  {
    "dialogues": {
      "intro_villager": "Olá, jovem herói! Por favor, salve nossa vila.",
      "chest_find": "Você encontrou um {itemName}!"
    },
    "database": {
      "items": {
        "potion_01": "Poção Simples"
      }
    }
  }
  ```

Se o desenvolvedor usar a função `t("dialogues.intro_villager")` em um evento de diálogo ou `t("menu.save")` na barra de menu, o sistema resolverá cada um no seu respectivo escopo sem misturar arquivos de código da engine com os arquivos de conteúdo do jogo.
















---------------------------------------------------------------------------------------------------------------------------------------------------------------------















Posso estar sonhando muito, mas... E se houver um auto salvamento em json?
No RPG Maker o usuário escreve na lingua original do game e já aparece no pt.json do projeto, ao mudar no pt.json já muda dentro da engine.
E ao criar um en.json o sistema já coloca a lingua nas configurações do jogo com a tradução em inglês, usando a principal de fallback. Daria para fazer sem muito trabalho? Não queremos reinventar a roda, então soluções prontas são sempre bem vindas.



Essa ideia não é um "sonho distante"; na verdade, é uma decisão arquitetural elegante e prática. Muitos motores modernos e ferramentas de localização profissionais utilizam essa exata abordagem.

Para viabilizar essa sincronização bidirecional (Editor $\leftrightarrow$ JSON) de forma simples e sem "reinventar a roda", o segredo está em **mudar o que o banco de dados do jogo armazena**.

---

### O Conceito: Banco de Dados Baseado em Chaves (*Deterministic Keys*)

Em vez de salvar o texto bruto (como `"Eric"`) dentro do arquivo do banco de dados (ex: `actors.json`), o editor armazena apenas chaves estruturadas. 

Por exemplo, o campo de nome do Herói 1 aponta para a chave: `db.actors.1.name`.

1. **Quando o usuário digita no editor:** O editor grava o texto `"Eric"` diretamente em `locales/pt.json` (idioma original) sob a chave `db.actors.1.name`.
2. **Quando o editor renderiza o campo:** Ele exibe o retorno de `t("db.actors.1.name")`.
3. **Se o usuário edita o `pt.json` manualmente por fora:** Ao reabrir o editor ou recarregar o jogo, a função `t()` lerá o novo valor do JSON e o editor exibirá o texto atualizado automaticamente.

Isso cria um vínculo direto de duas vias.

---

### Passo 1: Adicionando Gravação Dinâmica no `i18n.js`

Para que o editor possa salvar as alterações em tempo real no JSON do projeto, precisamos estender o gerenciador `RPGAtlasI18n` com uma função para atualizar valores na memória e disparar o salvamento em disco.

```javascript
// Adicione este método dentro da classe RPGAtlasI18n no seu i18n.js
setTranslation(key, value) {
  const keys = key.split('.');
  let current = this.gameTranslations;

  // Percorre o objeto para criar ou acessar a estrutura de chaves (ex: db -> actors -> 1 -> name)
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!current[k]) {
      current[k] = {};
    }
    current = current[k];
  }

  // Define o novo valor digitado pelo usuário
  current[keys[keys.length - 1]] = value;

  // Dispara o salvamento físico do arquivo JSON do jogo
  this.saveGameLocale();
}

async saveGameLocale() {
  if (!this.projectPath) return;
  const filePath = `${this.projectPath}/locales/${this.currentLanguage}.json`;
  
  // Aqui você usa a API de escrita do ambiente que sua engine roda (Electron, NW.js, Node ou File System Access API)
  // Exemplo hipotético usando uma ponte com o processo principal (IPC) ou Node.js (fs):
  if (window.fs) {
    await window.fs.writeFile(filePath, JSON.stringify(this.gameTranslations, null, 2));
  } else {
    // Caso rode direto no navegador puro, você pode gerenciar isso enviando uma requisição para o seu servidor local de desenvolvimento
    fetch('/api/save-locale', {
      method: 'POST',
      body: JSON.stringify({ path: filePath, data: this.gameTranslations })
    });
  }
}
```

---

### Passo 2: Vinculando os Inputs do Editor

No painel de configuração de Personagens, Itens ou Diálogos do editor, você faz o campo de texto escutar as alterações e gravar no JSON:

```javascript
// Exemplo ao carregar a tela de edição do Herói 1
const actorKey = `db.actors.1.name`;

// 1. O input herda o valor atual da tradução
inputNome.value = t(actorKey) || ""; 

// 2. Ao digitar, atualiza dinamicamente o arquivo JSON de idioma
inputNome.addEventListener('input', (e) => {
  RPGAtlasI18n.setTranslation(actorKey, e.target.value);
});
```

---

### Passo 3: Detecção Automática de Novos Idiomas

Para listar as opções de idioma disponíveis nas configurações do jogo sem precisar de um cadastro manual, basta ler o conteúdo da pasta `locales` do projeto.

Se você estiver rodando em ambientes híbridos como **Electron/NW.js** ou um servidor de desenvolvimento local, a leitura é direta:

```javascript
// No Editor / Menu de Opções do Jogo
async function getAvailableLanguages(projectPath) {
  try {
    if (window.fs) {
      // Exemplo se tiver acesso ao módulo fs do Node
      const files = await window.fs.readdir(`${projectPath}/locales`);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', '')); // Retorna ['pt', 'en', 'es']
    } else {
      // Em ambiente web puro, você pode ler de um arquivo manifesto (ex: project.json) que o editor atualiza 
      // sempre que o usuário adiciona um novo idioma pelas ferramentas da engine.
    }
  } catch (e) {
    return ['en']; // Fallback seguro
  }
}
```

Ao renderizar a tela de opções do runner, você utiliza essa lista para preencher o seletor de idiomas dinamicamente.

---

### Passo 4: O Fallback em Ação

Graças à estrutura de prioridade implementada na etapa anterior, se o usuário criar um `en.json` para traduzir o jogo para inglês mas deixar chaves em branco (ou deletar chaves que ainda não traduziu), a função `t()` fará a busca em cascata:

1. Procura em `en.json`.
2. Não encontra $\rightarrow$ Busca no fallback do jogo: `pt.json` (onde está o texto original digitado pelo criador no editor).
3. Exibe o texto em português normalmente para o jogador, evitando telas vazias ou erros de sistema.

Essa abordagem resolve a sincronização de maneira limpa, centraliza todas as strings do projeto de forma profissional e dá total liberdade para o desenvolvedor gerenciar seus textos por dentro ou por fora da engine.