using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgendaPro.Api.Controllers;

[ApiController]
[Route("api/profissionais/{profissionalId:int}/horarios")]
public class HorariosController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<HorarioDto>>> Listar(int profissionalId)
    {
        if (!await db.Profissionais.AnyAsync(p => p.Id == profissionalId))
            return NotFound();

        return await db.HorariosTrabalho
            .AsNoTracking()
            .Where(h => h.ProfissionalId == profissionalId)
            .OrderBy(h => h.DiaSemana).ThenBy(h => h.HoraInicio)
            .Select(h => new HorarioDto(h.Id, h.DiaSemana, h.HoraInicio, h.HoraFim))
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<HorarioDto>> Criar(int profissionalId, CriarHorarioDto dto)
    {
        if (!await db.Profissionais.AnyAsync(p => p.Id == profissionalId))
            return NotFound();

        if (dto.HoraFim <= dto.HoraInicio)
            return Problem(
                title: "Horário inválido",
                detail: "A hora de fim deve ser maior que a hora de início.",
                statusCode: StatusCodes.Status400BadRequest);

        var horario = new HorarioTrabalho
        {
            ProfissionalId = profissionalId,
            DiaSemana = dto.DiaSemana,
            HoraInicio = dto.HoraInicio,
            HoraFim = dto.HoraFim
        };

        db.HorariosTrabalho.Add(horario);
        await db.SaveChangesAsync();

        var resposta = new HorarioDto(horario.Id, horario.DiaSemana, horario.HoraInicio, horario.HoraFim);
        return CreatedAtAction(nameof(Listar), new { profissionalId }, resposta);
    }
}