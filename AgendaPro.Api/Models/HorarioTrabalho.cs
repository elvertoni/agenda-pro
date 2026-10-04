namespace AgendaPro.Api.Models;

public class HorarioTrabalho
{
    public int Id { get; set; }
    public DayOfWeek DiaSemana { get; set; }
    public TimeOnly HoraInicio { get; set; }
    public TimeOnly HoraFim { get; set; }

    public int ProfissionalId { get; set; }
    public Profissional? Profissional { get; set; }
}