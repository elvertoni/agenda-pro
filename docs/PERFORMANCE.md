# Performance: prova de que o índice funciona

Este documento mede a consulta mais importante do projeto, a **checagem de conflito** do `AgendamentoService`
(os agendamentos de um profissional em um dia), com e sem índice. **Todos os números abaixo foram medidos** nas
execuções descritas aqui; o que é explicação de conceito (sem medição) está marcado como tal.

## Ambiente e massa de dados

| Item | Valor |
|---|---|
| Banco | `AgendaPro_Perf` (separado do de desenvolvimento e do de testes), criado aplicando as migrations |
| SQL Server | 2022 (RTM-CU27, 16.0.4295.3), container Docker `sqlserver-agenda` (Linux) |
| Massa | 50 profissionais, 5.000 clientes, **200.000 agendamentos** (`docs/sql/seed-performance.sql`, gerada em 3,4 s) |
| Período | 06/01/2025 a 04/12/2026, só dias úteis, 8 horários de 30 min por dia (08:00 a 11:30) |
| Status | 120.000 Concluido, 40.000 Cancelado, 40.000 Agendado |
| Tabela `Agendamentos` | 1.913 páginas (índice clustered `PK_Agendamentos`) |

A massa é determinística: rodar o seed em um banco novo gera exatamente os mesmos dados.

## A consulta medida

É o SQL que o EF Core gera para o `AgendamentoService` (impresso com `ToQueryString()`), enviado com
`sp_executesql` e parâmetros tipados, como a aplicação faz:

```sql
SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status]
FROM [Agendamentos] AS [a]
WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays
```

Parâmetros: profissional 25, dia 10/03/2026. **Devolve 8 linhas** (de 200.000). Também foi medida uma versão **enxuta**
(só `DataHoraInicio`, `DuracaoMinutos` e `Status`), que é o que a regra de conflito realmente usa.

## Resultados

Leituras lógicas = páginas lidas da tabela `Agendamentos` (`SET STATISTICS IO ON`). É o indicador mais estável: foi
**idêntico nas 3 rodadas completas** do script. O tempo é a média de **300 execuções** (cache quente) em cada uma das
3 rodadas, medida com o relógio do SQL Server; os valores variam um pouco entre rodadas, por isso aparece a faixa.

| # | Cenário | Plano | Leituras lógicas | Tempo médio por execução |
|---|---|---|---|---|
| 1 | **Sem** índice composto, consulta completa | Clustered Index **Scan** | **1.913** | **17,8 a 18,9 ms** |
| 2 | Índice composto (estado das migrations), consulta completa | Index **Seek** + Key Lookup (8x) | **35** (quente) / 43 (cache frio) | **0,109 a 0,178 ms** |
| 3 | Índice composto, consulta enxuta | Index Seek + Key Lookup (8x) | 35 (quente) / 43 (cache frio) | 0,109 a 0,124 ms |
| 4 | Índice com `INCLUDE (DuracaoMinutos, Status)`, consulta enxuta | Index Seek, **sem** Key Lookup | **3** | 0,083 a 0,123 ms |
| 5 | Índice com `INCLUDE`, consulta completa (as 7 colunas) | Index Seek + Key Lookup (8x) | 43 (uma execução, logo após limpar o cache) | 0,109 a 0,152 ms |

O tempo inclui um custo fixo (chamar `sp_executesql` e gravar o resultado em tabela temporária), igual em todos os
cenários; serve para **comparar** os cenários, não como tempo absoluto da aplicação.

### O que os números mostram

- **O índice composto é o que importa.** Sem ele, o SQL Server lê a tabela inteira para achar 8 linhas: 1.913 leituras
  (todas as páginas da tabela) contra 35, ou seja, **cerca de 55 vezes menos leituras**. No tempo, de ~18 ms para ~0,1 ms,
  algo entre **100 e 170 vezes mais rápido** (razão calculada rodada a rodada: 106, 111 e 163).
- **O plano muda de Scan para Seek.** Sem o índice, o plano é um `Clustered Index Scan` com o filtro aplicado linha a
  linha. Com o índice composto, é um `Index Seek` que vai direto ao trecho `ProfissionalId = 25` e ao intervalo de datas.
- **O Key Lookup aparece com o índice simples.** O índice composto só tem `ProfissionalId`, `DataHoraInicio` e o `Id`
  (chave do clustered). Para devolver `DuracaoMinutos`, `Status` etc., o SQL Server busca cada uma das 8 linhas na tabela:
  no plano em texto isso aparece como um `Clustered Index Seek` executado 8 vezes sob um `Nested Loops`.
- **O `INCLUDE` elimina o Key Lookup, mas só para a consulta enxuta:** 35 → 3 leituras (91% a menos). Com a consulta
  completa do EF (que pede também `ClienteId` e `CriadoEm`), o Key Lookup volta e as leituras voltam a 43.
- **O ganho de tempo do `INCLUDE` é pequeno nesta massa:** de ~0,11 a ~0,12 ms para ~0,08 a ~0,12 ms por execução, dentro da
  variação entre rodadas. A consulta já devolve só 8 linhas, então 8 lookups custam pouco.

### Tamanho dos índices (`sys.dm_db_partition_stats`, páginas de 8 KB)

| Índice | Páginas |
|---|---|
| `PK_Agendamentos` (clustered, a própria tabela) | 1.913 |
| `IX_Agendamentos_ClienteId` | 698 |
| `IX_Agendamentos_ProfissionalId_DataHoraInicio`, criado pela migration (antes da carga de 200 mil linhas) | 900 |
| O mesmo índice, recriado **depois** da carga | 556 |
| `IX_Agendamentos_Cobertura` (composto + `INCLUDE`), criado depois da carga | 1.197 |

