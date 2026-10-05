using System.ComponentModel.DataAnnotations;
using AgendaPro.Api.Models;

namespace AgendaPro.Api.Dtos;

public record CriarAgendamentoDto(
    [Range(1, int.MaxValue)] int ProfissionalId,
    [Range(1, int.MaxValue)] int ClienteId,
    DateTime DataHoraInicio,
    [Range(10, 240)] int DuracaoMinutos = 30);

public record AgendamentoDto(
    int Id,
    int ProfissionalId,
    string ProfissionalNome,
    int ClienteId,
    string ClienteNome,
    DateTime DataHoraInicio,
    DateTime DataHoraFim,
    int DuracaoMinutos,
    StatusAgendamento Status);
