# Plano do front-end do AgendaPro (Angular) — versão 2 (revisada)

Leia primeiro o `CLAUDE.md` da raiz e o `README.md`. O backend já está pronto e testado; este plano cria o front em `agenda-pro/agendapro-web/` (mesmo repositório). Execute **uma fase por vez**.

Decisões já tomadas pelo Toni:
- Escopo: telas essenciais (profissionais, clientes, agendar, lista de agendamentos). Relatório mensal é a **Fase F6, opcional**. Histórico de auditoria fica de fora.
- Mesmo repositório (monorepo), pasta `agendapro-web/`.
- Sem login/JWT (a API não tem autenticação ainda). Registrar no README como próximo passo.

## Regras de execução (valem para todas as fases)

1. Antes de começar a fase, diga em até 5 linhas o que vai fazer.
2. Código simples, legível e explicável por um júnior. Prefira o padrão oficial do Angular a soluções "espertas".
3. **Os testes acompanham cada fase**: todo service, validador ou função utilitária criado na fase sai com seus testes. A Fase F7 só consolida e cobre o que faltou.
4. Ao terminar, rode o build (`ng build`) e os testes em modo não interativo; corrija o que falhar.
5. Entregue um resumo em português simples com: arquivos criados/alterados; **por que** de cada decisão; como testar manualmente (passo a passo na tela); **2 perguntas de entrevista** sobre Angular/TypeScript relacionadas ao que foi feito, **sem a resposta**.
6. Faça um commit em português e **pare**. Só avance quando o Toni escrever "continuar".
7. Dependências npm: apenas as que `ng new` e `ng add` instalam, mais Angular Material/CDK. Nada extra sem justificar e pedir aprovação.
8. Os contratos da API (rotas, DTOs, status, filtros, paginação) devem ser lidos de `/openapi/v1.json` ou do código do backend. Nunca adivinhe campos.
9. Se uma tela precisar de algo que a API não oferece (ex.: nome do cliente na lista de agendamentos), **não contorne no front**: proponha o ajuste no backend e peça aprovação.
10. Antes de comandos destrutivos (apagar pastas, `git reset`, `npm` com `--force`), peça confirmação.

## Critérios de pronto de toda tela

- Estados visíveis: **carregando**, **vazio** ("nenhum profissional cadastrado") e **erro**.
- Botões de envio ficam **desabilitados durante a requisição** (evita POST duplicado com duplo clique).
- Funciona no celular: tabelas com rolagem horizontal ou layout em cartões.
- Campos com label, foco visível e navegação por teclado.

## Convenções do front (gravar em `agendapro-web/CLAUDE.md` na Fase F0)

**Angular**
- **Componentes standalone** (sem NgModule), `ChangeDetectionStrategy.OnPush`, `inject()` para injeção de dependência.
- Aceitar os padrões do `ng new` da versão atual (se o padrão for zoneless, manter assim e não adicionar `zone.js`).
- **Signals** (`signal`, `computed`) para o estado dos componentes; RxJS onde há fluxo assíncrono (HTTP, busca com debounce).
- Template com o **novo control flow** (`@if`, `@for`, `@switch`); `@for` sempre com `track`.
- **Reactive Forms tipados**. Nada de `any`; TypeScript `strict`.
- HTTP **somente em services** (`core/api`), nunca em componentes. Interfaces TypeScript espelham os DTOs da API.
- Estrutura: `src/app/core` (services de API, interceptors, models), `src/app/features/{profissionais,clientes,agendamentos,relatorios}` (rotas com lazy loading) e `src/app/shared`.
- UI com **Angular Material** (Material Design), textos em português do Brasil, locale `pt-BR` (`LOCALE_ID`, `MAT_DATE_LOCALE`).
- A URL da API nunca fica fixa nos componentes: o front chama caminhos relativos `/api/...`.

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
- Centralizar isso em um utilitário (`shared/datas.ts`) com testes, incluindo um caso às 22h.
- Horas (`TimeOnly`) vêm e vão como `HH:mm:ss`; exibir como `HH:mm`. Dias da semana chegam em inglês (`Monday`): mapear para português na exibição.

**Outros**
- CPF: máscara no campo e validador (mesmo algoritmo do backend), escritos à mão, sem biblioteca.
- Não usar `localStorage` para dados de negócio.

---

## Fase F0 — Preparação

- Conferir `node --version` e `npm --version`. O Angular 22 exige Node `^22.22.0`, `^24.13.1` ou `^26` e TypeScript 6.0.x (confirmar em `angular.dev/reference/versions`; se a versão estável do CLI já for outra, conferir a tabela dela). Se o Node não servir, parar e avisar o Toni.
- Criar o projeto na raiz da solução: `ng new agendapro-web` com SCSS, roteamento, **sem SSR** e com `--skip-git` (já estamos dentro de um repositório).
- `ng add @angular/material` (tema Material 3, tipografia e animações).
- Criar `agendapro-web/CLAUDE.md` com as convenções acima.
- **Decisão a confirmar com o Toni:** a porta da API em desenvolvimento é sorteada. Propor fixar a porta HTTP no `launchSettings.json` da API (ex.: 5100) e criar `proxy.conf.json` no `ng serve` encaminhando **`/api` e `/health`** para ela. Assim o front chama sempre caminhos relativos, sem CORS e sem URL fixa; em produção o nginx fará o mesmo papel. Só aplicar depois da confirmação, e então atualizar a nota sobre portas no `CLAUDE.md` da raiz.
- Rodar a API (`dotnet run`, com o container `sqlserver-agenda` de pé) e o `ng serve` (porta 4200), e provar a comunicação pelo proxy com uma chamada a `/health` e a `/api/profissionais`.
- Conferir que `node_modules/`, `dist/` e `.angular/` estão ignorados no Git.

