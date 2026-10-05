# AgendaPro Web — contexto do front-end

Front-end em Angular do AgendaPro. Consome a API em `../AgendaPro.Api`.
Leia também o `CLAUDE.md` da raiz (regras de trabalho com o Toni) e o `PLANO_FRONT_ANGULAR.md` (fases).
O código precisa ser **simples, legível e explicável por um júnior**: prefira o padrão oficial do Angular a soluções "espertas".

## Stack
- Angular 22 (standalone, **zoneless**: o projeto não tem `zone.js`, não adicionar)
- Angular Material 22 (tema Material 3 em `src/styles.scss`), SCSS
- TypeScript 6.0 em modo `strict`
- Testes com **Vitest** (executor padrão do `ng new`, não trocar)
- Node 24.15 / npm 11

## Comandos (PowerShell, a partir de `agendapro-web/`)
```
npm start                  # ng serve em http://localhost:4200, com o proxy
npx ng build               # build de produção em dist/
npx ng test --watch=false  # testes em modo não interativo
```

## Tamanho do pacote
- O aviso de tamanho inicial no `angular.json` é de **700 kB** (o padrão do `ng new`, 500 kB, serve para app vazio) e o erro é de 1 MB. Na F2 o pacote inicial ficou em 606 kB (140 kB transferidos): a maior parte é o runtime do Angular, que cresce conforme se usam mais recursos.
- Telas novas **sempre lazy** (`loadChildren` ou `loadComponent`). Se o aviso aparecer, conferir primeiro se algum import estático puxou uma tela para o pacote inicial.

## Proxy em desenvolvimento
- O front chama **sempre caminhos relativos** (`/api/...`, `/health`). Nenhuma URL da API fica no código.
- `proxy.conf.json` faz o `ng serve` encaminhar `/api` e `/health` para `http://localhost:5251`, a porta HTTP fixa da API em `AgendaPro.Api/Properties/launchSettings.json`.
- Por isso o navegador só fala com `localhost:4200` e não depende de CORS. Em produção (Docker), o nginx fará o mesmo papel.
- Para o proxy funcionar, a API precisa estar rodando: `docker start sqlserver-agenda` e `dotnet run --project AgendaPro.Api` na raiz.

## Convenções (siga sempre)

**Angular**
- **Componentes standalone** (sem NgModule), `ChangeDetectionStrategy.OnPush`, `inject()` para injeção de dependência.
- **Signals** (`signal`, `computed`) para o estado dos componentes; RxJS onde há fluxo assíncrono (HTTP, busca com debounce).
- Template com o **novo control flow** (`@if`, `@for`, `@switch`); `@for` sempre com `track`.
- **Reactive Forms tipados**. Nada de `any`.
- HTTP **somente em services** (`core/api`), nunca em componentes. Interfaces TypeScript espelham os DTOs da API.
- Estrutura: `src/app/core` (services de API, interceptors, models), `src/app/features/{profissionais,clientes,agendamentos,relatorios}` (rotas com lazy loading) e `src/app/shared`.
- UI com **Angular Material**, textos em português do Brasil, locale `pt-BR` (`LOCALE_ID`, `MAT_DATE_LOCALE`).
- Nomes de arquivo: componentes no estilo atual do CLI (`app.ts`, `inicio.ts`), sem o sufixo `.component`. Services e interceptors **mantêm o sufixo** (`profissionais.service.ts` / `ProfissionaisService`, `erro.interceptor.ts`): fica claro o que é cada arquivo e não confunde com o modelo `Profissional`.
- Parâmetros e `data` da rota chegam ao componente como `input()` (`withComponentInputBinding`).
- Ícones: fonte **Material Symbols** (`<mat-icon>nome_do_icone</mat-icon>`), já configurada em `app.config.ts`.
- Item novo de menu: acrescentar em `shared/menu.ts` (vale para o menu lateral e para os atalhos da página inicial).
- **Subscribe em componente:** sempre com `takeUntilDestroyed(this.destroyRef)`. Busca que pode ser repetida (filtro, "tentar de novo") guarda a `Subscription` e faz `unsubscribe()` antes da próxima, para a resposta atrasada não sobrescrever a nova.
- **Formulários:** `FormGroup` tipado com `nonNullable: true`; validação no front com os mesmos limites do backend (`shared/validadores.ts`, `Validators.maxLength`); erros do servidor entram no campo com `aplicarErrosDoServidor` (`shared/erros.ts`). Para limpar um formulário depois de enviar, usar `FormGroupDirective.resetForm(valores)` (e não `form.reset`), senão os campos limpos aparecem em vermelho.
- **Envio:** botão `[disabled]` enquanto envia (signal `enviando`) **e** um `if (enviando()) return` no método, porque `Enter` e clique rápido podem chegar antes de o botão desabilitar.
- **Confirmação** de ação destrutiva ou irreversível: `ConfirmacaoService.confirmar(...)` (`shared/`), nunca `window.confirm`. Nos testes de tela, trocar o service por um falso que responde `of(true)` ou `of(false)`.
- **Testes de tela:** services trocados por falsos (`useValue` com `vi.fn`), `MatSnackBar` falso para conferir a mensagem, e `criarApiError()` (`src/app/testing/api-error.ts`) para simular as falhas que o interceptor entregaria. Testar os estados carregando, vazio, erro e sucesso, e o botão desabilitado durante o envio.
- **Tabela no celular:** abaixo de 600 px a linha vira cartão por CSS (veja `profissionais-lista.scss`); só rolar na horizontal se as ações continuarem visíveis. O `<tbody>` nasce dentro do `mat-table`, então só `:host ::ng-deep` o alcança.
- Nomes do domínio em português (`Profissional`, `Agendamento`). Comentários em português, curtos, explicando o **porquê**.

