# Multi-stage build: compile in a full SDK image, run in a slim ASP.NET runtime image.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY PasswordVault.slnx .
COPY src/PasswordVault.Domain/*.csproj src/PasswordVault.Domain/
COPY src/PasswordVault.Application/*.csproj src/PasswordVault.Application/
COPY src/PasswordVault.Infrastructure/*.csproj src/PasswordVault.Infrastructure/
COPY src/PasswordVault.Api/*.csproj src/PasswordVault.Api/
RUN dotnet restore src/PasswordVault.Api/PasswordVault.Api.csproj

COPY src/ src/
RUN dotnet publish src/PasswordVault.Api/PasswordVault.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Applying migrations is a deliberate, explicit release step (see README) —
# this image does not auto-migrate on start.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "PasswordVault.Api.dll"]
