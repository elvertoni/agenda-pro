using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgendaPro.Api.Dtos;

namespace AgendaPro.Tests.Integracao;

// "Agora" do relógio falso é segunda 05/10/2026 09:00; 12/10/2026 (segunda) é futuro.
[Collection(ColecaoBanco.Nome)]
public class ConcorrenciaApiTests(AgendaProFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly HttpClient _http = factory.CreateClient();

    [Fact]
    public async Task Agendar_MesmoHorarioEmParalelo_SoUmaRequisicaoGanha()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync();
        var clientes = new List<int>();
        for (var i = 0; i < 12; i++)
            clientes.Add(await CriarClienteAsync());

        // Todas as requisições disparam ao mesmo tempo para o MESMO profissional e horário.
        var respostas = await Task.WhenAll(clientes.Select(clienteId =>
            _http.PostAsJsonAsync("api/agendamentos",
                new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = "2026-10-12T10:00:00" },
                Json)));

        var criados = respostas.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflitos = respostas.Count(r => r.StatusCode == HttpStatusCode.Conflict);

        Assert.Equal(1, criados);
        Assert.Equal(clientes.Count - 1, conflitos);

        // Confere no banco: só existe UM agendamento naquele horário, não importa o que as respostas disseram.
        var lista = await _http.GetFromJsonAsync<List<AgendamentoDto>>(
            $"api/agendamentos?profissionalId={profissionalId}&data=2026-10-12", Json);
        Assert.Single(lista!);
    }

    // ---------- Helpers ----------

    private async Task<int> CriarProfissionalComExpedienteAsync()
    {
        var resposta = await _http.PostAsJsonAsync("api/profissionais",
            new CriarProfissionalDto("Dr. Concorrencia", "Clínica Geral"), Json);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var profissional = (await resposta.Content.ReadFromJsonAsync<ProfissionalDto>(Json))!;

        var horario = await _http.PostAsJsonAsync($"api/profissionais/{profissional.Id}/horarios",
            new CriarHorarioDto(DayOfWeek.Monday, new TimeOnly(8, 0), new TimeOnly(12, 0)), Json);
        Assert.Equal(HttpStatusCode.Created, horario.StatusCode);

        return profissional.Id;
    }

    private async Task<int> CriarClienteAsync()
    {
        var resposta = await _http.PostAsJsonAsync("api/clientes",
            new CriarClienteDto("Cliente Concorrencia", GeradorCpf.Novo(), null), Json);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        return (await resposta.Content.ReadFromJsonAsync<ClienteDto>(Json))!.Id;
    }
}
