using AgendaPro.Api.Models;
using AgendaPro.Api.Services;

namespace AgendaPro.Tests;

public class RegrasAgendamentoTests
{
    // 12/10/2026 é uma segunda-feira.
    private static readonly DateTime Segunda = new(2026, 10, 12);

    private static DateTime Em(int hora, int minuto = 0) => Segunda.AddHours(hora).AddMinutes(minuto);

    private static HorarioTrabalho Horario(DayOfWeek dia, int horaIni, int horaFim) =>
        new() { DiaSemana = dia, HoraInicio = new TimeOnly(horaIni, 0), HoraFim = new TimeOnly(horaFim, 0) };

    private static Agendamento Ag(DateTime inicio, int duracao = 30,
        StatusAgendamento status = StatusAgendamento.Agendado) =>
        new() { DataHoraInicio = inicio, DuracaoMinutos = duracao, Status = status };

    // ---------- Passado ----------

    [Fact]
    public void EstaNoPassado_InicioAntesDeAgora_RetornaTrue()
    {
        Assert.True(RegrasAgendamento.EstaNoPassado(Em(9), Em(10)));
    }

    [Fact]
    public void EstaNoPassado_InicioIgualAAgora_RetornaFalse()
    {
        Assert.False(RegrasAgendamento.EstaNoPassado(Em(10), Em(10)));
    }

    [Fact]
    public void EstaNoPassado_InicioDepoisDeAgora_RetornaFalse()
    {
        Assert.False(RegrasAgendamento.EstaNoPassado(Em(11), Em(10)));
    }

    // ---------- Expediente ----------

    [Fact]
    public void DentroDoExpediente_AgendamentoNoMeioDoExpediente_RetornaTrue()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12) };

        Assert.True(RegrasAgendamento.DentroDoExpediente(Em(10), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_ComecaExatamenteNaHoraInicio_RetornaTrue()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12) };

        Assert.True(RegrasAgendamento.DentroDoExpediente(Em(8), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_TerminaExatamenteNaHoraFim_RetornaTrue()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12) };

        Assert.True(RegrasAgendamento.DentroDoExpediente(Em(11, 30), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_TerminaDepoisDaHoraFim_RetornaFalse()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12) };

        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(11, 45), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_ComecaAntesDaHoraInicio_RetornaFalse()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12) };

        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(7, 45), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_OutroDiaDaSemana_RetornaFalse()
    {
        var horarios = new[] { Horario(DayOfWeek.Tuesday, 8, 12) };

        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(10), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_SemHorarios_RetornaFalse()
    {
        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(10), 30, []));
    }

    [Fact]
    public void DentroDoExpediente_NoIntervaloEntreDoisBlocos_RetornaFalse()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12), Horario(DayOfWeek.Monday, 14, 18) };

        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(13), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_DentroDoSegundoBloco_RetornaTrue()
    {
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12), Horario(DayOfWeek.Monday, 14, 18) };

        Assert.True(RegrasAgendamento.DentroDoExpediente(Em(14), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_ComecaNoBlocoETerminaNoIntervalo_RetornaFalse()
    {
        // 11:45–12:15 começa no 1º bloco e termina no "buraco" do almoço: não cabe inteiro em nenhum bloco.
        var horarios = new[] { Horario(DayOfWeek.Monday, 8, 12), Horario(DayOfWeek.Monday, 14, 18) };

        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(11, 45), 30, horarios));
    }

    [Fact]
    public void DentroDoExpediente_AtravessandoAMeiaNoite_RetornaFalse()
    {
        var horarios = new[]
        {
            new HorarioTrabalho
            {
                DiaSemana = DayOfWeek.Monday,
                HoraInicio = new TimeOnly(0, 0),
                HoraFim = new TimeOnly(23, 59)
            }
        };

        Assert.False(RegrasAgendamento.DentroDoExpediente(Em(23, 45), 30, horarios));
    }

    // ---------- Conflito ----------

    [Fact]
    public void TemConflito_SobreposicaoParcial_RetornaTrue()
    {
        var existentes = new[] { Ag(Em(10), 30) };

        Assert.True(RegrasAgendamento.TemConflito(Em(10, 15), 30, existentes));
    }

    [Fact]
    public void TemConflito_MesmoHorarioExato_RetornaTrue()
    {
        var existentes = new[] { Ag(Em(10), 30) };

        Assert.True(RegrasAgendamento.TemConflito(Em(10), 30, existentes));
    }

    [Fact]
    public void TemConflito_NovoContemOExistente_RetornaTrue()
    {
        var existentes = new[] { Ag(Em(10, 15), 15) };

        Assert.True(RegrasAgendamento.TemConflito(Em(10), 60, existentes));
    }

    [Fact]
    public void TemConflito_EncostandoNoFimDoExistente_RetornaFalse()
    {
        var existentes = new[] { Ag(Em(10), 30) };

        Assert.False(RegrasAgendamento.TemConflito(Em(10, 30), 30, existentes));
    }

    [Fact]
    public void TemConflito_EncostandoNoInicioDoExistente_RetornaFalse()
    {
        var existentes = new[] { Ag(Em(10, 30), 30) };

        Assert.False(RegrasAgendamento.TemConflito(Em(10), 30, existentes));
    }

    [Fact]
    public void TemConflito_ExistenteCancelado_Ignora()
    {
        var existentes = new[] { Ag(Em(10), 30, StatusAgendamento.Cancelado) };

        Assert.False(RegrasAgendamento.TemConflito(Em(10), 30, existentes));
    }

    [Fact]
    public void TemConflito_ExistenteConcluido_AindaOcupaOHorario()
    {
        var existentes = new[] { Ag(Em(10), 30, StatusAgendamento.Concluido) };

        Assert.True(RegrasAgendamento.TemConflito(Em(10), 30, existentes));
    }

    [Fact]
    public void TemConflito_OutroDia_RetornaFalse()
    {
        var existentes = new[] { Ag(Em(10).AddDays(1), 30) };

        Assert.False(RegrasAgendamento.TemConflito(Em(10), 30, existentes));
    }

    [Fact]
    public void TemConflito_SemExistentes_RetornaFalse()
    {
        Assert.False(RegrasAgendamento.TemConflito(Em(10), 30, []));
    }

    [Fact]
    public void TemConflito_ConflitaComUmEntreVarios_RetornaTrue()
    {
        var existentes = new[] { Ag(Em(8), 30), Ag(Em(9), 30), Ag(Em(10), 30), Ag(Em(11), 30) };

        Assert.True(RegrasAgendamento.TemConflito(Em(10, 10), 30, existentes));
    }
}
