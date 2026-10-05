using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgendaPro.Api.Dtos;

namespace AgendaPro.Tests.Integracao;

// Monta dados de teste chamando a própria API (cada teste cria o seu profissional, para não interferir nos outros).
public class ApiHelper(HttpClient http)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task<int> CriarProfissionalComExpedienteAsync(string nome = "Dr. Teste Helper")
    {
        var resposta = await http.PostAsJsonAsync("api/profissionais",
            new CriarProfissionalDto(nome, "Clínica Geral"), Json);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var profissional = (await resposta.Content.ReadFromJsonAsync<ProfissionalDto>(Json))!;

        // Segunda-feira 08:00–12:00.
        var horario = await http.PostAsJsonAsync($"api/profissionais/{profissional.Id}/horarios",
            new CriarHorarioDto(DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0)), Json);
        Assert.Equal(HttpStatusCode.Created, horario.StatusCode);

        return profissional.Id;
    }

    public async Task<int> CriarClienteAsync()
    {
        var resposta = await http.PostAsJsonAsync("api/clientes",
            new CriarClienteDto("Cliente Helper", GeradorCpf.Novo(), null), Json);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        return (await resposta.Content.ReadFromJsonAsync<ClienteDto>(Json))!.Id;
    }

    // Falha cedo, mostrando o corpo do erro, se o agendamento de preparação não for criado.
    public async Task<AgendamentoDto> AgendarAsync(int profissionalId, int clienteId, string inicio)
    {
        var resposta = await http.PostAsJsonAsync("api/agendamentos",
            new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = inicio }, Json);
        Assert.True(resposta.StatusCode == HttpStatusCode.Created,
            $"POST agendamento {inicio} -> {(int)resposta.StatusCode}: {await resposta.Content.ReadAsStringAsync()}");
        return (await resposta.Content.ReadFromJsonAsync<AgendamentoDto>(Json))!;
    }

    public async Task MudarStatusAsync(int agendamentoId, string acao)
    {
        var resposta = await http.PatchAsync($"api/agendamentos/{agendamentoId}/{acao}", null);
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
    }

    public async Task<List<AuditoriaDto>> AuditoriaAsync(int agendamentoId)
    {
        var resposta = await http.GetAsync($"api/agendamentos/{agendamentoId}/auditoria");
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        return (await resposta.Content.ReadFromJsonAsync<List<AuditoriaDto>>(Json))!;
    }
}
