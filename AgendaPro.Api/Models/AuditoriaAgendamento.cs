namespace AgendaPro.Api.Models;

// Histórico de mudanças de status. Quem grava é o trigger do banco (trg_Agendamentos_Auditoria);
// a aplicação só lê. Não há chave estrangeira de propósito: o histórico sobrevive mesmo se o agendamento sumir.
public class AuditoriaAgendamento
{
    public int Id { get; set; }
    public int AgendamentoId { get; set; }
    public StatusAgendamento StatusAnterior { get; set; }
    public StatusAgendamento StatusNovo { get; set; }
    public DateTime AlteradoEm { get; set; }
    public required string UsuarioBanco { get; set; }
}
