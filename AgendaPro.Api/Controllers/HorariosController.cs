using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using AgendaPro.Api.Services;
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

        // Só traz as horas do mesmo dia; a comparação em si fica na função pura Intervalos.Sobrepoe.
        var existentes = await db.HorariosTrabalho
            .AsNoTracking()
            .Where(h => h.ProfissionalId == profissionalId && h.DiaSemana == dto.DiaSemana)
            .Select(h => new { h.HoraInicio, h.HoraFim })
            .ToListAsync();

        if (existentes.Any(h => Intervalos.Sobrepoe(h.HoraInicio, h.HoraFim, dto.HoraInicio, dto.HoraFim)))
            return Problem(
                title: "Horário sobreposto",
                detail: "Já existe um horário de trabalho que se sobrepõe a este nesse dia.",
                statusCode: StatusCodes.Status409Conflict);

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

    [HttpDelete("{horarioId:int}")]
    public async Task<IActionResult> Remover(int profissionalId, int horarioId)
    {
        // Filtrar por Id e ProfissionalId juntos impede apagar o horário de outro profissional.
        // Precisa de tracking: o EF usa a entidade carregada para gerar o DELETE.
        var horario = await db.HorariosTrabalho
            .FirstOrDefaultAsync(h => h.Id == horarioId && h.ProfissionalId == profissionalId);

        if (horario is null)
            return NotFound();

        db.HorariosTrabalho.Remove(horario);
        await db.SaveChangesAsync();

        return NoContent();
    }
}