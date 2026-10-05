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

// O Cpf sai sempre mascarado (ex.: ***.456.789-**); o CPF completo só é aceito na entrada.
public record ClienteDto(int Id, string Nome, string Cpf, string? Telefone);
