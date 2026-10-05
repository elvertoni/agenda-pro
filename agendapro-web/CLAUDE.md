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
- Nomes de arquivo no estilo atual do CLI (`app.ts`, `app.html`), sem o sufixo `.component`.
- Nomes do domínio em português (`Profissional`, `Agendamento`). Comentários em português, curtos, explicando o **porquê**.

**Contratos da API**
- Rotas, DTOs, status e filtros são lidos de `/openapi/v1.json` ou do código do backend. Nunca adivinhar campos.
- Se uma tela precisar de algo que a API não oferece, **não contornar no front**: propor o ajuste no backend e pedir aprovação.

**Erros (uma estratégia só, sem mensagem duplicada)**
- Um **HTTP interceptor** converte todo erro em um tipo `ApiError` (status, `title`, `detail` e erros por campo vindos do objeto `errors` do ProblemDetails).
- O interceptor **só mostra snackbar** para falha de conexão (status 0: "Não foi possível conectar à API") e erros 5xx.
- Erros **4xx são tratados pela tela**, que tem contexto: 400 de validação vira erro no campo do formulário; 409 vira mensagem específica (e, na tela de agendar, recarrega a disponibilidade); 404 vira "não encontrado".
- As chaves de `errors` vêm em PascalCase (`Nome`); mapear para os controles do formulário em camelCase (`nome`).

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
