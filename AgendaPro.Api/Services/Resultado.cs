namespace AgendaPro.Api.Services;

// Erro de regra de negócio com o status HTTP que o controller deve devolver (400, 404, 409).
public record ErroRegra(int Status, string Titulo, string? Detalhe = null);

// O service não conhece HTTP: devolve valor OU erro, e o controller converte o erro em ProblemDetails.
public record Resultado<T>(T? Valor, ErroRegra? Erro)
{
    public static Resultado<T> Sucesso(T valor) => new(valor, null);

    public static Resultado<T> Falha(int status, string titulo, string? detalhe = null) =>
        new(default, new ErroRegra(status, titulo, detalhe));
}