## Fase F1 — Estrutura, navegação e base técnica

- Layout com toolbar e menu lateral (Profissionais, Clientes, Agendar, Agendamentos) usando Material, responsivo (menu vira "hambúrguer" no celular).
- Rotas com lazy loading por feature e uma página inicial simples.
- `core/api`: services por recurso, começando por profissionais.
- Interceptor de erros com o tipo `ApiError`, conforme a estratégia acima, com testes.
- Utilitário de datas (`shared/datas.ts`) com testes, incluindo os casos de fuso.
- Locale `pt-BR` configurado (datas, `MAT_DATE_LOCALE`, `provideNativeDateAdapter`).

## Fase F2 — Profissionais

- Listagem em `mat-table` com filtros por especialidade e ativo.
- Cadastro e edição com formulário reativo tipado e validações iguais às do backend (nome até 100, especialidade até 80). Erros 400 do servidor aparecem no campo certo.
- Ativar/desativar (PATCH) com feedback.
- Gestão de **horários de trabalho** do profissional: listar por dia da semana, adicionar (validando fim > início também no front) e remover com confirmação. Mostrar a mensagem do backend quando houver sobreposição (409).

## Fase F3 — Clientes

- Listagem com busca por nome (**debounce** com RxJS, cancelando a busca anterior) e CPF mascarado como a API devolve.
- Cadastro com máscara e validador de CPF.
- Edição: só nome e telefone; **CPF aparece somente leitura** (a API não permite alterá-lo).
- CPF duplicado (409): mostrar o erro no próprio campo do formulário.

## Fase F4 — Agendar (tela principal)

Fluxo em uma tela (ou `mat-stepper`):
1. escolher profissional (apenas ativos);
2. escolher data (datepicker, sem datas passadas) e duração (opções dentro do limite da API, ex.: 30, 45, 60 minutos);
3. buscar `/disponibilidade` e mostrar os horários livres como botões/chips;
4. escolher cliente (autocomplete pela busca da Fase F3);
5. confirmar → POST em `/api/agendamentos`, com o botão desabilitado durante o envio.

Tratar: sucesso (mensagem e limpar seleção), **409 de conflito** (avisar que o horário acabou de ser ocupado e **recarregar** a disponibilidade), 400 de regra de negócio (mostrar o `detail`). Estados de carregamento e "sem horários livres neste dia" visíveis.

Testes: o componente no fluxo feliz e no 409 (com services simulados), e a montagem dos parâmetros de data enviados à API.

## Fase F5 — Lista de agendamentos

- Antes de começar, conferir o DTO de agendamento: se ele não trouxer **nome do profissional e do cliente**, não fazer uma chamada por linha (problema N+1). Propor ao Toni incluir os nomes no DTO do backend.
- Conferir se a API pagina a lista. A tela abre **filtrada pela data de hoje**; se não houver paginação e a lista puder crescer, propor paginação no backend.
- Filtros por profissional, data e status.
- Ações **cancelar** e **concluir**, cada uma com diálogo de confirmação (`MatDialog`); atualizar a linha após a ação.
- Status com ícone e texto (não depender só de cor).

## Fase F6 — Relatório mensal (opcional)

- Tela com ano e mês e uma tabela com o resultado de `/api/relatorios/atendimentos` (agendados, concluídos, cancelados e taxa de cancelamento por profissional).
- Só fazer se o Toni pedir.

## Fase F7 — Consolidação de testes e qualidade

- Cobrir o que faltou nas fases anteriores: services com `HttpTestingController` (rota, método, parâmetros e erro), validador de CPF, utilitário de datas.
- Usar o executor de testes **padrão do projeto gerado** (não trocar). Rodar em modo não interativo.
- `ng lint`, se estiver configurado.
- Revisar os critérios de pronto em todas as telas.

## Fase F8 — Docker e CI

- `agendapro-web/Dockerfile` multi-stage (build do Angular, depois nginx servindo os arquivos estáticos e encaminhando `/api` e `/health` para o serviço `api` na porta 8080), com `.dockerignore`. Configurar o nginx para devolver `index.html` em rotas do Angular (senão, atualizar a página em `/clientes` dá 404).
- Adicionar o serviço `web` ao `docker-compose.yml` da raiz.
- Estender o workflow do GitHub Actions com um job do front: `npm ci`, build de produção e testes em modo não interativo.
- Testar: `docker compose up --build` e usar o sistema completo pelo navegador, incluindo atualizar a página numa rota interna.

## Fase F9 — Documentação

- Atualizar o `README.md` da raiz: arquitetura com o front, como rodar (Docker e local), estrutura do monorepo, ausência de autenticação como próximo passo. Deixar marcado onde entram os **prints/GIF** das telas (o Toni tira e insere).
- `docs/PERGUNTAS_ENTREVISTA_FRONT.md`: consolidar as perguntas das fases, com respostas curtas **escritas pelo Toni**.
- Revisão final: subir tudo do zero, testes verdes, `git status` limpo e lista do que ficou pendente.
