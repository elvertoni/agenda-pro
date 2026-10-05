namespace AgendaPro.Api.Dtos;

public record HorarioLivreDto(TimeOnly Inicio, TimeOnly Fim);

public record DisponibilidadeDto(int ProfissionalId, DateOnly Data, int DuracaoMinutos, List<HorarioLivreDto> Horarios);
