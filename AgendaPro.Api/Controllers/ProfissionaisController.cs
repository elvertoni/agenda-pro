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
    public async Task<ActionResult<List<ProfissionalDto>>> Listar(
        [FromQuery] string? especialidade, [FromQuery] bool? ativo)
    {
        var consulta = db.Profissionais.AsNoTracking();

        // Filtros opcionais: só entram na consulta quando o parâmetro foi informado.
        if (!string.IsNullOrWhiteSpace(especialidade))
            consulta = consulta.Where(p => p.Especialidade.Contains(especialidade));

        if (ativo.HasValue)
            consulta = consulta.Where(p => p.Ativo == ativo.Value);

        return await consulta
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

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ProfissionalDto>> Atualizar(int id, AtualizarProfissionalDto dto)
    {
        // Precisa de tracking: o EF detecta o que mudou e gera o UPDATE.
        var profissional = await db.Profissionais.FirstOrDefaultAsync(p => p.Id == id);

        if (profissional is null)
            return NotFound();

        // Ativo não muda aqui: tem endpoint próprio (PATCH .../ativo).
        profissional.Nome = dto.Nome;
        profissional.Especialidade = dto.Especialidade;
        await db.SaveChangesAsync();

        return new ProfissionalDto(
            profissional.Id, profissional.Nome, profissional.Especialidade, profissional.Ativo);
    }

    [HttpPatch("{id:int}/ativo")]
    public async Task<ActionResult<ProfissionalDto>> AlterarAtivo(int id, AlterarAtivoDto dto)
    {
        var profissional = await db.Profissionais.FirstOrDefaultAsync(p => p.Id == id);

        if (profissional is null)
            return NotFound();

        // O [Required] do DTO garante que Ativo tem valor aqui.
        profissional.Ativo = dto.Ativo!.Value;
        await db.SaveChangesAsync();

        return new ProfissionalDto(
            profissional.Id, profissional.Nome, profissional.Especialidade, profissional.Ativo);
    }
}