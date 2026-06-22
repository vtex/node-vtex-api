# Integração do Client VBase no Middleware do Next.js

Este guia explica como integrar o client VBase do `@vtex/api` no middleware do Next.js.

## 📋 Pré-requisitos

1. **Projeto Next.js** (versão 12.2 ou superior para suporte ao middleware)

2. **Instalação de dependências:**
   ```bash
   npm install @vtex/api uuid
   # ou
   yarn add @vtex/api uuid
   ```

3. **Variáveis de ambiente** (crie um arquivo `.env.local`):
   ```env
   # Obrigatório
   VTEX_ACCOUNT=seu-account-name
   VTEX_AUTH_TOKEN=seu-token-de-autenticacao
   VTEX_APP_ID=vendor.app-name@major-version
   
   # Opcionais
   VTEX_WORKSPACE=master
   VTEX_REGION=aws-us-east-1
   ```

   > **Importante:** O `VTEX_APP_ID` é obrigatório para o client VBase funcionar. Ele deve seguir o formato `vendor.app-name@major-version` (ex: `vtex.my-app@1.x`).

## 🚀 Como usar

### Passo 1: Copiar as funções helper

Copie as funções `createVBaseContext` e `createVBaseClient` do arquivo de exemplo para seu projeto, ou crie um arquivo separado (ex: `lib/vtex/vbase-helpers.ts`).

### Passo 2: Criar o middleware

Crie um arquivo `middleware.ts` na raiz do seu projeto Next.js:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createVBaseContext, createVBaseClient } from './lib/vtex/vbase-helpers'

export async function middleware(request: NextRequest) {
  // Extrair account e workspace
  const account = 
    request.headers.get('x-vtex-account') || 
    process.env.VTEX_ACCOUNT || ''
  
  const workspace = 
    request.headers.get('x-vtex-workspace') || 
    process.env.VTEX_WORKSPACE || 'master'

  if (!account) {
    return NextResponse.next()
  }

  try {
    // Criar contexto e client VBase
    const context = createVBaseContext(request, {
      account,
      workspace,
      authToken: request.headers.get('x-vtex-credential') || process.env.VTEX_AUTH_TOKEN,
    })
    
    const vbase = createVBaseClient(context)

    // Usar o client VBase
    const bucket = 'meu-bucket'
    const filePath = 'arquivo.json'
    const data = await vbase.getJSON(bucket, filePath, true)
    
    // Modificar resposta com dados do VBase
    const response = NextResponse.next()
    if (data) {
      response.headers.set('x-vbase-data', JSON.stringify(data))
    }
    
    return response
  } catch (error) {
    console.error('Erro no middleware VBase:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## 📝 Exemplos de uso

### 1. Buscar configurações do VBase

```typescript
const config = await vbase.getJSON<{ theme: string; features: string[] }>(
  'app-config',
  'settings.json',
  true // retorna null se não encontrar
)
```

### 2. Listar arquivos de um bucket

```typescript
const files = await vbase.listFiles('app-assets', {
  prefix: 'images/',
  limit: 100
})
```

### 3. Salvar dados no VBase

```typescript
await vbase.saveJSON('app-config', 'settings.json', {
  theme: 'dark',
  features: ['feature1', 'feature2']
})
```

### 4. Buscar arquivo binário

```typescript
const buffer = await vbase.getFile('app-assets', 'image.png')
```

## 🔍 Extraindo informações da requisição

### Opção 1: Headers HTTP

```typescript
const account = request.headers.get('x-vtex-account')
const workspace = request.headers.get('x-vtex-workspace')
const authToken = request.headers.get('x-vtex-credential')
```

### Opção 2: Query parameters

```typescript
const account = request.nextUrl.searchParams.get('account')
const workspace = request.nextUrl.searchParams.get('workspace')
```

### Opção 3: Do hostname

```typescript
const host = request.headers.get('host') || ''
const hostParts = host.split('.')
const account = hostParts[0] // ex: myaccount.vtexcommercestable.com.br
```

### Opção 4: Variáveis de ambiente

```typescript
const account = process.env.VTEX_ACCOUNT
const workspace = process.env.VTEX_WORKSPACE || 'master'
```

## ⚠️ Considerações importantes

### Performance

- O middleware é executado em **cada requisição** que corresponder ao matcher
- Evite fazer muitas chamadas ao VBase no middleware
- Considere implementar cache para dados que não mudam frequentemente

### Tratamento de erros

- Sempre trate erros do VBase para não quebrar o site
- Em caso de erro, geralmente é melhor continuar com `NextResponse.next()` do que retornar um erro 500

### Autenticação

- O `VTEX_AUTH_TOKEN` é necessário para fazer chamadas autenticadas ao VBase
- Você pode obtê-lo através do VTEX IO CLI ou da plataforma VTEX

## 🔧 Troubleshooting

### Erro: "VTEX_APP_ID não está configurado"

Configure a variável de ambiente `VTEX_APP_ID` com o formato `vendor.app-name@major-version`.

### Erro: "Invalid path to access VBase"

Verifique se:
1. O `VTEX_APP_ID` está configurado corretamente
2. O formato está correto: `vendor.app-name@major-version`

### Erro de autenticação (401)

Verifique se:
1. O `VTEX_AUTH_TOKEN` está configurado corretamente
2. O token tem permissões para acessar o VBase
3. O account e workspace estão corretos

### Tracer não inicializa

O Tracer pode falhar em ambientes que não são VTEX IO. O código de exemplo inclui um fallback para usar um MockTracer. Se necessário, instale:

```bash
npm install @tiagonapoli/opentracing-alternate-mock
```

## 📚 Recursos adicionais

- [Documentação do Next.js Middleware](https://nextjs.org/docs/advanced-features/middleware)
- [Documentação do @vtex/api](https://github.com/vtex/node-vtex-api)
- [Documentação do VBase](https://developers.vtex.com/docs/guides/vbase-overview)

## 🆘 Suporte

Se você encontrar problemas, verifique:
1. As variáveis de ambiente estão configuradas corretamente
2. As versões do Next.js e @vtex/api são compatíveis
3. O account e workspace estão acessíveis
4. O token de autenticação está válido


