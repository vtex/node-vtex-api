#!/bin/bash
# Script para atualizar dependências - Fase 1 (Baixo Risco)
# Este script atualiza as dependências com menor risco e maior benefício de performance

set -e

echo "🚀 Iniciando atualização de dependências - Fase 1 (Baixo Risco)"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Dependências a serem atualizadas:${NC}"
echo "  - axios: 1.8.4 → 1.13.2"
echo "  - agentkeepalive: 4.1.0 → 4.6.0"
echo "  - xss: 1.0.6 → 1.0.15"
echo "  - jaeger-client: 3.18.0 → 3.19.0"
echo "  - opentracing: 0.14.4 → 0.14.7"
echo "  - co-body: 6.0.0 → 6.2.0"
echo "  - qs: 6.9.1 → 6.14.0"
echo "  - ramda: 0.26.1 → 0.32.0"
echo "  - mime-types: 2.1.26 → 2.1.35"
echo "  - querystring: 0.2.0 → 0.2.1"
echo ""

read -p "Deseja continuar? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Cancelado pelo usuário"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Iniciando atualizações...${NC}"
echo ""

# Criar backup do package.json e yarn.lock
echo "📋 Criando backup de package.json e yarn.lock..."
cp package.json package.json.backup
cp yarn.lock yarn.lock.backup
echo -e "${GREEN}✓ Backup criado${NC}"
echo ""

# Atualizar dependências de produção
echo "🔧 Atualizando dependências de produção..."
yarn upgrade axios@^1.13.2
yarn upgrade agentkeepalive@^4.6.0
yarn upgrade xss@^1.0.15
yarn upgrade jaeger-client@^3.19.0
yarn upgrade opentracing@^0.14.7
yarn upgrade co-body@^6.2.0
yarn upgrade qs@^6.14.0
yarn upgrade ramda@^0.32.0
yarn upgrade mime-types@^2.1.35
yarn upgrade querystring@^0.2.1
echo -e "${GREEN}✓ Dependências de produção atualizadas${NC}"
echo ""

# Atualizar @types relacionados
echo "🔧 Atualizando types relacionados..."
yarn upgrade @types/qs@^6.14.0
yarn upgrade @types/ramda@types/npm-ramda#dist
echo -e "${GREEN}✓ Types atualizados${NC}"
echo ""

# Build
echo "🏗️  Executando build..."
if yarn build; then
    echo -e "${GREEN}✓ Build concluído com sucesso${NC}"
else
    echo -e "${RED}✗ Build falhou${NC}"
    echo "Restaurando backup..."
    cp package.json.backup package.json
    cp yarn.lock.backup yarn.lock
    yarn install
    exit 1
fi
echo ""

# Tests
echo "🧪 Executando testes..."
if yarn test; then
    echo -e "${GREEN}✓ Todos os testes passaram${NC}"
else
    echo -e "${YELLOW}⚠ Alguns testes falharam (verificar se são pré-existentes)${NC}"
    echo "Você pode verificar os logs acima para determinar se as falhas são novas."
    read -p "Deseja continuar mesmo com testes falhando? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        echo "Restaurando backup..."
        cp package.json.backup package.json
        cp yarn.lock.backup yarn.lock
        yarn install
        exit 1
    fi
fi
echo ""

# Lint
echo "🔍 Executando linter..."
if yarn lint; then
    echo -e "${GREEN}✓ Lint passou${NC}"
else
    echo -e "${YELLOW}⚠ Lint encontrou problemas${NC}"
fi
echo ""

echo -e "${GREEN}✅ Fase 1 de atualizações concluída!${NC}"
echo ""
echo "📊 Próximos passos:"
echo "  1. Revisar as mudanças no package.json e yarn.lock"
echo "  2. Testar a aplicação manualmente"
echo "  3. Executar benchmarks de performance se disponível"
echo "  4. Considerar executar update-dependencies-phase2.sh"
echo ""
echo "💾 Backups salvos em:"
echo "  - package.json.backup"
echo "  - yarn.lock.backup"
echo ""
