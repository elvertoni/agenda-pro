namespace AgendaPro.Api.Validation;

// Esconde parte do CPF nas respostas da API (privacidade/LGPD): o CPF completo só entra, nunca sai.
public static class CpfMascara
{
    // "12345678909" vira "***.456.789-**": mostra só os 6 dígitos do meio, o bastante para o atendente conferir.
    public static string Mascarar(string? cpf)
    {
        var digitos = CpfValidador.Normalizar(cpf);

        // Valor fora do padrão não deveria existir no banco; na dúvida, não mostra nada.
        if (digitos.Length != 11)
            return "***.***.***-**";

        return $"***.{digitos.Substring(3, 3)}.{digitos.Substring(6, 3)}-**";
    }
}
