# Reconectar o teste do chatbot WhatsApp (Evolution API local + ngrok)

Este é um setup **temporário** para testar o chatbot de agendamento via WhatsApp antes de
contratar um servidor definitivo (VPS Hostinger ou serviço gerenciado). Ele depende do seu
PC estar ligado, com o WSL2 e o túnel do ngrok ativos. Sempre que reiniciar o PC, os passos
abaixo precisam ser refeitos.

## O que esse setup é

```
Produção (Vercel) → túnel ngrok (público) → Evolution API rodando no WSL2 (Ubuntu) → seu WhatsApp conectado
```

- Evolution API + Postgres + Redis rodam em containers Docker dentro do WSL2 (distro `Ubuntu`)
- O ngrok expõe a porta 8080 do WSL2 numa URL pública HTTPS
- Essa URL é configurada no Vercel do backend como `EVOLUTION_API_URL`

## Passo a passo após reiniciar o PC

### 1. Confirmar que os containers do Evolution API estão de pé

```bash
wsl -d Ubuntu -- bash -c "docker ps --format '{{.Names}}: {{.Status}}'"
```

Deve mostrar `evolution-api-local`, `evo_postgres_local` e `evo_redis_local` como "Up".
Se não aparecer nada (containers pararam), suba de novo:

```bash
# Mantém a VM do WSL2 viva em segundo plano (senão o Windows desliga sozinho)
wsl -d Ubuntu -- bash -c "sleep infinity"   # rodar em background

# Sobe os containers
wsl -d Ubuntu -- bash -c "cd /mnt/c/Aura_System/evolution-api-local && docker compose up -d"
```

### 2. Subir o túnel do ngrok

Caminho do executável (instalado via winget, ainda não está no PATH do shell):
```
C:\Users\leandro\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe
```

O token já está salvo (`ngrok config add-authtoken` já foi rodado uma vez, não precisa repetir).

```bash
"/c/Users/leandro/AppData/Local/Microsoft/WinGet/Packages/Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe/ngrok.exe" http 8080 --log stdout
```

Rodar isso **em background** e ler o log pra pegar a nova URL pública (ela muda toda vez que reinicia):

```bash
grep "started tunnel" ~/ngrok.log
# procurar por algo como: url=https://xxxxx-xxxxx-xxxxx.ngrok-free.dev
```

### 3. Atualizar a URL no Vercel (produção)

A URL do ngrok muda a cada reinício, então é preciso substituir a variável:

```bash
cd aura-backend
vercel env rm EVOLUTION_API_URL production --yes
printf 'https://SUA-NOVA-URL.ngrok-free.dev' | vercel env add EVOLUTION_API_URL production
```

`EVOLUTION_API_KEY` **não muda** (é fixa, `edee1e41bd5a48a2fc01600dd9fb1d006d0081ca26b8522b`) — só precisa mexer se recriar os containers do zero.

### 4. Redeployar o backend

```bash
vercel --prod --yes
```

### 5. Testar

Entrar em `aura-system-mu.vercel.app` → Configurações → WhatsApp — Confirmações → Conectar WhatsApp.
Se o QR Code aparecer, está tudo funcionando.

## Coisas importantes de lembrar

- **Não durma o PC** enquanto estiver testando — o túnel e os containers param.
- Depois de conectar o WhatsApp com o chip de teste, é possível **ativar/desativar o chatbot**
  a qualquer momento no toggle "Chatbot de agendamento" nas mesmas configurações.
- Quando migrar pra VPS de verdade, esse arquivo deixa de ser necessário — o `EVOLUTION_API_URL`
  passa a apontar pro servidor definitivo, sem depender do seu PC.
