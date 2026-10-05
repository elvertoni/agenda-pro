using System.ComponentModel.DataAnnotations;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgendaPro.Api.Controllers;

// Rota aninhada em profissionais, como a de horários; controller próprio para não inchar o de Profissionais.
[ApiController]
[Route("api/profissionais/{profissionalId:int}/disponibilidade")]
public class DisponibilidadeController(AgendamentoService agendamentos) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DisponibilidadeDto>> Consultar(
        int profissionalId,
        // DateOnly? + [Required]: sem a data, devolve 400 em vez de consultar o dia 01/01/0001.
        [FromQuery, Required] DateOnly? data,
        [FromQuery, Range(10, 240)] int duracaoMinutos = 30)
    {
        var resultado = await agendamentos.ConsultarDisponibilidade(profissionalId, data!.Value, duracaoMinutos);

        if (resultado.Erro is not null)
            return Problem(
                title: resultado.Erro.Titulo, detail: resultado.Erro.Detalhe, statusCode: resultado.Erro.Status);

        return resultado.Valor!;
    }
}
