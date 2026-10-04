namespace AgendaPro.Api.Models;

public class Profissional
{
    public int Id { get; set; }
    public required string Nome { get; set; }
    public required string Especialidade { get; set; }
    public bool Ativo { get; set; } = true;
    public List<HorarioTrabalho> Horarios { get; set; } = [];
    public List<Agendamento> Agendamentos { get; set; } = [];
}