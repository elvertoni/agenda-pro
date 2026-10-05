using AgendaPro.Api.Models;

namespace AgendaPro.Api.Dtos;

// Sem o UsuarioBanco de propósito: é o login do banco (o da aplicação, igual para todas as linhas)
// e não ajuda quem consome a API; expô-lo só revelaria um detalhe da infraestrutura.
public record AuditoriaDto(int Id, StatusAgendamento StatusAnterior, StatusAgendamento StatusNovo, DateTime AlteradoEm);