**Contratos da API**
- Rotas, DTOs, status e filtros são lidos de `/openapi/v1.json` ou do código do backend. Nunca adivinhar campos.
- Se uma tela precisar de algo que a API não oferece, **não contornar no front**: propor o ajuste no backend e pedir aprovação.

**Erros (uma estratégia só, sem mensagem duplicada)**
- Um **HTTP interceptor** converte todo erro em um tipo `ApiError` (status, `title`, `detail` e erros por campo vindos do objeto `errors` do ProblemDetails).
- O interceptor **só mostra snackbar** para falha de conexão ("Não foi possível conectar à API") e para os demais erros 5xx. Falha de conexão é status 0 ou 502/504: com a API parada, o proxy (`ng serve` ou nginx) responde 502, não 0.
- Erros **4xx são tratados pela tela**, que tem contexto: 400 de validação vira erro no campo do formulário; 409 vira mensagem específica (e, na tela de agendar, recarrega a disponibilidade); 404 vira "não encontrado".
- As chaves de `errors` vêm em PascalCase (`Nome`); o interceptor já entrega em camelCase (`nome`) em `ApiError.errosPorCampo`, igual aos controles do formulário.
- As mensagens de validação da API vêm **em inglês** (`The Nome field is required.`): a tela valida antes de enviar e mostra o próprio texto em português.

**Datas e horas (fonte comum de bug)**
- A API trabalha com horário local da clínica, **sem fuso**.
- Data e hora: enviar `DataHoraInicio` como texto local (`2026-10-12T14:30:00`).
- Só data (`DateOnly`, ex.: parâmetro `data` da disponibilidade): enviar `2026-10-12`, montado a partir de `getFullYear()`, `getMonth()` e `getDate()`.
- **Proibido `toISOString()`** para montar datas enviadas à API: ele converte para UTC e, à noite no Brasil, troca o dia.
- **Proibido `new Date("2026-10-12")`** para ler uma data pura: o JavaScript interpreta como meia-noite UTC, e no Brasil vira o dia anterior. Fazer o parse manual.
- Centralizar isso em `shared/datas.ts`, com testes, incluindo um caso às 22h.
- Horas (`TimeOnly`) vêm e vão como `HH:mm:ss`; exibir como `HH:mm`. Dias da semana chegam em inglês (`Monday`): mapear para português na exibição.

**Outros**
- CPF: máscara no campo e validador (mesmo algoritmo do backend), escritos à mão, sem biblioteca.
- Não usar `localStorage` para dados de negócio.

## Critérios de pronto de toda tela
- Estados visíveis: **carregando**, **vazio** ("nenhum profissional cadastrado") e **erro**.
- Botões de envio ficam **desabilitados durante a requisição** (evita POST duplicado com duplo clique).
- Funciona no celular: tabelas com rolagem horizontal ou layout em cartões.
- Campos com label, foco visível e navegação por teclado.

## Dependências
- Somente as que o `ng new` e o `ng add` instalam, mais Angular Material/CDK. Nada extra sem justificar e pedir aprovação.
- Os testes acompanham cada fase: todo service, validador ou função utilitária sai com seus testes.
