using System.ComponentModel.DataAnnotations;
using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgendaPro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RelatoriosController(AppDbContext db) : ControllerBase
{
    // int? + [Required]: o [Range] só valida valores informados. Com "int" simples, um ano/mes ausente
    // viraria 0 sem validação e a procedure estouraria (500) em vez de responder 400.
    [HttpGet("atendimentos")]
    public async Task<ActionResult<List<RelatorioAtendimentoDto>>> Atendimentos(
        [FromQuery, Required, Range(2000, 2100)] int? ano,
        [FromQuery, Required, Range(1, 12)] int? mes)
    {
        // A string interpolada NÃO é concatenada: o EF transforma os valores entre chaves em parâmetros SQL (@p0, @p1).
        // Por isso não há risco de SQL injection. A chamada precisa terminar aqui (sem Where/OrderBy depois):
        // o resultado de um EXEC não pode ser "embrulhado" em outra consulta.
        return await db.Database
            .SqlQuery<RelatorioAtendimentoDto>(
                $"EXEC usp_RelatorioAtendimentosPorProfissional @Ano = {ano!.Value}, @Mes = {mes!.Value}")
            .ToListAsync();
    }
}
