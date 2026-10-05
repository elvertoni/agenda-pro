using AgendaPro.Api.Validation;

namespace AgendaPro.Tests;

public class CpfValidadorTests
{
    [Theory]
    [InlineData("52998224725")]
    [InlineData("11144477735")]
    [InlineData("12345678909")]
    public void EhValido_CpfValidoSemMascara_RetornaTrue(string cpf)
    {
        Assert.True(CpfValidador.EhValido(cpf));
    }

    [Theory]
    [InlineData("529.982.247-25")]
    [InlineData("111.444.777-35")]
    [InlineData(" 529 982 247 25 ")]
    public void EhValido_CpfValidoComMascara_RetornaTrue(string cpf)
    {
        Assert.True(CpfValidador.EhValido(cpf));
    }

    [Theory]
    [InlineData("52998224724")] // 2º dígito verificador errado
    [InlineData("52998224715")] // 1º dígito verificador errado
    [InlineData("12345678900")]
    public void EhValido_DigitoVerificadorErrado_RetornaFalse(string cpf)
    {
        Assert.False(CpfValidador.EhValido(cpf));
    }

    [Theory]
    [InlineData("00000000000")]
    [InlineData("11111111111")]
    [InlineData("222.222.222-22")]
    [InlineData("99999999999")]
    public void EhValido_SequenciaRepetida_RetornaFalse(string cpf)
    {
        Assert.False(CpfValidador.EhValido(cpf));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("5299822472")]    // 10 dígitos
    [InlineData("529982247255")]  // 12 dígitos
    [InlineData("abcdefghijk")]
    public void EhValido_TamanhoErradoOuVazio_RetornaFalse(string? cpf)
    {
        Assert.False(CpfValidador.EhValido(cpf));
    }

    [Theory]
    [InlineData("529.982.247-25", "52998224725")]
    [InlineData("52998224725", "52998224725")]
    [InlineData(" 529 982 247 25 ", "52998224725")]
    [InlineData(null, "")]
    public void Normalizar_RemoveTudoQueNaoForDigito(string? entrada, string esperado)
    {
        Assert.Equal(esperado, CpfValidador.Normalizar(entrada));
    }
}
