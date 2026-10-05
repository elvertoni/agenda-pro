namespace AgendaPro.Api.Validation;

public static class CpfValidador
{
    // Deixa só os dígitos: "529.982.247-25" vira "52998224725". É assim que o CPF vai para o banco.
    public static string Normalizar(string? cpf) =>
        new((cpf ?? "").Where(char.IsAsciiDigit).ToArray());

    public static bool EhValido(string? cpf)
    {
        var digitos = Normalizar(cpf);

        if (digitos.Length != 11)
            return false;

        // 111.111.111-11 passa na conta dos dígitos verificadores, mas não é um CPF real.
        if (digitos.Distinct().Count() == 1)
            return false;

        return digitos[9] == CalcularDigito(digitos, 9)
            && digitos[10] == CalcularDigito(digitos, 10);
    }

    // Multiplica cada dígito por um peso (de quantidade+1 até 2), soma e usa o resto da divisão por 11.
    // Resto 0 ou 1 vira dígito 0; senão o dígito é 11 menos o resto.
    private static char CalcularDigito(string digitos, int quantidade)
    {
        var soma = 0;
        for (var i = 0; i < quantidade; i++)
            soma += (digitos[i] - '0') * (quantidade + 1 - i);

        var resto = soma % 11;
        var digito = resto < 2 ? 0 : 11 - resto;
        return (char)('0' + digito);
    }
}
