using System.Net;
using System.Net.Http.Json;
using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;

namespace AgendaPro.Tests.Integracao;

// Testa os objetos que moram no SQL Server: trigger de auditoria e stored procedure do relatório.
// "Agora" do relógio falso é segunda 05/10/2026; as segundas 12, 19 e 26/10 e 02/11 são futuro.
[Collection(ColecaoBanco.Nome)]
public class SqlServerObjetosTests(AgendaProFactory factory)
{
    private readonly HttpClient _http = factory.CreateClient();
    private readonly ApiHelper _api = new(factory.CreateClient());

    // ---------- Trigger de auditoria ----------

    [Fact]
    public async Task Auditoria_AgendamentoRecemCriado_ComecaVazia()
    {
        var (_, agendamento) = await CriarAgendamentoAsync("2026-10-12T10:00:00");

        // O trigger é AFTER UPDATE: o INSERT não gera auditoria.
        Assert.Empty(await _api.AuditoriaAsync(agendamento.Id));
    }

    [Fact]
    public async Task Cancelar_GravaLinhaDeAuditoria()
    {
        var (_, agendamento) = await CriarAgendamentoAsync("2026-10-12T10:00:00");

        await _api.MudarStatusAsync(agendamento.Id, "cancelar");

        var historico = await _api.AuditoriaAsync(agendamento.Id);
        var linha = Assert.Single(historico);
        Assert.Equal(StatusAgendamento.Agendado, linha.StatusAnterior);
        Assert.Equal(StatusAgendamento.Cancelado, linha.StatusNovo);
        Assert.True(linha.AlteradoEm > new DateTime(2026, 1, 1)); // preenchido pelo banco (UTC)
    }

    [Fact]
    public async Task Concluir_GravaLinhaDeAuditoria()
    {
        var (_, agendamento) = await CriarAgendamentoAsync("2026-10-12T10:00:00");

        await _api.MudarStatusAsync(agendamento.Id, "concluir");

        var linha = Assert.Single(await _api.AuditoriaAsync(agendamento.Id));
        Assert.Equal(StatusAgendamento.Agendado, linha.StatusAnterior);
        Assert.Equal(StatusAgendamento.Concluido, linha.StatusNovo);
    }

