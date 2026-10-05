using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AgendaPro.Api.Services;

// Concentra as regras de agendamento. O controller só traduz HTTP; o service não conhece HTTP.
public class AgendamentoService(AppDbContext db, TimeProvider relogio)
{
    public async Task<Resultado<AgendamentoDto>> Criar(CriarAgendamentoDto dto)
    {
        // 1. Existência e situação das partes envolvidas.
        var profissional = await db.Profissionais
            .AsNoTracking()
            .Where(p => p.Id == dto.ProfissionalId)
            .Select(p => new { p.Nome, p.Ativo })
            .FirstOrDefaultAsync();

        if (profissional is null)
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status404NotFound, "Profissional não encontrado.");

        var cliente = await db.Clientes
            .AsNoTracking()
            .Where(c => c.Id == dto.ClienteId)
            .Select(c => new { c.Nome })
            .FirstOrDefaultAsync();

        if (cliente is null)
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status404NotFound, "Cliente não encontrado.");

        if (!profissional.Ativo)
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status400BadRequest, "Profissional inativo.",
                "Não é possível agendar com um profissional inativo.");

        // 2. Data/hora de início já passou? Compara em horário local da clínica (DateTime sem fuso).
        var agora = relogio.GetLocalNow().DateTime;

        if (RegrasAgendamento.EstaNoPassado(dto.DataHoraInicio, agora))
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status400BadRequest, "A data e hora do agendamento já passaram.");

        // 3. Precisa caber inteiro em um bloco de trabalho do dia da semana.
        var horarios = await db.HorariosTrabalho
            .AsNoTracking()
            .Where(h => h.ProfissionalId == dto.ProfissionalId
                        && h.DiaSemana == dto.DataHoraInicio.DayOfWeek)
            .ToListAsync();

        if (!RegrasAgendamento.DentroDoExpediente(dto.DataHoraInicio, dto.DuracaoMinutos, horarios))
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status400BadRequest, "Horário fora do expediente do profissional.",
                "O agendamento precisa caber inteiro em um horário de trabalho do dia.");

        // 4. Conflito com outros agendamentos do mesmo profissional no mesmo dia.
        // Filtra só pelo início (usa o índice ProfissionalId + DataHoraInicio); funciona porque
        // nenhum agendamento atravessa a meia-noite. O cálculo do fim fica em memória,
        // pois DataHoraFim não é mapeada e não pode ir para o SQL.
        var dia = dto.DataHoraInicio.Date;

        var doDia = await db.Agendamentos
            .AsNoTracking()
            .Where(a => a.ProfissionalId == dto.ProfissionalId
                        && a.DataHoraInicio >= dia
                        && a.DataHoraInicio < dia.AddDays(1))
            .ToListAsync();

        if (RegrasAgendamento.TemConflito(dto.DataHoraInicio, dto.DuracaoMinutos, doDia))
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status409Conflict, "Já existe um agendamento neste horário.",
                "O profissional já tem um agendamento que se sobrepõe a este intervalo.");

        // 5. Cria o agendamento.
        // LIMITAÇÃO DE CONCORRÊNCIA: entre a checagem de conflito acima e o SaveChanges, duas requisições
        // simultâneas podem passar juntas e criar agendamentos sobrepostos. A proteção seria uma
        // transação com isolamento Serializable; não foi implementada por decisão do projeto.
        var agendamento = new Agendamento
        {
            ProfissionalId = dto.ProfissionalId,
            ClienteId = dto.ClienteId,
            DataHoraInicio = dto.DataHoraInicio,
            DuracaoMinutos = dto.DuracaoMinutos,
            Status = StatusAgendamento.Agendado,
            CriadoEm = relogio.GetUtcNow().UtcDateTime
        };

        db.Agendamentos.Add(agendamento);
        await db.SaveChangesAsync();

        // Os nomes já foram carregados acima: não precisa de outra ida ao banco.
        var resposta = new AgendamentoDto(
            agendamento.Id,
            agendamento.ProfissionalId,
            profissional.Nome,
            agendamento.ClienteId,
            cliente.Nome,
            agendamento.DataHoraInicio,
            agendamento.DataHoraInicio.AddMinutes(agendamento.DuracaoMinutos),
            agendamento.DuracaoMinutos,
            agendamento.Status);

        return Resultado<AgendamentoDto>.Sucesso(resposta);
    }

    public async Task<AgendamentoDto?> Obter(int id) =>
        await db.Agendamentos
            .AsNoTracking()
            .Where(a => a.Id == id)
            .Select(a => new AgendamentoDto(
                a.Id,
                a.ProfissionalId,
                a.Profissional!.Nome,
                a.ClienteId,
                a.Cliente!.Nome,
                a.DataHoraInicio,
                a.DataHoraInicio.AddMinutes(a.DuracaoMinutos), // DataHoraFim não é mapeada: calcula aqui
                a.DuracaoMinutos,
                a.Status))
            .FirstOrDefaultAsync();

    public async Task<List<AgendamentoDto>> Listar(int? profissionalId, DateOnly? data, StatusAgendamento? status)
    {
        var consulta = db.Agendamentos.AsNoTracking();

        if (profissionalId is not null)
            consulta = consulta.Where(a => a.ProfissionalId == profissionalId);

        if (data is not null)
        {
            // Intervalo [dia, dia+1) em vez de comparar .Date, para o índice continuar útil.
            var inicioDoDia = data.Value.ToDateTime(TimeOnly.MinValue);
            var fimDoDia = inicioDoDia.AddDays(1);
            consulta = consulta.Where(a => a.DataHoraInicio >= inicioDoDia && a.DataHoraInicio < fimDoDia);
        }

        if (status is not null)
            consulta = consulta.Where(a => a.Status == status);

        return await consulta
            .OrderBy(a => a.DataHoraInicio)
            .Select(a => new AgendamentoDto(
                a.Id,
                a.ProfissionalId,
                a.Profissional!.Nome,
                a.ClienteId,
                a.Cliente!.Nome,
                a.DataHoraInicio,
                a.DataHoraInicio.AddMinutes(a.DuracaoMinutos),
                a.DuracaoMinutos,
                a.Status))
            .ToListAsync();
    }

    public Task<Resultado<AgendamentoDto>> Cancelar(int id) =>
        MudarStatus(id, StatusAgendamento.Cancelado, "cancelar");

    public Task<Resultado<AgendamentoDto>> Concluir(int id) =>
        MudarStatus(id, StatusAgendamento.Concluido, "concluir");

    // Cancelar e concluir têm a mesma regra: só quem ainda está Agendado pode mudar de status.
    private async Task<Resultado<AgendamentoDto>> MudarStatus(int id, StatusAgendamento novoStatus, string verbo)
    {
        // Precisa de tracking: o EF detecta a mudança e gera o UPDATE.
        var agendamento = await db.Agendamentos.FirstOrDefaultAsync(a => a.Id == id);

        if (agendamento is null)
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status404NotFound, "Agendamento não encontrado.");

        if (agendamento.Status != StatusAgendamento.Agendado)
            return Resultado<AgendamentoDto>.Falha(
                StatusCodes.Status409Conflict,
                $"Só é possível {verbo} um agendamento com status Agendado.",
                $"O agendamento está com status {agendamento.Status}.");

        agendamento.Status = novoStatus;
        await db.SaveChangesAsync();

        // Existe, pois acabamos de alterá-lo; o "!" só silencia a nulabilidade.
        return Resultado<AgendamentoDto>.Sucesso((await Obter(id))!);
    }
}
