# Plano do front-end Angular (AgendaPro)

Leia primeiro o `CLAUDE.md` e o `README.md`. O backend (Fases 0 a 10 do `PLANO_CLAUDE_CODE.md`) está pronto e no GitHub. Este plano é executado **uma fase por vez**, como o do backend.

## Escopo (decidido pelo Toni)

**Entra:** Profissionais, Clientes, Agendar e Lista de agendamentos. Relatório mensal é a **Fase F6, opcional**.
**Fica de fora:** histórico de auditoria, login/JWT (a API não tem autenticação), paginação.
**Por quê:** com a entrevista chegando, poucas telas bem feitas e explicáveis valem mais que muitas pela metade.

**Repositório:** a mesma pasta, em `agenda-pro/agendapro-web/`. Um README, um CI e um `docker-compose.yml` que sobe tudo com um comando.

## Decisões técnicas (revise se discordar)

| Tema | Decisão | Por quê |
|---|---|---|
| Versão | **Angular 22** (CLI 22.2.1), componentes *standalone*, padrões do `ng new` | É a atual; Node 24.15 atende (`^24.15.0`). Sem NgModules. |
| Formulários | **Reactive Forms** | É o que mais se pergunta em entrevista; Signal Forms é novo demais. |
| Estado | `signal` para estado de tela; `HttpClient` + `async/await` (via `firstValueFrom`) ou `rxResource`, o que for mais legível | Poucas telas: sem NgRx. |
| Visual | **CSS próprio** (variáveis CSS, sem biblioteca de UI) | Zero dependência a explicar; layout simples e limpo. |
| Testes | **Vitest** (padrão do CLI) + `HttpTestingController` | Serviços e a lógica das telas principais (agendar, lista). Sem E2E. |
| Chamadas à API | URL **relativa** (`/api/...`). Dev: `proxy.conf.json` do `ng serve` aponta para a API. Docker: nginx do front faz proxy de `/api` para `api:8080` | O navegador só fala com uma origem: não depende de CORS, e a mesma build vale em dev e em Docker. O CORS da API continua configurado. |
| Datas | O agendamento é `DateTime` **sem fuso** (horário da clínica). Enviar string `yyyy-MM-ddTHH:mm:ss`, **nunca** `toISOString()` (converteria para UTC e deslocaria o horário) | Mesma regra do backend. |
| Erros | Um interceptor lê o **ProblemDetails** (400/404/409/500) e as telas mostram o `title`/`detail` da API | Aproveita o padrão que o backend já entrega. |
| Pacotes npm | Só os do `ng new` (Angular, RxJS, TypeScript, Vitest, jsdom). **Nada além disso sem justificar e pedir aprovação** | Mesma regra dos pacotes NuGet. |

## Regras de execução (valem para todas as fases)

1. Antes de começar a fase, diga em até 5 linhas o que vai fazer.
2. Código simples e legível; nomes do domínio em português (`Profissional`, `Agendamento`), comentários em português, curtos, explicando o **porquê**.
3. Ao terminar, rode `ng build` e `ng test --no-watch` (em `agendapro-web/`) e corrija o que falhar. Se mexeu na API, rode também `dotnet build` e `dotnet test`.
4. Teste de verdade no navegador (API + `ng serve`) e relate o que viu, com a porta mostrada no terminal.
5. Entregue um resumo em português simples com: arquivos criados/alterados, **por que** de cada decisão, como testar manualmente, e **2 perguntas de entrevista com resposta** (rascunho para o Toni refazer com as próprias palavras).
6. Registre a fase no guia do Notion (nova "Etapa 5 — Front-end") e consolide as perguntas em `docs/PERGUNTAS_ENTREVISTA.md`.
7. Faça um commit em português e **pare**. Só avance quando o Toni escrever "continuar". **Push só com autorização explícita.**
8. Diante de ambiguidade ou de algo que contrarie o `CLAUDE.md`, pergunte antes de decidir.

---

## Fase F0 — Preparação e projeto

