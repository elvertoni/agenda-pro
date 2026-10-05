using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using AgendaPro.Api.Validation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace AgendaPro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ClienteDto>>> Listar([FromQuery] string? nome)
    {
        var consulta = db.Clientes.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(nome))
            consulta = consulta.Where(c => c.Nome.Contains(nome));

        return await consulta
            .OrderBy(c => c.Nome)
            .Select(c => new ClienteDto(c.Id, c.Nome, CpfMascara.Mascarar(c.Cpf), c.Telefone))
            .ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ClienteDto>> Obter(int id)
    {
        var cliente = await db.Clientes
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new ClienteDto(c.Id, c.Nome, CpfMascara.Mascarar(c.Cpf), c.Telefone))
            .FirstOrDefaultAsync();

        return cliente is null ? NotFound() : cliente;
    }

    [HttpPost]
    public async Task<ActionResult<ClienteDto>> Criar(CriarClienteDto dto)
    {
        if (!CpfValidador.EhValido(dto.Cpf))
            return Problem(title: "CPF inválido.", statusCode: StatusCodes.Status400BadRequest);

        // O CPF é gravado só com números, então a checagem de duplicidade usa o mesmo formato.
        var cpf = CpfValidador.Normalizar(dto.Cpf);

        if (await db.Clientes.AnyAsync(c => c.Cpf == cpf))
            return CpfJaCadastrado();

        var cliente = new Cliente
        {
            Nome = dto.Nome,
            Cpf = cpf,
            Telefone = dto.Telefone
        };

        db.Clientes.Add(cliente);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ViolouIndiceUnico(ex))
        {
            // Duas requisições com o mesmo CPF podem passar pelo AnyAsync ao mesmo tempo:
            // o índice único do banco é a garantia final.
            return CpfJaCadastrado();
        }

        var resposta = new ClienteDto(cliente.Id, cliente.Nome, CpfMascara.Mascarar(cliente.Cpf), cliente.Telefone);
        return CreatedAtAction(nameof(Obter), new { id = cliente.Id }, resposta);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ClienteDto>> Atualizar(int id, AtualizarClienteDto dto)
    {
        // Aqui precisa de tracking: o EF detecta o que mudou e gera o UPDATE.
        var cliente = await db.Clientes.FirstOrDefaultAsync(c => c.Id == id);

        if (cliente is null)
            return NotFound();

        cliente.Nome = dto.Nome;
        cliente.Telefone = dto.Telefone;
        await db.SaveChangesAsync();

        return new ClienteDto(cliente.Id, cliente.Nome, CpfMascara.Mascarar(cliente.Cpf), cliente.Telefone);
    }

    private ObjectResult CpfJaCadastrado() =>
        Problem(title: "Já existe um cliente com este CPF.", statusCode: StatusCodes.Status409Conflict);

    // 2601 e 2627 são os códigos do SQL Server para violação de índice único / chave duplicada.
    private static bool ViolouIndiceUnico(DbUpdateException ex) =>
        ex.InnerException is SqlException { Number: 2601 or 2627 };
}
