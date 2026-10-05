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

    // Fatia cada bloco de trabalho do dia em intervalos consecutivos de "duracaoMinutos", a partir da hora
    // de início do bloco, e devolve os inícios que ainda estão livres. Reaproveita as mesmas regras do
    // agendamento (passado e conflito), então o que aparece aqui como livre é aceito pelo POST.
    public static List<DateTime> GerarHorariosLivres(
        DateOnly data, int duracaoMinutos, IEnumerable<HorarioTrabalho> horarios,
        IEnumerable<Agendamento> agendamentosDoDia, DateTime agora)
    {
        var livres = new List<DateTime>();
        var existentes = agendamentosDoDia.ToList(); // evita enumerar a mesma fonte várias vezes

        var blocosDoDia = horarios
            .Where(h => h.DiaSemana == data.DayOfWeek)
            .OrderBy(h => h.HoraInicio);

        foreach (var bloco in blocosDoDia)
        {
            var inicio = data.ToDateTime(bloco.HoraInicio);
            var limite = data.ToDateTime(bloco.HoraFim);

            // O intervalo precisa terminar até o fim do bloco; a sobra menor que a duração é descartada.
            while (inicio.AddMinutes(duracaoMinutos) <= limite)
            {
                if (!EstaNoPassado(inicio, agora) && !TemConflito(inicio, duracaoMinutos, existentes))
                    livres.Add(inicio);

                inicio = inicio.AddMinutes(duracaoMinutos);
            }
        }

        return livres;
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