- Conferir `node -v` (precisa ser `^22.22.3`, `^24.15.0` ou `>=26`), `docker ps` e `dotnet build` passando.
- Criar o projeto com `npx @angular/cli@22 new agendapro-web` (routing, CSS, sem SSR) dentro de `agenda-pro/`. Remover o conteúdo de exemplo da tela inicial.
- Conferir o `.gitignore` (`node_modules/`, `dist/`, `.angular/`) e que `ng build` e `ng test --no-watch` passam no projeto vazio.
- Subir a API e confirmar o proxy do `ng serve` (`/api/profissionais` respondendo pelo `:4200`).
- Acrescentar uma seção "Front-end" ao `CLAUDE.md` (estrutura, comandos, convenções acima), **avisando** que está alterando o arquivo.

## Fase F1 — Base: layout, rotas, modelos e acesso à API

- Layout com cabeçalho e navegação (Profissionais, Clientes, Agendar, Agendamentos) e rotas com *lazy loading* por tela.
- **Modelos TypeScript** espelhando os DTOs da API (`interface`), em um único lugar.
- Um serviço por recurso (`ProfissionaisService`, `ClientesService`, `AgendamentosService`) com `HttpClient` tipado.
- Interceptor de erro que extrai o ProblemDetails; componente reutilizável de mensagem de erro, de "carregando" e de lista vazia.
- Testes dos serviços (URL, método, corpo) com `HttpTestingController`.

## Fase F2 — Profissionais

- Lista com filtros (especialidade, ativo), cadastro e edição (nome e especialidade), ativar/inativar.
- **Expediente** do profissional (listar, adicionar e remover blocos de horário): sem ele a tela de agendar não tem o que mostrar. Mostrar o 409 de horário sobreposto e o 400 de fim ≤ início.
- Validação no formulário (campos obrigatórios, tamanhos iguais aos do backend) **e** exibição do erro devolvido pela API.

## Fase F3 — Clientes

- Lista com busca por nome, cadastro e edição (nome e telefone; o CPF não muda depois de criado).
- CPF digitado com ou sem pontuação; mostrar o 400 de CPF inválido e o 409 de CPF duplicado vindos da API. O CPF só aparece **mascarado** (como a API devolve).

## Fase F4 — Agendar (a tela principal)

- Passos na mesma tela: escolher profissional ativo → data e duração → **horários livres** (`GET /disponibilidade`) → escolher o horário → escolher o cliente → confirmar (`POST /api/agendamentos`).
- Tratar: profissional inativo (400), horário que ficou ocupado entre a consulta e a confirmação (409, recarregar os horários), 404.
- Datas enviadas como string local, sem `toISOString()`.
- Testes da lógica da tela (montagem do corpo do POST, tratamento do 409).

## Fase F5 — Lista de agendamentos

- Lista com filtros (profissional, data, status), nome do profissional e do cliente, status em destaque.
- Ações **Cancelar** e **Concluir** (só para `Agendado`), com confirmação, atualizando a linha sem recarregar a página; mostrar o 409 se o status mudou.
- Testes da lista e das ações.

## Fase F6 — Relatório mensal (OPCIONAL)

- Tela com ano e mês chamando `GET /api/relatorios/atendimentos`, em tabela. Só fazer se o Toni pedir.

## Fase F7 — Docker, CI e documentação

- `agendapro-web/Dockerfile` multi-stage: `node` compila (`ng build`), `nginx-unprivileged` serve os arquivos e faz proxy de `/api` para `api:8080`, com *fallback* de rota para o `index.html`. `.dockerignore` próprio.
- `docker-compose.yml`: serviço `web` (porta 4200 no PC). **`docker compose up --build` sobe banco, migrations, API e front.** Testar do zero.
- CI (`ci.yml`): job novo `frontend` com `setup-node` (24), `npm ci`, `ng test --no-watch` e `ng build`; job do `docker-build` passa a construir também a imagem do front. **Aproveitar para subir as versões das actions** (o run atual avisa que `checkout@v4` e `setup-dotnet@v4` usam Node 20, obsoleto).
- `README.md`: seção do front (telas, como rodar em dev e em Docker, decisões), diagrama de arquitetura atualizado, estrutura de pastas. `docs/PERGUNTAS_ENTREVISTA.md` com as perguntas do front.
- Revisão final: subir tudo do zero, testes verdes (`dotnet test` e `ng test`), `git status` limpo e lista do que ficou pendente.
