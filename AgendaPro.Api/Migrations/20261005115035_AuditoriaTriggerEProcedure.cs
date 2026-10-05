using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgendaPro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AuditoriaTriggerEProcedure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditoriaAgendamentos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgendamentoId = table.Column<int>(type: "int", nullable: false),
                    StatusAnterior = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StatusNovo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AlteradoEm = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsuarioBanco = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditoriaAgendamentos", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriaAgendamentos_AgendamentoId",
                table: "AuditoriaAgendamentos",
                column: "AgendamentoId");

            // Trigger: registra TODA mudança de Status, não importa quem alterou (API, script, SSMS).
            // Set-based: um UPDATE que atinge várias linhas gera várias linhas de auditoria, sem cursor.
            // "inserted" tem os valores novos e "deleted" os antigos; o JOIN pelo Id pareia cada linha.
            migrationBuilder.Sql(@"
CREATE TRIGGER trg_Agendamentos_Auditoria
ON Agendamentos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Atalho: se a coluna Status nem foi citada no UPDATE, não há o que auditar.
    IF NOT UPDATE(Status) RETURN;

    INSERT INTO AuditoriaAgendamentos (AgendamentoId, StatusAnterior, StatusNovo, AlteradoEm, UsuarioBanco)
    SELECT i.Id, d.Status, i.Status, SYSUTCDATETIME(), SUSER_SNAME()
    FROM inserted AS i
    INNER JOIN deleted AS d ON d.Id = i.Id
    WHERE i.Status <> d.Status; -- UPDATE que regrava o mesmo status não é mudança
END");

            // Procedure do relatório mensal. Intervalo [primeiro dia, primeiro dia do mês seguinte)
            // em vez de MONTH()/YEAR() na coluna, para a comparação poder usar índice.
            migrationBuilder.Sql(@"
CREATE PROCEDURE usp_RelatorioAtendimentosPorProfissional
    @Ano INT,
    @Mes INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Inicio DATETIME2 = DATEFROMPARTS(@Ano, @Mes, 1);
    DECLARE @Fim    DATETIME2 = DATEADD(MONTH, 1, @Inicio);

    SELECT
        p.Id   AS ProfissionalId,
        p.Nome AS ProfissionalNome,
        COUNT(*) AS TotalAgendamentos,
        SUM(CASE WHEN a.Status = 'Agendado'  THEN 1 ELSE 0 END) AS Agendados,
        SUM(CASE WHEN a.Status = 'Concluido' THEN 1 ELSE 0 END) AS Concluidos,
        SUM(CASE WHEN a.Status = 'Cancelado' THEN 1 ELSE 0 END) AS Cancelados,
        CAST(100.0 * SUM(CASE WHEN a.Status = 'Cancelado' THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5, 2)) AS TaxaCancelamento
    FROM Agendamentos AS a
    INNER JOIN Profissionais AS p ON p.Id = a.ProfissionalId
    WHERE a.DataHoraInicio >= @Inicio AND a.DataHoraInicio < @Fim
    GROUP BY p.Id, p.Nome
    ORDER BY p.Nome;
END");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Ordem inversa do Up: primeiro os objetos que dependem da tabela, depois a tabela.
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS usp_RelatorioAtendimentosPorProfissional");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS trg_Agendamentos_Auditoria");

            migrationBuilder.DropTable(
                name: "AuditoriaAgendamentos");
        }
    }
}
