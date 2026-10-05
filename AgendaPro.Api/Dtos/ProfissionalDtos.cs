using System.ComponentModel.DataAnnotations;

namespace AgendaPro.Api.Dtos;

public record CriarProfissionalDto(
    [Required, StringLength(100)] string Nome,
    [Required, StringLength(80)] string Especialidade);

public record AtualizarProfissionalDto(
    [Required, StringLength(100)] string Nome,
    [Required, StringLength(80)] string Especialidade);

// bool? + [Required] de propósito: se o campo faltar no JSON, vira 400
// em vez de assumir false em silêncio e desativar o profissional sem querer.
public record AlterarAtivoDto([Required] bool? Ativo);

public record ProfissionalDto(int Id, string Nome, string Especialidade, bool Ativo);