Comparando índices criados depois da carga, o de cobertura ocupa **1.197 páginas contra 556** (+641, mais que o dobro).
O índice criado pela migration ficou maior (900) porque recebeu as linhas aos poucos, depois de existir; não foi
investigado se isso é fragmentação.

## Ordem das colunas do índice

Mesmos dados, dois índices com `INCLUDE (DuracaoMinutos, Status)`, forçados com `WITH (INDEX(...))` para comparar:
`(ProfissionalId, DataHoraInicio)` x `(DataHoraInicio, ProfissionalId)`.

| Consulta | Linhas devolvidas | `(ProfissionalId, DataHoraInicio)` | `(DataHoraInicio, ProfissionalId)` |
|---|---|---|---|
| Profissional 25, **1 dia** (10/03/2026) | 8 | **3** leituras | 7 leituras |
| Profissional 25, **1 mês** (março/2026) | 176 | **4** leituras | **56** leituras (14x mais) |

Com a data primeiro, o SQL Server localiza o intervalo de datas e depois descarta, linha a linha, as dos outros 49
profissionais. Quanto maior o intervalo de datas, pior fica. Com o profissional primeiro, o intervalo já é só dele.

## Decisão

- **Manter** o índice composto `(ProfissionalId, DataHoraInicio)` das migrations: é ele que transforma 1.913 leituras
  em 35.
- **Não adotar** o índice com `INCLUDE`: o ganho de tempo medido é da ordem de centésimos de milissegundo (dentro do
  ruído), ele mais que dobra o tamanho do índice, e todo INSERT e todo UPDATE de `Status` passaria a manter mais colunas
  nele. Também exigiria mudar o `AgendamentoService` para pedir só as três colunas.
- **Quando valeria reavaliar:** se a consulta passar a devolver muitas linhas por execução (centenas), ou se a tabela
  crescer ordens de grandeza, porque aí o custo de 1 Key Lookup por linha deixa de ser desprezível.

## Conceitos (explicação, sem medição)

- **Index Scan x Index Seek.** Scan lê o índice ou a tabela inteiros e filtra depois; Seek usa a estrutura em árvore (B-tree)
  para ir direto ao ponto procurado. Seek lê poucas páginas; Scan lê todas.
- **Por que a ordem das colunas importa.** O índice é ordenado pela primeira coluna e, dentro dela, pela segunda. Ele só
  consegue "pular" direto ao trecho certo usando as colunas **da esquerda para a direita**. Regra prática: colunas
  com filtro de **igualdade** primeiro (profissional), coluna com filtro de **intervalo** depois (data).
- **Índice clustered x nonclustered.** O clustered define a ordem física da tabela (só um por tabela, aqui a chave `Id`).
  Os nonclustered são estruturas separadas que guardam a coluna indexada mais a chave do clustered, para voltar à linha.
- **Key Lookup.** Quando o índice não tem todas as colunas pedidas, o SQL Server volta à tabela (clustered) para buscar
  o resto, uma vez por linha encontrada.
- **Covering index (índice de cobertura).** Índice que contém todas as colunas que a consulta precisa (as da chave mais as
  do `INCLUDE`), então o Key Lookup deixa de existir. Cobre **a consulta enxuta**, não qualquer consulta.
  O custo é espaço e escrita mais cara.

## Limitações

- Medido em um único computador, com SQL Server em container Docker. Os valores absolutos mudam entre máquinas; a
  proporção entre os cenários e as leituras lógicas são o que se pode comparar.
- O "cache frio" foi forçado com `DBCC DROPCLEANBUFFERS`. Nos cenários 2 e 3, a 1ª execução mostrou 43 leituras e as
  seguintes 35; a causa dessa diferença não foi investigada.
- Uma única combinação de profissional e dia foi medida; o profissional 25 e a data 10/03/2026 não têm nada de especial
  nesta massa (todos os dias úteis têm 8 agendamentos por profissional).
- Os tempos incluem o custo fixo da chamada via `sp_executesql` e da tabela temporária (ver acima).

## Como reproduzir

Os scripts só rodam no banco `AgendaPro_Perf` (têm trava que recusa qualquer outro banco). A senha vai por variável
de ambiente, nunca na linha de comando versionada.

```powershell
# 1) Criar o banco aplicando as migrations (a connection string de perf só existe na variável do processo)
$env:ConnectionStrings__Default = "<connection string apontando para Database=AgendaPro_Perf>"
dotnet ef database update --project AgendaPro.Api --startup-project AgendaPro.Api
$env:ConnectionStrings__Default = $null

# 2) Popular com 200 mil agendamentos
docker cp docs/sql/seed-performance.sql sqlserver-agenda:/tmp/seed.sql
docker exec -e SQLCMDPASSWORD=<senha> sqlserver-agenda /opt/mssql-tools18/bin/sqlcmd `
    -S localhost -U sa -C -d AgendaPro_Perf -b -W -i /tmp/seed.sql

# 3) Medir (cenários A a G; no fim o banco volta ao estado das migrations)
docker cp docs/sql/medicao-indices.sql sqlserver-agenda:/tmp/medicao.sql
docker exec -e SQLCMDPASSWORD=<senha> sqlserver-agenda /opt/mssql-tools18/bin/sqlcmd `
    -S localhost -U sa -C -d AgendaPro_Perf -b -W -i /tmp/medicao.sql
```

Para ver o plano gráfico (Index Seek, Key Lookup, Scan) no VS Code com a extensão mssql: conecte em `AgendaPro_Perf`,
rode a consulta com **Include Actual Execution Plan** ligado.
