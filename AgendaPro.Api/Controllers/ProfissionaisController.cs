using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgendaPro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfissionaisController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ProfissionalDto>>> Listar()
    {
        return await db.Profissionais
            .AsNoTracking()
            .OrderBy(p => p.Nome)
            .Select(p => new ProfissionalDto(p.Id, p.Nome, p.Especialidade, p.Ativo))
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProfissionalDto>> Obter(int id)
    {
        var profissional = await db.Profissionais
            .AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new ProfissionalDto(p.Id, p.Nome, p.Especialidade, p.Ativo))
            .FirstOrDefaultAsync();

        return profissional is null ? NotFound() : profissional;
    }

    [HttpPost]
    public async Task<ActionResult<ProfissionalDto>> Criar(CriarProfissionalDto dto)
    {
        var profissional = new Profissional
        {
            Nome = dto.Nome,
            Especialidade = dto.Especialidade
        };

        db.Profissionais.Add(profissional);
        await db.SaveChangesAsync();

        var resposta = new ProfissionalDto(
            profissional.Id, profissional.Nome, profissional.Especialidade, profissional.Ativo);

        return CreatedAtAction(nameof(Obter), new { id = profissional.Id }, resposta);
    }
}