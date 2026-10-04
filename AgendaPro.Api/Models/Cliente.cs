namespace AgendaPro.Api.Models;

public class Cliente
{
    public int Id { get; set; }
    public required string Nome { get; set; }
    public required string Cpf { get; set; }
    public string? Telefone { get; set; }
}