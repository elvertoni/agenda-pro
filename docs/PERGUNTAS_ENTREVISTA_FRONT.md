# Perguntas de entrevista — front-end (Angular)

Perguntas de entrevista de cada fase do front do AgendaPro, com respostas. Servem para estudar: **tente responder em voz alta antes de ler a resposta**.

> As respostas são um **rascunho escrito pelo Claude**. Refaça com as suas próprias palavras: na entrevista vale o que você consegue explicar sozinho. As perguntas do backend estão em [PERGUNTAS_ENTREVISTA.md](PERGUNTAS_ENTREVISTA.md).

## Fase F0 — Preparação

### 1. O que é um componente standalone e o que ele substitui em relação ao `NgModule`?

Um componente standalone **declara as próprias dependências**: tudo que o template usa (outros componentes, diretivas, pipes) entra no `imports` do próprio `@Component`. No projeto, o `app.ts` tem `imports: [RouterOutlet]` porque o template usa `<router-outlet>`.

Antes, todo componente precisava ser declarado em **exatamente um** `NgModule` (`declarations`), e era o módulo que importava o que os templates precisavam. Para saber de onde vinha uma diretiva, era preciso abrir outro arquivo. Com standalone, a resposta está no próprio componente.

O que muda na prática:

- A aplicação sobe com `bootstrapApplication(App, appConfig)` em vez de `AppModule`.
- A configuração global vira funções `provide...` em `app.config.ts` (`provideRouter(routes)`, `provideHttpClient()`), no lugar de `RouterModule.forRoot()` e `HttpClientModule`.
- O lazy loading aponta direto para o componente ou para um arquivo de rotas (`loadComponent`, `loadChildren`), sem um módulo por feature.

Standalone é o padrão desde o Angular 19: não é mais preciso escrever `standalone: true`.

### 2. Por que usar proxy no `ng serve` em vez de chamar `http://localhost:5251` direto? O que é CORS e quando ele entra em ação?

**Origem** é o trio protocolo + host + porta. `http://localhost:4200` (front) e `http://localhost:5251` (API) são origens **diferentes**, mesmo sendo a mesma máquina.

**CORS** é uma regra do **navegador**: o JavaScript de uma origem só pode ler a resposta de outra origem se o servidor autorizar com o cabeçalho `Access-Control-Allow-Origin`. Em requisições que alteram dados ou enviam JSON (POST, PUT, PATCH, DELETE), o navegador manda antes um `OPTIONS` de verificação (*preflight*). Como quem aplica a regra é o navegador, `curl` e Postman não são afetados: CORS **não protege a API** contra chamadas diretas, só impede que um site qualquer use o navegador do usuário para ler dados de outro site.

Com o proxy, o navegador chama `http://localhost:4200/api/...`, a mesma origem da página, e o servidor de desenvolvimento repassa para a porta 5251 **de servidor para servidor**. Para o navegador não existe outra origem, então o CORS nem entra em ação.

Por que escolhi o proxy, mesmo com o CORS da API já liberando a porta 4200:

- **Nenhuma URL da API no código.** O front usa caminhos relativos (`/api/profissionais`) e funciona igual em qualquer ambiente, sem arquivo de configuração por ambiente.
- **Desenvolvimento igual à produção.** No Docker, o nginx fará o mesmo papel do proxy.
- **Sem preflight** a cada requisição de escrita.

O proxy do `ng serve` existe **só em desenvolvimento**: o build de produção são arquivos estáticos, e quem encaminha o `/api` passa a ser o nginx.
