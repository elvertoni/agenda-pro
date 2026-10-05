# Plano para finalizar o AgendaPro (backend)

Leia primeiro o `CLAUDE.md`. Este plano é executado **uma fase por vez**. O front-end Angular fica fora deste plano.

## Regras de execução (valem para todas as fases)

1. Antes de começar a fase, diga em até 5 linhas o que vai fazer.
2. Implemente seguindo as convenções do `CLAUDE.md`. Código simples e legível vale mais que código "esperto".
3. Ao terminar, rode `dotnet build` e `dotnet test` e corrija o que falhar.
4. Entregue um resumo em português simples com:
   - arquivos criados/alterados;
   - **por que** cada decisão foi tomada (o raciocínio, não só o "o quê");
   - como testar manualmente (exemplos para o Scalar e para o PowerShell com `Invoke-RestMethod`, lembrando de usar a porta do `Now listening on`);
   - **2 perguntas de entrevista** sobre o que foi construído, **sem a resposta**: o Toni responde e você corrige.
5. Faça um commit em português e **pare**. Só avance quando o Toni escrever "continuar".
6. Diante de ambiguidade ou de algo que contrarie o `CLAUDE.md`, pergunte antes de decidir.

---

## Fase 0 — Preparação

- Conferir `dotnet --version` (10.x), o container `sqlserver-agenda` em `Up` (`docker ps`) e `dotnet build` passando.
- Criar o projeto `AgendaPro.Tests` (xUnit), referenciar `AgendaPro.Api`, adicionar à solução, com um teste simples passando.
- Registrar `TimeProvider.System` no `Program.cs`.
- Tratamento global de erros: `AddProblemDetails()` + `UseExceptionHandler()`, de modo que exceção não tratada volte como ProblemDetails 500 sem vazar detalhes (stack trace só em Development).
- Conferir se `bin/`, `obj/` e `.env` estão no `.gitignore`.

## Fase 1 — Clientes

- `ClientesController` em `api/clientes`: POST, GET (lista, com filtro opcional `?nome=`), GET `{id}`, PUT `{id}` (nome e telefone; o CPF não muda).
- DTOs com validação: nome obrigatório (até 100), telefone opcional (até 20).
- `CpfValidador` (classe estática em `Validation/`): remove pontuação, exige 11 dígitos, rejeita sequências repetidas (111.111.111-11) e confere os dois dígitos verificadores. Gravar o CPF **só com números**.
- CPF duplicado → **409 Conflict** (checar antes de inserir e, por segurança, tratar a `DbUpdateException` do índice único).
- Testes unitários do `CpfValidador`: válidos, inválidos, com máscara e sequências repetidas.

## Fase 2 — Completar Profissionais e Horários

- Profissionais: PUT `{id}` (nome e especialidade), PATCH `{id}/ativo` com corpo `{ "ativo": false }`, filtros `?especialidade=` e `?ativo=` na lista.
- Horários: DELETE `api/profissionais/{id}/horarios/{horarioId}` e bloqueio (409) de horário que **se sobreponha** a outro do mesmo profissional no mesmo dia.
- Extrair a verificação de sobreposição de intervalos para uma **função pura** (será reutilizada nos agendamentos) e testá-la.

## Fase 3 — Agendamentos (o coração do projeto)

Endpoints: POST `api/agendamentos`, GET `api/agendamentos/{id}`, GET `api/agendamentos?profissionalId=&data=&status=`, PATCH `{id}/cancelar`, PATCH `{id}/concluir`.

Criação recebe: `ProfissionalId`, `ClienteId`, `DataHoraInicio`, `DuracaoMinutos` (padrão 30, entre 10 e 240).

Regras (cada violação vira ProblemDetails com título claro):
1. Profissional e cliente existem (404 se não); profissional inativo → 400.
2. Não agendar no passado (comparar com o `TimeProvider`) → 400.
3. Dentro do expediente: existe `HorarioTrabalho` do profissional no `DayOfWeek` da data, com `HoraInicio <= início` e `fim <= HoraFim`; o agendamento não pode atravessar a meia-noite → 400.
4. Sem conflito: nenhum outro agendamento **não cancelado** do mesmo profissional pode se sobrepor, onde sobrepor é `novoInicio < existenteFim && novoFim > existenteInicio`. Encostar não é conflito (10:00–10:30 e 10:30–11:00 são válidos) → 409.
5. Cancelar e concluir só valem para agendamentos `Agendado`; caso contrário → 409.

Implementação:
- Colocar as regras em `Services/AgendamentoService.cs` (controller fino), com as funções de intervalo em uma classe estática pura.
- A consulta de conflito deve **usar o índice** `(ProfissionalId, DataHoraInicio)`: filtrar por profissional e pelo dia. Como `DataHoraFim` não é mapeada, usar `a.DataHoraInicio.AddMinutes(a.DuracaoMinutos)` na consulta ou comparar em memória o resultado do dia.
- **Antes de implementar, explique o algoritmo de conflito em até 5 linhas** e espere o Toni confirmar.
- **TDD:** escreva primeiro os testes das funções puras (sobreposição, encostar, dentro do expediente, passado), mostre-os falhando e só depois implemente.
- Testes de integração com `WebApplicationFactory<Program>` (expor com `public partial class Program { }`) para o fluxo principal: criar profissional, horário e cliente; agendar (201); repetir o mesmo horário (409); fora do expediente (400); passado (400); cancelar e reagendar no mesmo horário (201). Usar um banco separado `AgendaPro_Tests` no mesmo container, limpo entre execuções. A connection string de teste também não pode ficar em arquivo versionado.
- **Concorrência:** duas requisições simultâneas podem passar pela checagem ao mesmo tempo. Explique isso ao Toni e documente a limitação. Só implemente a proteção (transação `Serializable`) se ele pedir.

