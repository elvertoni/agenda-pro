namespace AgendaPro.Api.Models;

public enum StatusAgendamento
{
    Agendado,
    Concluido,
    Cancelado
}

public class Agendamento
{
    public int Id { get; set; }
    public DateTime DataHoraInicio { get; set; }
    public int DuracaoMinutos { get; set; } = 30;
    public StatusAgendamento Status { get; set; } = StatusAgendamento.Agendado;
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public int ProfissionalId { get; set; }
    public Profissional? Profissional { get; set; }

    public int ClienteId { get; set; }
    public Cliente? Cliente { get; set; }

    public DateTime DataHoraFim => DataHoraInicio.AddMinutes(DuracaoMinutos);
}