namespace AgendaPro.Api.Dtos;

public record CriarHorarioDto(DayOfWeek DiaSemana, TimeOnly HoraInicio, TimeOnly HoraFim);

public record HorarioDto(int Id, DayOfWeek DiaSemana, TimeOnly HoraInicio, TimeOnly HoraFim);