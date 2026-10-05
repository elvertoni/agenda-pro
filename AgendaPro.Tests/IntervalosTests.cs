using AgendaPro.Api.Services;

namespace AgendaPro.Tests;

public class IntervalosTests
{
    private static TimeOnly H(int hora, int minuto = 0) => new(hora, minuto);

    [Fact]
    public void Sobrepoe_IntervalosSeCruzando_RetornaTrue()
    {
        Assert.True(Intervalos.Sobrepoe(H(8), H(12), H(10), H(14)));
    }

    [Fact]
    public void Sobrepoe_UmDentroDoOutro_RetornaTrue()
    {
        Assert.True(Intervalos.Sobrepoe(H(8), H(18), H(10), H(11)));
        Assert.True(Intervalos.Sobrepoe(H(10), H(11), H(8), H(18)));
    }

    [Fact]
    public void Sobrepoe_IntervalosIguais_RetornaTrue()
    {
        Assert.True(Intervalos.Sobrepoe(H(10), H(11), H(10), H(11)));
    }

    [Fact]
    public void Sobrepoe_EncostandoNoFim_RetornaFalse()
    {
        Assert.False(Intervalos.Sobrepoe(H(10), H(10, 30), H(10, 30), H(11)));
    }

    [Fact]
    public void Sobrepoe_EncostandoNoInicio_RetornaFalse()
    {
        Assert.False(Intervalos.Sobrepoe(H(10, 30), H(11), H(10), H(10, 30)));
    }

    [Fact]
    public void Sobrepoe_IntervalosSeparados_RetornaFalse()
    {
        Assert.False(Intervalos.Sobrepoe(H(8), H(10), H(14), H(18)));
        Assert.False(Intervalos.Sobrepoe(H(14), H(18), H(8), H(10)));
    }

    [Fact]
    public void Sobrepoe_FuncionaComDateTime()
    {
        var dia = new DateTime(2026, 10, 12);

        Assert.True(Intervalos.Sobrepoe(
            dia.AddHours(10), dia.AddHours(10.5), dia.AddHours(10.25), dia.AddHours(11)));
        Assert.False(Intervalos.Sobrepoe(
            dia.AddHours(10), dia.AddHours(10.5), dia.AddHours(10.5), dia.AddHours(11)));
    }
}
