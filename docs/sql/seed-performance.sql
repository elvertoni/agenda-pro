-- Popula o banco AgendaPro_Perf com ~200 mil agendamentos para medir índices (docs/PERFORMANCE.md).
-- Roda em UM lote só (sem GO), de forma set-based: nenhum cursor nem laço linha a linha.
--
-- Volume: 50 profissionais x 500 dias úteis x 8 horários de 30 min (08:00 a 11:30) = 200.000 agendamentos,
-- iguais ao expediente "segunda a sexta, 08:00-12:00". Os dados são determinísticos: rodar de novo
-- (em um banco novo) gera exatamente a mesma massa, então as medições são comparáveis.
-- Os CPFs são sintéticos (não passam pela validação dos dígitos; o banco não valida isso).
--
-- Como rodar (a senha vem de variável de ambiente, nunca no comando):
--   docker cp docs/sql/seed-performance.sql sqlserver-agenda:/tmp/seed.sql
--   docker exec -e SQLCMDPASSWORD=<senha> sqlserver-agenda /opt/mssql-tools18/bin/sqlcmd `
--       -S localhost -U sa -C -d AgendaPro_Perf -b -i /tmp/seed.sql

SET NOCOUNT ON;

-- Trava: este script NUNCA pode rodar no banco de desenvolvimento nem no de testes.
IF DB_NAME() <> N'AgendaPro_Perf'
    THROW 50000, 'Script de performance: rode somente no banco AgendaPro_Perf.', 1;

-- Não duplica massa: se já tem agendamentos, pare e recrie o banco AgendaPro_Perf.
IF EXISTS (SELECT 1 FROM Agendamentos)
    THROW 50001, 'AgendaPro_Perf ja tem agendamentos. Recrie o banco para popular de novo.', 1;

DECLARE @QtdProfissionais INT = 50;
DECLARE @QtdClientes      INT = 5000;
DECLARE @DiasUteis        INT = 500;
DECLARE @HorariosPorDia   INT = 8;
DECLARE @Total            INT = @QtdProfissionais * @DiasUteis * @HorariosPorDia; -- 200.000

-- Tabela de números (0 .. @Total - 1) gerada por produto cartesiano de uma tabela do sistema.
-- O CTE é reaproveitado em cada INSERT, por isso fica em tabela temporária.
CREATE TABLE #N (i INT NOT NULL PRIMARY KEY);

INSERT INTO #N (i)
SELECT TOP (@Total) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1
FROM sys.all_objects AS a
CROSS JOIN sys.all_objects AS b;

-- 1) Profissionais
INSERT INTO Profissionais (Nome, Especialidade, Ativo)
SELECT CONCAT(N'Profissional ', n.i + 1),
       CHOOSE(n.i % 5 + 1, N'Dermatologia', N'Cardiologia', N'Ortopedia', N'Pediatria', N'Clinica Geral'),
       1
FROM #N AS n
WHERE n.i < @QtdProfissionais;

-- 2) Clientes (CPF sintético de 11 dígitos, único)
INSERT INTO Clientes (Nome, Cpf, Telefone)
SELECT CONCAT(N'Cliente ', n.i + 1),
       RIGHT(CONCAT('00000000000', CAST(n.i + 1 AS VARCHAR(11))), 11),
       NULL
FROM #N AS n
WHERE n.i < @QtdClientes;

-- 3) Horários de trabalho: segunda a sexta, 08:00-12:00, para todos os profissionais
INSERT INTO HorariosTrabalho (ProfissionalId, DiaSemana, HoraInicio, HoraFim)
SELECT p.Id, d.Dia, '08:00', '12:00'
FROM Profissionais AS p
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS d (Dia);

-- 4) Agendamentos: cada profissional ocupa todos os horários de cada dia útil.
--    i = 0..199.999. O profissional gira primeiro (i % 50); k é a posição no calendário dele.
WITH Profs AS (
    SELECT Id, ROW_NUMBER() OVER (ORDER BY Id) - 1 AS rn FROM Profissionais
), Clis AS (
    SELECT Id, ROW_NUMBER() OVER (ORDER BY Id) - 1 AS rn FROM Clientes
), Linhas AS (
    SELECT n.i,
           n.i % @QtdProfissionais                            AS ProfRn,
           (n.i * 7) % @QtdClientes                           AS CliRn,
           (n.i / @QtdProfissionais) / @HorariosPorDia        AS DiaUtil,   -- 0..499
           (n.i / @QtdProfissionais) % @HorariosPorDia        AS Horario,   -- 0..7
           (n.i * 37) % 100                                   AS Sorteio    -- determinístico, 0..99
    FROM #N AS n
)
INSERT INTO Agendamentos (ProfissionalId, ClienteId, DataHoraInicio, DuracaoMinutos, Status, CriadoEm)
SELECT p.Id,
       c.Id,
       -- Dias úteis a partir de segunda 06/01/2025: pula os fins de semana (5 úteis a cada 7 dias).
       DATEADD(MINUTE, 480 + l.Horario * 30,
               CAST(DATEADD(DAY, (l.DiaUtil / 5) * 7 + (l.DiaUtil % 5), '2025-01-06') AS DATETIME2)),
       30,
       CASE WHEN l.Sorteio < 60 THEN 'Concluido'
            WHEN l.Sorteio < 80 THEN 'Cancelado'
            ELSE 'Agendado' END,
       DATEADD(DAY, -7, CAST(DATEADD(DAY, (l.DiaUtil / 5) * 7 + (l.DiaUtil % 5), '2025-01-06') AS DATETIME2))
FROM Linhas AS l
INNER JOIN Profs AS p ON p.rn = l.ProfRn
INNER JOIN Clis  AS c ON c.rn = l.CliRn;

DROP TABLE #N;

SELECT 'Profissionais' AS Tabela, COUNT(*) AS Linhas FROM Profissionais
UNION ALL SELECT 'Clientes',     COUNT(*) FROM Clientes
UNION ALL SELECT 'Agendamentos', COUNT(*) FROM Agendamentos;

SELECT Status, COUNT(*) AS Linhas FROM Agendamentos GROUP BY Status ORDER BY Status;

SELECT MIN(DataHoraInicio) AS PrimeiroAgendamento, MAX(DataHoraInicio) AS UltimoAgendamento FROM Agendamentos;
