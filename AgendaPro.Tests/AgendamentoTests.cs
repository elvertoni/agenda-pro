using AgendaPro.Api.Models;

namespace AgendaPro.Tests;

public class AgendamentoTests
{
    [Fact]
    public void DataHoraFim_SomaADuracaoAoInicio()
    {
        var agendamento = new Agendamento
        {
            DataHoraInicio = new DateTime(2026, 10, 12, 10, 0, 0),
            DuracaoMinutos = 45
        };

        Assert.Equal(new DateTime(2026, 10, 12, 10, 45, 0), agendamento.DataHoraFim);
    }
}
