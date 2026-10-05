using AgendaPro.Api.Models;

namespace AgendaPro.Api.Services;

// Regras de agendamento sem banco e sem relógio: tudo entra por parâmetro, então é fácil de testar.
public static class RegrasAgendamento
{
    // Começar exatamente "agora" ainda é válido; só o que já passou é rejeitado.
    public static bool EstaNoPassado(DateTime inicio, DateTime agora) =>
        inicio < agora;

    // O agendamento precisa caber INTEIRO em um único bloco de trabalho do dia da semana.
    public static bool DentroDoExpediente(
        DateTime inicio, int duracaoMinutos, IEnumerable<HorarioTrabalho> horarios)
    {
        var fim = inicio.AddMinutes(duracaoMinutos);

        // HorarioTrabalho guarda só horas (sem data): um agendamento que vira o dia não tem como caber.
        if (fim.Date != inicio.Date)
            return false;

        var horaInicio = TimeOnly.FromDateTime(inicio);
        var horaFim = TimeOnly.FromDateTime(fim);

        return horarios.Any(h =>
            h.DiaSemana == inicio.DayOfWeek
            && h.HoraInicio <= horaInicio
            && horaFim <= h.HoraFim);
    }

    // Cancelado libera o horário; concluído continua ocupando (o atendimento aconteceu naquele intervalo).
    public static bool TemConflito(
        DateTime inicio, int duracaoMinutos, IEnumerable<Agendamento> existentes)
    {
        var fim = inicio.AddMinutes(duracaoMinutos);

        return existentes
            .Where(a => a.Status != StatusAgendamento.Cancelado)
            .Any(a => Intervalos.Sobrepoe(inicio, fim, a.DataHoraInicio, a.DataHoraFim));
    }
}
