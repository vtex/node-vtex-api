/**
 * Exemplo de integração do client VBase no middleware do Next.js
 *
 * Este arquivo mostra como criar e usar o client VBase no middleware do Next.js
 *
 * PRÉ-REQUISITOS:
 * 1. Instalar dependências:
 *    npm install @vtex/api uuid
 *    # ou
 *    yarn add @vtex/api uuid
 *
 * 2. Configurar variáveis de ambiente no .env.local:
 *    VTEX_ACCOUNT=seu-account
 *    VTEX_WORKSPACE=master (ou outro workspace)
 *    VTEX_AUTH_TOKEN=seu-token-de-autenticacao
 *    VTEX_APP_ID=vendor.app-name@major-version (necessário para VBase funcionar)
 *    VTEX_REGION=aws-us-east-1 (opcional)
 */

import { VBase } from '@vtex/api/lib/clients/infra/VBase'
import { Logger } from '@vtex/api/lib/service/logger/logger'
import { TracerSingleton } from '@vtex/api/lib/service/tracing/TracerSingleton'
import { IOContext } from '@vtex/api/lib/service/worker/runtime/typings'
import { UserLandTracer } from '@vtex/api/lib/tracing/UserLandTracer'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

/**
 * Cria um IOContext mínimo para uso no middleware do Next.js
 *
 * @param request - Requisição do Next.js
 * @param options - Opções adicionais (account, workspace, region)
 * @returns IOContext criado
 */
export function createVBaseContext(
  request: NextRequest,
  options: {
    account: string
    workspace: string
    region?: string
    authToken?: string
  }
): IOContext {
  const requestId = request.headers.get('x-request-id') || uuidv4()
  const operationId = request.headers.get('x-operation-id') || uuidv4()

  // Verifica se VTEX_APP_ID está configurado (necessário para VBase)
  if (!process.env.VTEX_APP_ID) {
    throw new Error(
      'VTEX_APP_ID não está configurado. Configure a variável de ambiente VTEX_APP_ID com o formato: vendor.app-name@major-version'
    )
  }

  // Cria um logger básico
  const logger = new Logger({
    account: options.account,
    workspace: options.workspace,
    requestId,
    operationId,
    production: options.workspace === 'master',
  })

  // Cria um tracer básico
  // Nota: TracerSingleton requer algumas variáveis de ambiente do VTEX IO
  // Em ambientes Next.js, pode ser necessário criar um tracer mock ou simplificado
  let userlandTracer: UserLandTracer
  try {
    const tracer = TracerSingleton.getTracer()
    userlandTracer = new UserLandTracer(tracer)
  } catch (error) {
    // Fallback: cria um tracer básico sem dependências do ambiente VTEX IO
    // Você pode precisar criar uma implementação mock do tracer para desenvolvimento
    console.warn('Falha ao inicializar tracer:', error)
    const MockTracer = require('@tiagonapoli/opentracing-alternate-mock').MockTracer
    const mockTracer = new MockTracer()
    userlandTracer = new UserLandTracer(mockTracer)
  }

  // Retorna o contexto mínimo necessário
  return {
    account: options.account,
    workspace: options.workspace,
    region: options.region || process.env.VTEX_REGION || 'aws-us-east-1',
    authToken: options.authToken || process.env.VTEX_AUTH_TOKEN || '',
    platform: options.account.startsWith('gc-') ? 'gocommerce' : 'vtex',
    production: options.workspace === 'master',
    product: process.env.VTEX_PRODUCT || '',
    userAgent: process.env.VTEX_APP_ID || '',
    requestId,
    operationId,
    logger,
    tracer: userlandTracer,
    route: {
      id: request.nextUrl.pathname,
      params: {},
      type: 'public',
    },
  }
}

/**
 * Cria uma instância do client VBase
 *
 * @param context - IOContext criado
 * @returns Instância do VBase client
 */
export function createVBaseClient(context: IOContext): VBase {
  return new VBase(context)
}

/**
 * ============================================================================
 * EXEMPLOS DE USO NO MIDDLEWARE DO NEXT.JS
 * ============================================================================
 *
 * Copie e cole o código abaixo em um arquivo middleware.ts na raiz do seu projeto Next.js
 */

