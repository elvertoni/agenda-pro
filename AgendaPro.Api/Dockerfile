# Contexto de build = pasta da solução (o docker-compose.yml já configura isso):
#   docker build -f AgendaPro.Api/Dockerfile --target final .

# ---------- Etapa 1: restaura e compila (imagem grande, com o SDK) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copia só o .csproj primeiro: enquanto ele não mudar, o restore fica em cache e o build fica rápido.
COPY AgendaPro.Api/AgendaPro.Api.csproj AgendaPro.Api/
RUN dotnet restore AgendaPro.Api/AgendaPro.Api.csproj

COPY AgendaPro.Api/ AgendaPro.Api/
RUN dotnet publish AgendaPro.Api/AgendaPro.Api.csproj -c Release -o /app/publish --no-restore

# ---------- Etapa 2: gera o "efbundle", um executável que aplica as migrations ----------
FROM build AS bundle
RUN dotnet tool install --global dotnet-ef --version "10.0.*"
ENV PATH="$PATH:/root/.dotnet/tools"
# O dotnet-ef carrega a aplicação para montar o bundle; aqui não há banco, então vai uma conexão de mentira
# (só existe durante este RUN, não é segredo). Em execução, a conexão real vem do ambiente.
RUN RID=$( [ "$(uname -m)" = "aarch64" ] && echo linux-arm64 || echo linux-x64 ) \
 && ConnectionStrings__Default="Server=x;Database=x" \
    dotnet ef migrations bundle --self-contained -r "$RID" \
      --project AgendaPro.Api/AgendaPro.Api.csproj --output /app/efbundle

# ---------- Alvo "migrator": só o bundle, numa imagem mínima ----------
FROM mcr.microsoft.com/dotnet/runtime-deps:10.0 AS migrator
WORKDIR /app
COPY --from=bundle /app/efbundle .
# Usuário "app" já existe na imagem: o container não roda como root.
USER $APP_UID
ENTRYPOINT ["./efbundle"]

# ---------- Alvo "final": a API, só com o necessário para rodar (último estágio = padrão) ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
USER $APP_UID
# A imagem aspnet escuta na 8080 (usuário não-root não pode usar a 80).
EXPOSE 8080
ENTRYPOINT ["dotnet", "AgendaPro.Api.dll"]
