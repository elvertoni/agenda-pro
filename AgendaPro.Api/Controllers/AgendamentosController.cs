using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using AgendaPro.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AgendaPro.Api.Controllers;

// Controller fino: as regras de negócio ficam no AgendamentoService.
[ApiController]
[Route("api/[controller]")]
public class AgendamentosController(AgendamentoService agendamentos) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<AgendamentoDto>> Criar(CriarAgendamentoDto dto)
    {
        var resultado = await agendamentos.Criar(dto);

        if (resultado.Erro is not null)
            return ProblemaDoErro(resultado.Erro);

        var criado = resultado.Valor!;
        return CreatedAtAction(nameof(Obter), new { id = criado.Id }, criado);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AgendamentoDto>> Obter(int id)
    {
        var agendamento = await agendamentos.Obter(id);

        return agendamento is null ? NotFound() : agendamento;
    }

    [HttpGet]
    public async Task<ActionResult<List<AgendamentoDto>>> Listar(
        [FromQuery] int? profissionalId,
        [FromQuery] DateOnly? data,
        [FromQuery] StatusAgendamento? status)
    {
        return await agendamentos.Listar(profissionalId, data, status);
    }

    [HttpPatch("{id:int}/cancelar")]
    public async Task<ActionResult<AgendamentoDto>> Cancelar(int id) =>
        ConverterResultado(await agendamentos.Cancelar(id));

    [HttpPatch("{id:int}/concluir")]
    public async Task<ActionResult<AgendamentoDto>> Concluir(int id) =>
        ConverterResultado(await agendamentos.Concluir(id));

    private ActionResult<AgendamentoDto> ConverterResultado(Resultado<AgendamentoDto> resultado)
    {
        if (resultado.Erro is not null)
            return ProblemaDoErro(resultado.Erro);

        return resultado.Valor!;
    }

    // Traduz o erro de regra (sem HTTP) para ProblemDetails com o status certo.
    private ObjectResult ProblemaDoErro(ErroRegra erro) =>
        Problem(title: erro.Titulo, detail: erro.Detalhe, statusCode: erro.Status);
}