// ============================================================================
// EXEMPLO 1: Buscar dados do VBase e injetar na requisição
// ============================================================================
export async function middlewareExample1(request: NextRequest) {
  // Extrair account e workspace
  const account =
    request.headers.get('x-vtex-account') ||
    request.nextUrl.searchParams.get('account') ||
    process.env.VTEX_ACCOUNT ||
    ''

  const workspace =
    request.headers.get('x-vtex-workspace') ||
    request.nextUrl.searchParams.get('workspace') ||
    process.env.VTEX_WORKSPACE ||
    'master'

  if (!account) {
    return NextResponse.next() // Continua sem fazer nada se não houver account
  }

  try {
    // Criar contexto e client
    const context = createVBaseContext(request, {
      account,
      workspace,
      authToken: request.headers.get('x-vtex-credential') || process.env.VTEX_AUTH_TOKEN,
    })
    const vbase = createVBaseClient(context)

    // Buscar configurações do VBase
    const bucket = 'app-config'
    const filePath = 'settings.json'
    const config = await vbase.getJSON<{ featureFlags: string[] }>(bucket, filePath, true)

    if (config) {
      // Adicionar dados do VBase como headers customizados
      const response = NextResponse.next()
      response.headers.set('x-app-config', JSON.stringify(config))
      return response
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Erro ao buscar do VBase:', error)
    return NextResponse.next()
  }
}

// ============================================================================
// EXEMPLO 2: Buscar conteúdo específico baseado na rota
// ============================================================================
export async function middlewareExample2(request: NextRequest) {
  const account = request.headers.get('x-vtex-account') || process.env.VTEX_ACCOUNT || ''
  const workspace = request.headers.get('x-vtex-workspace') || process.env.VTEX_WORKSPACE || 'master'

  if (!account) {
    return NextResponse.next()
  }

  try {
    const context = createVBaseContext(request, { account, workspace })
    const vbase = createVBaseClient(context)

    const pathname = request.nextUrl.pathname

    // Exemplo: buscar configuração de localização baseada na rota
    if (pathname.startsWith('/produto/')) {
      const locale = request.headers.get('x-vtex-locale') || 'pt-BR'
      const bucket = 'translations'
      const translations = await vbase.getJSON<Record<string, string>>(bucket, `translations-${locale}.json`, true)

      if (translations) {
        const response = NextResponse.next()
        response.headers.set('x-translations', JSON.stringify(translations))
        return response
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Erro no middleware:', error)
    return NextResponse.next()
  }
}

// ============================================================================
// EXEMPLO 3: Cache de dados do VBase com revalidação
// ============================================================================
const vbaseCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minuto

export async function middlewareExample3(request: NextRequest) {
  const account = request.headers.get('x-vtex-account') || process.env.VTEX_ACCOUNT || ''
  const workspace = request.headers.get('x-vtex-workspace') || process.env.VTEX_WORKSPACE || 'master'

  if (!account) {
    return NextResponse.next()
  }

  try {
    const cacheKey = `${account}-${workspace}-config`
    const cached = vbaseCache.get(cacheKey)

    // Retornar do cache se ainda válido
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const response = NextResponse.next()
      response.headers.set('x-cached-config', 'true')
      response.headers.set('x-config', JSON.stringify(cached.data))
      return response
    }

    // Buscar do VBase
    const context = createVBaseContext(request, { account, workspace })
    const vbase = createVBaseClient(context)

    const config = await vbase.getJSON('app-config', 'settings.json', true)

    if (config) {
      // Atualizar cache
      vbaseCache.set(cacheKey, { data: config, timestamp: Date.now() })

      const response = NextResponse.next()
      response.headers.set('x-config', JSON.stringify(config))
      return response
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Erro no middleware:', error)
    return NextResponse.next()
  }
}

// ============================================================================
// EXEMPLO 4: Buscar e listar arquivos de um bucket
// ============================================================================
export async function middlewareExample4(request: NextRequest) {
  const account = request.headers.get('x-vtex-account') || process.env.VTEX_ACCOUNT || ''
  const workspace = request.headers.get('x-vtex-workspace') || process.env.VTEX_WORKSPACE || 'master'

  if (!account) {
    return NextResponse.next()
  }

  try {
    const context = createVBaseContext(request, { account, workspace })
    const vbase = createVBaseClient(context)

    // Listar arquivos de um bucket
    const bucket = 'app-assets'
    const files = await vbase.listFiles(bucket)

    // Processar arquivos encontrados
    if (files?.data) {
      const response = NextResponse.next()
      response.headers.set('x-bucket-files-count', files.data.length.toString())
      response.headers.set('x-bucket-files', JSON.stringify(files.data.map((f) => f.path)))
      return response
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Erro ao listar arquivos:', error)
    return NextResponse.next()
  }
}

// ============================================================================
// EXEMPLO COMPLETO: Implementação prática para usar no middleware.ts
// ============================================================================
export async function middleware(request: NextRequest) {
  // Extrair informações da requisição
  const account =
    request.headers.get('x-vtex-account') ||
    request.nextUrl.searchParams.get('account') ||
    process.env.VTEX_ACCOUNT ||
    ''

  const workspace =
    request.headers.get('x-vtex-workspace') ||
    request.nextUrl.searchParams.get('workspace') ||
    process.env.VTEX_WORKSPACE ||
    'master'

  // Opção alternativa: extrair do host (ex: myaccount.vtexcommercestable.com.br)
  // const host = request.headers.get('host') || ''
  // const hostParts = host.split('.')
  // const accountFromHost = hostParts.length > 0 ? hostParts[0] : ''

  if (!account) {
    // Se não houver account, continua normalmente (não é obrigatório em todos os casos)
    return NextResponse.next()
  }

  try {
    // Criar contexto VTEX
    const context = createVBaseContext(request, {
      account,
      workspace,
      authToken: request.headers.get('x-vtex-credential') || process.env.VTEX_AUTH_TOKEN,
    })

    // Criar client VBase
    const vbase = createVBaseClient(context)

    // Exemplo prático: buscar configuração da aplicação
    const bucket = 'app-config' // Nome do seu bucket
    const filePath = 'settings.json' // Caminho do arquivo

    const config = await vbase.getJSON<Record<string, any>>(bucket, filePath, true)

    // Criar resposta e adicionar headers com os dados do VBase
    const response = NextResponse.next()

    if (config) {
      response.headers.set('x-vbase-config', JSON.stringify(config))

      // Exemplo: usar os dados para modificar a requisição
      // Você pode adicionar mais lógica aqui baseada nos dados do VBase
    }

    return response
  } catch (error: any) {
    // Log do erro para debug
    console.error('Erro no middleware VBase:', {
      message: error?.message,
      stack: error?.stack,
      account,
      workspace,
    })

    // Em caso de erro, você pode:
    // 1. Retornar erro 500: return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    // 2. Redirecionar: return NextResponse.redirect(new URL('/error', request.url))
    // 3. Continuar normalmente (recomendado para não quebrar o site):
    return NextResponse.next()
  }
}

// ============================================================================
// CONFIGURAÇÃO DO MIDDLEWARE
// ============================================================================
// Configure quais rotas devem passar pelo middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',

    // Ou seja mais específico:
    // '/produto/:path*',
    // '/categoria/:path*',
  ],
}
