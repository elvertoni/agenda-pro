using System.ComponentModel.DataAnnotations;

namespace AgendaPro.Api.Dtos;

// O CPF pode chegar com máscara (até 14 caracteres); o controller limpa e valida.
public record CriarClienteDto(
    [Required, StringLength(100)] string Nome,
    [Required, StringLength(14)] string Cpf,
    [StringLength(20)] string? Telefone);

// Sem CPF de propósito: ele não muda depois do cadastro.
public record AtualizarClienteDto(
    [Required, StringLength(100)] string Nome,
    [StringLength(20)] string? Telefone);

public record ClienteDto(int Id, string Nome, string Cpf, string? Telefone);
