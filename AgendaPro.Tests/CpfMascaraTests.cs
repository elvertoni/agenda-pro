using AgendaPro.Api.Validation;

namespace AgendaPro.Tests;

public class CpfMascaraTests
{
    [Theory]
    [InlineData("12345678909", "***.456.789-**")]
    [InlineData("52998224725", "***.982.247-**")]
    public void Mascarar_CpfSoComNumeros_MostraSoOsSeisDigitosDoMeio(string cpf, string esperado)
    {
        Assert.Equal(esperado, CpfMascara.Mascarar(cpf));
    }

    [Fact]
    public void Mascarar_CpfComPontuacao_DaOMesmoResultado()
    {
        Assert.Equal("***.456.789-**", CpfMascara.Mascarar("123.456.789-09"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("123456789012")]
    public void Mascarar_ValorForaDoPadrao_NaoMostraNada(string? cpf)
    {
        Assert.Equal("***.***.***-**", CpfMascara.Mascarar(cpf));
    }

    [Fact]
    public void Mascarar_ResultadoNuncaContemOCpfCompleto()
    {
        const string cpf = "52998224725";

        var mascarado = CpfMascara.Mascarar(cpf);

        Assert.DoesNotContain(cpf, mascarado);
        Assert.DoesNotContain("529", mascarado); // 3 primeiros dígitos escondidos
        Assert.DoesNotContain("25", mascarado.Replace("***", "").Replace("**", "")); // 2 últimos escondidos
    }
}
