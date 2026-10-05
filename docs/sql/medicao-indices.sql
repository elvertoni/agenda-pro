-- Mede a consulta de checagem de conflito do AgendamentoService com e sem índice (docs/PERFORMANCE.md).
-- Só roda no banco AgendaPro_Perf (já populado com docs/sql/seed-performance.sql). No fim, o banco volta
-- ao estado das migrations: só o índice IX_Agendamentos_ProfissionalId_DataHoraInicio.
--
-- Como rodar:
--   docker cp docs/sql/medicao-indices.sql sqlserver-agenda:/tmp/medicao.sql
--   docker exec -e SQLCMDPASSWORD=<senha> sqlserver-agenda /opt/mssql-tools18/bin/sqlcmd `
--       -S localhost -U sa -C -d AgendaPro_Perf -b -W -y 160 -i /tmp/medicao.sql
--
-- As consultas são enviadas com sp_executesql e parâmetros tipados, igual ao que o EF Core faz.
-- Cada cenário roda 3 vezes: a 1ª com o cache limpo (DBCC DROPCLEANBUFFERS) e as outras 2 "quentes".
-- O que vale comparar: leituras lógicas (logical reads, determinísticas) e o plano (Seek x Scan, Key Lookup).

SET NOCOUNT ON;

IF DB_NAME() <> N'AgendaPro_Perf'
    THROW 50000, 'Medicao de indices: rode somente no banco AgendaPro_Perf.', 1;
GO

-- Destino das linhas retornadas, para não poluir a saída (o custo de ler as linhas continua medido).
CREATE TABLE #Cheia  (Id INT, ClienteId INT, CriadoEm DATETIME2, DataHoraInicio DATETIME2,
                      DuracaoMinutos INT, ProfissionalId INT, Status NVARCHAR(20));
CREATE TABLE #Enxuta (DataHoraInicio DATETIME2, DuracaoMinutos INT, Status NVARCHAR(20));
GO

PRINT '################ A) ESTADO DAS MIGRATIONS: indice composto (ProfissionalId, DataHoraInicio) ################';
SELECT i.name AS Indice, i.type_desc AS Tipo, SUM(ps.used_page_count) AS Paginas
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('Agendamentos') GROUP BY i.name, i.type_desc ORDER BY i.name;
GO
-- Consulta COMPLETA (as 7 colunas, igual ao EF) para 1 profissional em 1 dia
CHECKPOINT; DBCC DROPCLEANBUFFERS;
SET STATISTICS IO ON; SET STATISTICS TIME ON;
PRINT '--- A.1 (cache frio)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- A.2 (quente)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- A.3 (quente)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS IO OFF; SET STATISTICS TIME OFF;
PRINT '--- A.plano';
SET STATISTICS PROFILE ON;
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS PROFILE OFF;
SELECT COUNT(*) AS LinhasPorExecucao FROM Agendamentos WHERE ProfissionalId = 25 AND DataHoraInicio >= '2026-03-10' AND DataHoraInicio < '2026-03-11';
SELECT COUNT(*) AS LinhasNaTabela FROM Agendamentos;
TRUNCATE TABLE #Cheia;
GO

PRINT '################ B) SEM o indice composto (so PK e IX_ClienteId) ################';
DROP INDEX IX_Agendamentos_ProfissionalId_DataHoraInicio ON Agendamentos;
SELECT i.name AS Indice, i.type_desc AS Tipo, SUM(ps.used_page_count) AS Paginas
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('Agendamentos') GROUP BY i.name, i.type_desc ORDER BY i.name;
GO
CHECKPOINT; DBCC DROPCLEANBUFFERS;
SET STATISTICS IO ON; SET STATISTICS TIME ON;
PRINT '--- B.1 (cache frio)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- B.2 (quente)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- B.3 (quente)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS IO OFF; SET STATISTICS TIME OFF;
PRINT '--- B.plano';
SET STATISTICS PROFILE ON;
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS PROFILE OFF;
TRUNCATE TABLE #Cheia;
GO

PRINT '################ C) Indice composto de volta; consulta ENXUTA (so DataHoraInicio, DuracaoMinutos, Status) ################';
CREATE INDEX IX_Agendamentos_ProfissionalId_DataHoraInicio ON Agendamentos (ProfissionalId, DataHoraInicio);
GO
CHECKPOINT; DBCC DROPCLEANBUFFERS;
SET STATISTICS IO ON; SET STATISTICS TIME ON;
PRINT '--- C.1 (cache frio)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- C.2 (quente)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- C.3 (quente)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS IO OFF; SET STATISTICS TIME OFF;
PRINT '--- C.plano';
SET STATISTICS PROFILE ON;
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS PROFILE OFF;
TRUNCATE TABLE #Enxuta;
GO

PRINT '################ D) Indice COBERTURA: (ProfissionalId, DataHoraInicio) INCLUDE (DuracaoMinutos, Status) ################';
DROP INDEX IX_Agendamentos_ProfissionalId_DataHoraInicio ON Agendamentos;
CREATE INDEX IX_Agendamentos_Cobertura ON Agendamentos (ProfissionalId, DataHoraInicio) INCLUDE (DuracaoMinutos, Status);
SELECT i.name AS Indice, i.type_desc AS Tipo, SUM(ps.used_page_count) AS Paginas
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('Agendamentos') GROUP BY i.name, i.type_desc ORDER BY i.name;
GO
CHECKPOINT; DBCC DROPCLEANBUFFERS;
SET STATISTICS IO ON; SET STATISTICS TIME ON;
PRINT '--- D.1 consulta ENXUTA (cache frio)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- D.2 consulta ENXUTA (quente)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- D.3 consulta ENXUTA (quente)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
PRINT '--- D.4 consulta COMPLETA do EF (7 colunas) com o indice cobertura (quente)';
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS IO OFF; SET STATISTICS TIME OFF;
PRINT '--- D.plano (consulta ENXUTA)';
SET STATISTICS PROFILE ON;
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS PROFILE OFF;
PRINT '--- D.plano4 (consulta COMPLETA do EF com o indice cobertura)';
SET STATISTICS PROFILE ON;
INSERT #Cheia EXEC sp_executesql N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays', N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00';
SET STATISTICS PROFILE OFF;
TRUNCATE TABLE #Enxuta; TRUNCATE TABLE #Cheia;
GO

PRINT '################ E) ORDEM DAS COLUNAS: (Profissional, Data) x (Data, Profissional), ambos com INCLUDE ################';
DROP INDEX IX_Agendamentos_Cobertura ON Agendamentos;
CREATE INDEX IX_Agendamentos_PD ON Agendamentos (ProfissionalId, DataHoraInicio) INCLUDE (DuracaoMinutos, Status);
CREATE INDEX IX_Agendamentos_DP ON Agendamentos (DataHoraInicio, ProfissionalId) INCLUDE (DuracaoMinutos, Status);
GO
SET STATISTICS IO ON;
PRINT '--- E.1 DIA, indice (Profissional, Data)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WITH (INDEX(IX_Agendamentos_PD)) WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @fim', N'@id int, @dia datetime2, @fim datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @fim = '2026-03-11T00:00:00';
PRINT '--- E.2 DIA, indice (Data, Profissional)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WITH (INDEX(IX_Agendamentos_DP)) WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @fim', N'@id int, @dia datetime2, @fim datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @fim = '2026-03-11T00:00:00';
PRINT '--- E.3 MES (1 a 31/03), indice (Profissional, Data)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WITH (INDEX(IX_Agendamentos_PD)) WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @fim', N'@id int, @dia datetime2, @fim datetime2', @id = 25, @dia = '2026-03-01T00:00:00', @fim = '2026-04-01T00:00:00';
PRINT '--- E.4 MES (1 a 31/03), indice (Data, Profissional)';
INSERT #Enxuta EXEC sp_executesql N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WITH (INDEX(IX_Agendamentos_DP)) WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @fim', N'@id int, @dia datetime2, @fim datetime2', @id = 25, @dia = '2026-03-01T00:00:00', @fim = '2026-04-01T00:00:00';
SET STATISTICS IO OFF;
SELECT COUNT(*) AS LinhasDoMes FROM Agendamentos WHERE ProfissionalId = 25 AND DataHoraInicio >= '2026-03-01' AND DataHoraInicio < '2026-04-01';
TRUNCATE TABLE #Enxuta;
GO

PRINT '################ G) TEMPO MEDIO: 300 execucoes de cada consulta (cache quente) ################';
-- O tempo medido inclui o custo fixo de chamar sp_executesql e gravar o resultado na tabela temporaria,
-- igual em todos os cenarios; por isso vale para COMPARAR cenarios, nao como tempo absoluto da aplicacao.
DROP INDEX IX_Agendamentos_PD ON Agendamentos;
DROP INDEX IX_Agendamentos_DP ON Agendamentos;
CREATE INDEX IX_Agendamentos_ProfissionalId_DataHoraInicio ON Agendamentos (ProfissionalId, DataHoraInicio);
GO

DECLARE @q1 NVARCHAR(MAX) = N'SELECT [a].[Id], [a].[ClienteId], [a].[CriadoEm], [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[ProfissionalId], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays';
DECLARE @q2 NVARCHAR(MAX) = N'SELECT [a].[DataHoraInicio], [a].[DuracaoMinutos], [a].[Status] FROM [Agendamentos] AS [a] WHERE [a].[ProfissionalId] = @id AND [a].[DataHoraInicio] >= @dia AND [a].[DataHoraInicio] < @AddDays';
DECLARE @i INT, @t0 DATETIME2;

-- G.1 indice composto (migrations), consulta completa do EF
SET @i = 0; SET @t0 = SYSDATETIME();
WHILE @i < 300 BEGIN INSERT #Cheia EXEC sp_executesql @q1, N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00'; SET @i += 1; END;
PRINT CONCAT('G.1 composto, consulta completa : ', CAST(DATEDIFF(MICROSECOND, @t0, SYSDATETIME()) / 300.0 / 1000.0 AS DECIMAL(9,3)), ' ms por execucao');
TRUNCATE TABLE #Cheia;

-- G.2 indice composto, consulta enxuta
SET @i = 0; SET @t0 = SYSDATETIME();
WHILE @i < 300 BEGIN INSERT #Enxuta EXEC sp_executesql @q2, N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00'; SET @i += 1; END;
PRINT CONCAT('G.2 composto, consulta enxuta   : ', CAST(DATEDIFF(MICROSECOND, @t0, SYSDATETIME()) / 300.0 / 1000.0 AS DECIMAL(9,3)), ' ms por execucao');
TRUNCATE TABLE #Enxuta;

-- G.3 SEM indice composto, consulta completa
DROP INDEX IX_Agendamentos_ProfissionalId_DataHoraInicio ON Agendamentos;
SET @i = 0; SET @t0 = SYSDATETIME();
WHILE @i < 300 BEGIN INSERT #Cheia EXEC sp_executesql @q1, N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00'; SET @i += 1; END;
PRINT CONCAT('G.3 sem indice, consulta completa: ', CAST(DATEDIFF(MICROSECOND, @t0, SYSDATETIME()) / 300.0 / 1000.0 AS DECIMAL(9,3)), ' ms por execucao');
TRUNCATE TABLE #Cheia;

-- G.4 indice cobertura, consulta enxuta
CREATE INDEX IX_Agendamentos_Cobertura ON Agendamentos (ProfissionalId, DataHoraInicio) INCLUDE (DuracaoMinutos, Status);
SET @i = 0; SET @t0 = SYSDATETIME();
WHILE @i < 300 BEGIN INSERT #Enxuta EXEC sp_executesql @q2, N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00'; SET @i += 1; END;
PRINT CONCAT('G.4 cobertura, consulta enxuta  : ', CAST(DATEDIFF(MICROSECOND, @t0, SYSDATETIME()) / 300.0 / 1000.0 AS DECIMAL(9,3)), ' ms por execucao');
TRUNCATE TABLE #Enxuta;

-- G.5 indice cobertura, consulta completa (volta o Key Lookup)
SET @i = 0; SET @t0 = SYSDATETIME();
WHILE @i < 300 BEGIN INSERT #Cheia EXEC sp_executesql @q1, N'@id int, @dia datetime2, @AddDays datetime2', @id = 25, @dia = '2026-03-10T00:00:00', @AddDays = '2026-03-11T00:00:00'; SET @i += 1; END;
PRINT CONCAT('G.5 cobertura, consulta completa: ', CAST(DATEDIFF(MICROSECOND, @t0, SYSDATETIME()) / 300.0 / 1000.0 AS DECIMAL(9,3)), ' ms por execucao');
TRUNCATE TABLE #Cheia;
DROP INDEX IX_Agendamentos_Cobertura ON Agendamentos;
GO

PRINT '################ F) RESTAURA o estado das migrations ################';
CREATE INDEX IX_Agendamentos_ProfissionalId_DataHoraInicio ON Agendamentos (ProfissionalId, DataHoraInicio);
DROP TABLE #Cheia;
DROP TABLE #Enxuta;
SELECT i.name AS Indice, i.type_desc AS Tipo, SUM(ps.used_page_count) AS Paginas
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('Agendamentos') GROUP BY i.name, i.type_desc ORDER BY i.name;
GO
