# AgendaPro — contexto do projeto

API de agendamento de profissionais, feita como portfólio para a vaga de Desenvolvedor Full Stack Júnior (TCE-PR, C#/.NET).
O dono do projeto (Toni) está relembrando .NET para entrevistas técnicas: o código precisa ser **simples, legível e explicável por ele**. Clareza vale mais que sofisticação.

## Stack
- .NET 10 (LTS), ASP.NET Core Web API com **controllers**
- Entity Framework Core 10 + SQL Server 2022 (container Docker `sqlserver-agenda`, porta 1433)
- OpenAPI nativo + Scalar em `/scalar/v1` (somente em Development)
- Windows + PowerShell 7

## Estrutura
```
agenda-pro/                  (solução AgendaPro.sln)
├── AgendaPro.Api/           Controllers, Data, Dtos, Models, Migrations
└── agendapro-web/           Front-end Angular (convenções em agendapro-web/CLAUDE.md, fases em PLANO_FRONT_ANGULAR.md)
```

## Estado atual (pronto e testado manualmente)
- Models: `Profissional`, `HorarioTrabalho`, `Cliente`, `Agendamento` (+ enum `StatusAgendamento`)
- `Data/AppDbContext.cs` com índices: `Cliente.Cpf` único; `Agendamento (ProfissionalId, DataHoraInicio)` composto
- Migration `Inicial` aplicada no banco `AgendaPro`
- `ProfissionaisController`: GET lista, GET `{id}`, POST
- `HorariosController` (rota aninhada `api/profissionais/{profissionalId}/horarios`): GET, POST (valida fim > início)
- `JsonStringEnumConverter` ativo (enums como texto no JSON); `DayOfWeek` fica como inteiro no banco

## Convenções (siga sempre)
- Entrada e saída da API são **DTOs `record`** em `Dtos/`. Nunca expor entidades.
- Tudo assíncrono (`async/await`, `ToListAsync`, `SaveChangesAsync`). Leituras com `AsNoTracking()` e `Select` direto para o DTO.
- Rotas REST no plural; o verbo HTTP define a ação (nada de `/listar` ou `/cadastrar`).
- Injeção por construtor primário: `public class XController(AppDbContext db) : ControllerBase`.
- Erro de regra de negócio: `Problem(...)` (ProblemDetails) com o status certo (400, 404, 409).
- Nomes do domínio em português (`Profissional`, `Agendamento`). Comentários em português, curtos, explicando o **porquê**.
- `DataHoraFim` em `Agendamento` é propriedade calculada **não mapeada**: não usar em consultas LINQ para SQL.
- Datas de agendamento: horário local da clínica (`DateTime` sem fuso). `CriadoEm` em UTC. Para "agora", usar `TimeProvider` injetado (testável).
- Mensagens de commit em português, curtas.

## Segredos
- A connection string (`ConnectionStrings:Default`) está nos **user-secrets**. NUNCA imprimir, copiar para arquivo versionado ou commitar a senha.
- Em Docker, usar a variável `ConnectionStrings__Default` via `.env` (no `.gitignore`) e manter um `.env.example` sem segredos reais.

## Comandos (PowerShell, a partir da pasta da solução)
```
dotnet build
dotnet run --project AgendaPro.Api
dotnet test
dotnet ef migrations add <Nome> --project AgendaPro.Api --startup-project AgendaPro.Api
dotnet ef database update --project AgendaPro.Api --startup-project AgendaPro.Api
docker start sqlserver-agenda
```
Neste projeto a API escuta em `http://localhost:5251`, porta fixa em `AgendaPro.Api/Properties/launchSettings.json`. O proxy do front (`agendapro-web/proxy.conf.json`) depende dela: se mudar uma, mude a outra. Em outros projetos a porta é outra: confira no `Now listening on`.

## Regras de trabalho com o Toni
- Trabalhe **uma fase por vez**, conforme `PLANO_CLAUDE_CODE.md`. Ao fim de cada fase: build + testes, resumo em português simples explicando o **porquê** das decisões, 2 perguntas de entrevista, commit, e **pare** aguardando "continuar".
- Antes de comandos destrutivos (drop database, `docker rm`, apagar arquivos, reset/force no Git), peça confirmação.
- Não adicione pacotes NuGet fora dos listados no plano sem justificar e pedir aprovação. Não usar FluentAssertions (versões recentes têm licença comercial): use as asserções do xUnit.
- Não altere convenções nem arquivos já prontos sem avisar o motivo.
- Responda sempre em português do Brasil.