## Fase 4 — Disponibilidade

- GET `api/profissionais/{id}/disponibilidade?data=2026-10-12&duracaoMinutos=30` devolve os horários livres.
- Algoritmo: gerar blocos consecutivos de `duracaoMinutos` dentro de cada intervalo de expediente do dia e remover os que conflitam com agendamentos não cancelados; se a data for hoje, manter só horários futuros.
- `data` como `DateOnly`. Reaproveitar as funções puras da Fase 3 e testar.

## Fase 5 — SQL Server de verdade (procedure e trigger)

Criar via migration (`migrationBuilder.Sql`), com `Down` que remove tudo:
- Tabela `AuditoriaAgendamentos` (Id, AgendamentoId, StatusAnterior, StatusNovo, AlteradoEm, UsuarioBanco com `SUSER_SNAME()`).
- Trigger `trg_Agendamentos_Auditoria` AFTER UPDATE em `Agendamentos`: quando o `Status` mudar, inserir na auditoria usando `inserted` e `deleted`, de forma **set-based** (sem cursor), tratando várias linhas.
- Stored procedure `usp_RelatorioAtendimentosPorProfissional @Ano INT, @Mes INT`: por profissional, total de agendados, concluídos, cancelados e taxa de cancelamento no mês.

Na API:
- GET `api/relatorios/atendimentos?ano=&mes=` chamando a procedure com `db.Database.SqlQuery<T>`, sempre com parâmetros (nunca concatenar string).
- GET `api/agendamentos/{id}/auditoria`.

Explique ao Toni por que a auditoria está no banco (trigger), quando isso é boa ideia e quando não é. Testar: cancelar um agendamento e conferir a linha de auditoria; chamar o relatório.

## Fase 6 — Performance (prova de que o índice funciona)

- Criar um banco separado `AgendaPro_Perf` (aplicar as migrations nele) para não poluir os dados de desenvolvimento.
- Script `docs/sql/seed-performance.sql` que gera cerca de 200 mil agendamentos de forma set-based.
- Medir a consulta de conflito **com** e **sem** o índice composto, usando `SET STATISTICS IO ON; SET STATISTICS TIME ON;` e o plano de execução (Index Seek vs Scan).
- Testar também o índice com `INCLUDE (DuracaoMinutos, Status)` para evitar key lookup, medindo o ganho.
- Registrar em `docs/PERFORMANCE.md`: consulta, plano antes e depois, leituras lógicas e tempo. **Somente números realmente medidos**, sem estimativas.
- Explicar ao Toni: Seek vs Scan, por que a ordem das colunas do índice importa, o que é covering index.

## Fase 7 — Robustez

- CORS restrito a `http://localhost:4200` (política nomeada, origem configurável).
- Health check `/health` incluindo o banco (pacote permitido: `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`).
- Logs estruturados com `ILogger` nas operações de agendamento (criado, cancelado, conflito rejeitado), sem dados pessoais (nunca logar CPF).
- CPF mascarado nas listagens (ex.: `***.456.789-**`).
- Revisão: nenhum endpoint devolve entidade; todos os erros saem como ProblemDetails.

## Fase 8 — Docker

- `AgendaPro.Api/Dockerfile` multi-stage (imagens `sdk` e `aspnet` do .NET 10; confirmar as tags atuais na documentação oficial), usuário não-root e `.dockerignore`.
- `docker-compose.yml` com `db` (SQL Server 2022, volume nomeado, healthcheck; verificar o caminho correto do `sqlcmd` na imagem) e `api` (depende do `db` saudável, `ConnectionStrings__Default` vinda do `.env`).
- Usar porta de host diferente para o SQL do compose (ex.: 1434), pois o container `sqlserver-agenda` já ocupa a 1433.
- `.env.example` sem segredos reais; `.env` no `.gitignore`.
- Migrations: comando documentado para aplicar (`dotnet ef database update` contra o container, ou um serviço `migrator` com `migrations bundle`). `Database.Migrate()` automático apenas em Development. Explicar a escolha ao Toni.
- Testar: `docker compose up --build`, chamar `/health` e a API.

## Fase 9 — CI (GitHub Actions)

- `.github/workflows/ci.yml` em push e pull request na `main`: `actions/setup-dotnet` com `10.0.x`, restore, build, test.
- Serviço SQL Server 2022 no workflow para os testes de integração, com senha apenas do ambiente do CI (descartável).
- Badge do build no README.

## Fase 10 — README e documentação

- `README.md` em português: visão geral, tecnologias, diagramas Mermaid (arquitetura e modelo de dados), como rodar (Docker e local), tabela de endpoints, regras de negócio, decisões técnicas (DTOs, async, índices, trigger e procedure, e por quê), limitação de concorrência, link para `docs/PERFORMANCE.md`, próximos passos (front Angular).
- `docs/PERGUNTAS_ENTREVISTA.md`: consolidar as perguntas de cada fase, com respostas curtas **escritas pelo Toni** (deixar em branco as que ele não respondeu).
- Revisão final: subir tudo do zero com `docker compose up`, `dotnet test` verde, `git status` limpo e lista do que ficou pendente.
