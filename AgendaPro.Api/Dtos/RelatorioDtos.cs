namespace AgendaPro.Api.Dtos;

// Os nomes das propriedades precisam bater com as colunas devolvidas pela stored procedure.
// TotalAgendamentos = todos do mês; Agendados = só os que ainda estão com status Agendado (pendentes).
// TaxaCancelamento em porcentagem (ex.: 33,33).
public record RelatorioAtendimentoDto(
    int ProfissionalId,
    string ProfissionalNome,
    int TotalAgendamentos,
    int Agendados,
    int Concluidos,
    int Cancelados,
    decimal TaxaCancelamento);
