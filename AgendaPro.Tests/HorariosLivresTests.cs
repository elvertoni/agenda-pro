using AgendaPro.Api.Models;
using AgendaPro.Api.Services;

namespace AgendaPro.Tests;

public class HorariosLivresTests
{
    // 12/10/2026 é uma segunda-feira.
    private static readonly DateOnly Segunda = new(2026, 10, 12);

    // "Agora" bem antes do dia consultado: nada é passado, a não ser que o teste mude isso.
    private static readonly DateTime AntesDeTudo = new(2026, 10, 1, 9, 0, 0);

    private static DateTime Em(int hora, int minuto = 0) => Segunda.ToDateTime(new TimeOnly(hora, minuto));

    private static HorarioTrabalho Horario(DayOfWeek dia, int horaIni, int horaFim) =>
        new() { DiaSemana = dia, HoraInicio = new TimeOnly(horaIni, 0), HoraFim = new TimeOnly(horaFim, 0) };

    private static Agendamento Ag(DateTime inicio, int duracao = 30,
        StatusAgendamento status = StatusAgendamento.Agendado) =>
        new() { DataHoraInicio = inicio, DuracaoMinutos = duracao, Status = status };

    private static List<DateTime> Gerar(int duracao, HorarioTrabalho[] horarios,
        Agendamento[]? agendamentos = null, DateTime? agora = null) =>
        RegrasAgendamento.GerarHorariosLivres(
            Segunda, duracao, horarios, agendamentos ?? [], agora ?? AntesDeTudo);

    [Fact]
    public void GerarHorariosLivres_ExpedienteLivre_GeraBlocosConsecutivos()
    {
        var livres = Gerar(60, [Horario(DayOfWeek.Monday, 8, 12)]);

        Assert.Equal([Em(8), Em(9), Em(10), Em(11)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_BlocosDe30Minutos_Gera8Horarios()
    {
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 8, 12)]);

        Assert.Equal(8, livres.Count);
        Assert.Equal(Em(8), livres[0]);
        Assert.Equal(Em(11, 30), livres[^1]);
    }

    [Fact]
    public void GerarHorariosLivres_SobraMenorQueADuracao_NaoGeraOUltimoBloco()
    {
        // 08–12 com blocos de 90 min: 08:00 e 09:30 cabem; 11:00 terminaria 12:30 (passa do fim).
        var livres = Gerar(90, [Horario(DayOfWeek.Monday, 8, 12)]);

        Assert.Equal([Em(8), Em(9, 30)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_ExpedienteMenorQueADuracao_RetornaVazio()
    {
        var livres = Gerar(240, [Horario(DayOfWeek.Monday, 8, 10)]);

        Assert.Empty(livres);
    }

    [Fact]
    public void GerarHorariosLivres_AgendamentoNoMeio_RemoveSoOBlocoOcupado()
    {
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 9, 12)], [Ag(Em(10), 30)]);

        // Encostar não é conflito: 09:30 e 10:30 continuam livres.
        Assert.Equal([Em(9), Em(9, 30), Em(10, 30), Em(11), Em(11, 30)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_AgendamentoDesalinhado_RemoveOsDoisBlocosQueTocam()
    {
        // 10:15–10:45 invade o bloco 10:00–10:30 e o 10:30–11:00.
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 10, 12)], [Ag(Em(10, 15), 30)]);

        Assert.Equal([Em(11), Em(11, 30)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_AgendamentoLongo_RemoveTodosOsBlocosQueCobre()
    {
        // 09:30 + 90 min termina às 11:00: ocupa 09:30, 10:00 e 10:30; o bloco das 11:00 encosta e fica livre.
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 9, 12)], [Ag(Em(9, 30), 90)]);

        Assert.Equal([Em(9), Em(11), Em(11, 30)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_AgendamentoCancelado_NaoBloqueia()
    {
        var livres = Gerar(60, [Horario(DayOfWeek.Monday, 9, 11)],
            [Ag(Em(9), 60, StatusAgendamento.Cancelado)]);

        Assert.Equal([Em(9), Em(10)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_AgendamentoConcluido_AindaBloqueia()
    {
        var livres = Gerar(60, [Horario(DayOfWeek.Monday, 9, 11)],
            [Ag(Em(9), 60, StatusAgendamento.Concluido)]);

        Assert.Equal([Em(10)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_DoisBlocosDeTrabalho_GeraNosDois()
    {
        var livres = Gerar(60, [Horario(DayOfWeek.Monday, 8, 10), Horario(DayOfWeek.Monday, 14, 16)]);

        Assert.Equal([Em(8), Em(9), Em(14), Em(15)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_BlocosForaDeOrdem_RetornaOrdenado()
    {
        var livres = Gerar(60, [Horario(DayOfWeek.Monday, 14, 16), Horario(DayOfWeek.Monday, 8, 10)]);

        Assert.Equal([Em(8), Em(9), Em(14), Em(15)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_DiaSemExpediente_RetornaVazio()
    {
        var livres = Gerar(30, [Horario(DayOfWeek.Tuesday, 8, 12)]);

        Assert.Empty(livres);
    }

    [Fact]
    public void GerarHorariosLivres_SemHorariosDeTrabalho_RetornaVazio()
    {
        Assert.Empty(Gerar(30, []));
    }

    [Fact]
    public void GerarHorariosLivres_DataDeHoje_MantemSoHorariosFuturos()
    {
        // São 10:20: o bloco das 10:00 já passou; 10:30 em diante ainda vale.
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 9, 12)], agora: Em(10, 20));

        Assert.Equal([Em(10, 30), Em(11), Em(11, 30)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_BlocoComecandoExatamenteAgora_Continua()
    {
        // Mesma regra do agendamento: começar "agora" é permitido.
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 9, 11)], agora: Em(10));

        Assert.Equal([Em(10), Em(10, 30)], livres);
    }

    [Fact]
    public void GerarHorariosLivres_DataNoPassado_RetornaVazio()
    {
        var livres = Gerar(30, [Horario(DayOfWeek.Monday, 8, 12)], agora: Segunda.AddDays(1).ToDateTime(TimeOnly.MinValue));

        Assert.Empty(livres);
    }
}