    [Fact]
    public async Task Auditoria_AgendamentoInexistente_Retorna404()
    {
        var resposta = await _http.GetAsync("api/agendamentos/999999/auditoria");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Trigger_UpdateEmVariasLinhas_AuditaCadaLinha()
    {
        // Um único UPDATE atingindo 3 linhas: o trigger precisa tratar o conjunto, não só a primeira linha.
        var profissionalId = await _api.CriarProfissionalComExpedienteAsync();
        var clienteId = await _api.CriarClienteAsync();
        var a1 = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T10:00:00");
        var a2 = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T10:30:00");
        var a3 = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T11:00:00");

        await ExecutarSqlAsync(
            $"UPDATE Agendamentos SET Status = 'Concluido' WHERE ProfissionalId = {profissionalId}");

        foreach (var agendamento in new[] { a1, a2, a3 })
        {
            var linha = Assert.Single(await _api.AuditoriaAsync(agendamento.Id));
            Assert.Equal(StatusAgendamento.Agendado, linha.StatusAnterior);
            Assert.Equal(StatusAgendamento.Concluido, linha.StatusNovo);
        }
    }

    [Fact]
    public async Task Trigger_UpdateMisto_AuditaSoQuemMudouDeStatus()
    {
        var profissionalId = await _api.CriarProfissionalComExpedienteAsync();
        var clienteId = await _api.CriarClienteAsync();
        var jaCancelado = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T10:00:00");
        var muda1 = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T10:30:00");
        var muda2 = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T11:00:00");
        await _api.MudarStatusAsync(jaCancelado.Id, "cancelar"); // 1 linha de auditoria já existente

        // O UPDATE atinge as 3 linhas, mas uma já estava Cancelada: para ela o status não mudou.
        await ExecutarSqlAsync(
            $"UPDATE Agendamentos SET Status = 'Cancelado' WHERE ProfissionalId = {profissionalId}");

        Assert.Single(await _api.AuditoriaAsync(jaCancelado.Id));   // continua só com a do cancelamento original
        Assert.Single(await _api.AuditoriaAsync(muda1.Id));
        Assert.Single(await _api.AuditoriaAsync(muda2.Id));
    }

    [Fact]
    public async Task Trigger_UpdateQueNaoMudaOStatus_NaoAudita()
    {
        var (_, agendamento) = await CriarAgendamentoAsync("2026-10-12T10:00:00");

        // Muda outra coluna, e depois regrava o mesmo status: nenhuma das duas é mudança de status.
        await ExecutarSqlAsync($"UPDATE Agendamentos SET DuracaoMinutos = 45 WHERE Id = {agendamento.Id}");
        await ExecutarSqlAsync($"UPDATE Agendamentos SET Status = 'Agendado' WHERE Id = {agendamento.Id}");

        Assert.Empty(await _api.AuditoriaAsync(agendamento.Id));
    }

    // ---------- Stored procedure do relatório ----------

    [Fact]
    public async Task Relatorio_ContaPorStatusECalculaTaxaDeCancelamento()
    {
        var profissionalId = await _api.CriarProfissionalComExpedienteAsync("Dra. Relatorio");
        var clienteId = await _api.CriarClienteAsync();
        var cancelado = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T10:00:00");
        var concluido = await _api.AgendarAsync(profissionalId, clienteId, "2026-10-19T10:00:00");
        await _api.AgendarAsync(profissionalId, clienteId, "2026-10-26T10:00:00"); // continua Agendado
        await _api.AgendarAsync(profissionalId, clienteId, "2026-11-02T10:00:00"); // outro mês
        await _api.MudarStatusAsync(cancelado.Id, "cancelar");
        await _api.MudarStatusAsync(concluido.Id, "concluir");

        var outubro = await RelatorioDoProfissionalAsync(2026, 10, profissionalId);

        Assert.NotNull(outubro);
        Assert.Equal("Dra. Relatorio", outubro.ProfissionalNome);
        Assert.Equal(3, outubro.TotalAgendamentos);
        Assert.Equal(1, outubro.Agendados);
        Assert.Equal(1, outubro.Concluidos);
        Assert.Equal(1, outubro.Cancelados);
        Assert.Equal(33.33m, outubro.TaxaCancelamento);

        var novembro = await RelatorioDoProfissionalAsync(2026, 11, profissionalId);
        Assert.NotNull(novembro);
        Assert.Equal(1, novembro.TotalAgendamentos);
        Assert.Equal(0m, novembro.TaxaCancelamento);

        // Mês sem nenhum agendamento do profissional: ele nem aparece no relatório.
        Assert.Null(await RelatorioDoProfissionalAsync(2026, 9, profissionalId));
    }

    [Theory]
    [InlineData("ano=2026&mes=13")]
    [InlineData("ano=2026&mes=0")]
    [InlineData("ano=1999&mes=10")]
    [InlineData("mes=10")]
    [InlineData("")]
    public async Task Relatorio_ParametrosInvalidosOuAusentes_Retorna400(string consulta)
    {
        var resposta = await _http.GetAsync($"api/relatorios/atendimentos?{consulta}");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    // ---------- Migration: o Down remove tudo e o Up recria ----------

    [Fact]
    public async Task Migration_Down_RemoveTriggerProcedureETabela_EUpRecria()
    {
        using var escopo = factory.Services.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();
        var migrator = db.GetService<IMigrator>();

        Assert.True(await ExisteNoBancoAsync(db, "trg_Agendamentos_Auditoria"));
        Assert.True(await ExisteNoBancoAsync(db, "usp_RelatorioAtendimentosPorProfissional"));
        Assert.True(await ExisteNoBancoAsync(db, "AuditoriaAgendamentos"));

        try
        {
            // Volta para a migration anterior, executando o Down da de auditoria.
            await migrator.MigrateAsync("Inicial");

            Assert.False(await ExisteNoBancoAsync(db, "trg_Agendamentos_Auditoria"));
            Assert.False(await ExisteNoBancoAsync(db, "usp_RelatorioAtendimentosPorProfissional"));
            Assert.False(await ExisteNoBancoAsync(db, "AuditoriaAgendamentos"));
        }
        finally
        {
            // Mesmo se uma verificação falhar, deixa o banco como estava para não derrubar os outros testes.
            await db.Database.MigrateAsync();
        }

        Assert.True(await ExisteNoBancoAsync(db, "trg_Agendamentos_Auditoria"));
        Assert.True(await ExisteNoBancoAsync(db, "usp_RelatorioAtendimentosPorProfissional"));
        Assert.True(await ExisteNoBancoAsync(db, "AuditoriaAgendamentos"));
    }

    // ---------- Helpers ----------

    private async Task<(int ProfissionalId, AgendamentoDto Agendamento)> CriarAgendamentoAsync(string inicio)
    {
        var profissionalId = await _api.CriarProfissionalComExpedienteAsync();
        var clienteId = await _api.CriarClienteAsync();
        return (profissionalId, await _api.AgendarAsync(profissionalId, clienteId, inicio));
    }

    // SQL direto no banco de TESTES, simulando alguém alterando fora da API (script, SSMS...).
    private async Task ExecutarSqlAsync(FormattableString sql)
    {
        using var escopo = factory.Services.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.ExecuteSqlAsync(sql);
    }

    private async Task<RelatorioAtendimentoDto?> RelatorioDoProfissionalAsync(int ano, int mes, int profissionalId)
    {
        var resposta = await _http.GetAsync($"api/relatorios/atendimentos?ano={ano}&mes={mes}");
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var linhas = await resposta.Content.ReadFromJsonAsync<List<RelatorioAtendimentoDto>>(ApiHelper.Json);
        return linhas!.SingleOrDefault(l => l.ProfissionalId == profissionalId);
    }

    private static async Task<bool> ExisteNoBancoAsync(AppDbContext db, string nome)
    {
        // sys.objects cobre tabela (U), procedure (P) e trigger (TR).
        var total = await db.Database
            .SqlQuery<int>($"SELECT COUNT(*) AS Value FROM sys.objects WHERE name = {nome}")
            .SingleAsync();
        return total > 0;
    }
}
