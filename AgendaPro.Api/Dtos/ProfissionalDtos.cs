using System.ComponentModel.DataAnnotations;

namespace AgendaPro.Api.Dtos;

public record CriarProfissionalDto(
    [Required, StringLength(100)] string Nome,
    [Required, StringLength(80)] string Especialidade);

public record ProfissionalDto(int Id, string Nome, string Especialidade, bool Ativo);