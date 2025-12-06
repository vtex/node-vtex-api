#!/bin/bash
# Script para atualizar dependências - Fase 2 (Médio Risco)
# Este script atualiza dependências que requerem mais testes mas têm bom potencial de melhoria

set -e

echo "🚀 Iniciando atualização de dependências - Fase 2 (Médio Risco)"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Dependências a serem atualizadas:${NC}"
echo "  - lru-cache: 5.1.1 → 7.18.3"
echo "  - prom-client: 14.2.0 → 15.1.3"
echo "  - axios-retry: 3.1.2 → 4.5.0"
echo "  - p-limit: 2.2.2 → 3.1.0"
echo "  - semver: 5.7.2 → 7.7.3"
echo "  - dataloader: 1.4.0 → 2.2.3"
echo "  - archiver: 3.1.1 → 7.0.1"
echo "  - fs-extra: 7.0.1 → 11.3.2"
echo "  - tar-fs: 2.0.0 → 3.1.1"
echo "  - bluebird: 3.5.4 → 3.7.2"
echo ""
echo -e "${RED}⚠️  AVISO: Esta fase inclui updates com maior potencial de breaking changes${NC}"
echo -e "${RED}   Recomenda-se testar extensivamente após esta atualização${NC}"
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
cp package.json package.json.backup.phase2
cp yarn.lock yarn.lock.backup.phase2
echo -e "${GREEN}✓ Backup criado${NC}"
echo ""

# Atualizar dependências
echo "🔧 Atualizando dependências..."
echo ""

echo "  → Atualizando lru-cache (IMPORTANTE: Verificar mudanças de API)..."
yarn upgrade lru-cache@^7.18.3
yarn upgrade @types/lru-cache@^7.10.10

echo "  → Atualizando prom-client..."
yarn upgrade prom-client@^15.1.3

echo "  → Atualizando axios-retry (requer axios atualizado)..."
yarn upgrade axios-retry@^4.5.0

echo "  → Atualizando p-limit..."
yarn upgrade p-limit@^3.1.0

echo "  → Atualizando semver..."
yarn upgrade semver@^7.7.3
yarn upgrade @types/semver@^7.7.1

echo "  → Atualizando dataloader..."
yarn upgrade dataloader@^2.2.3

echo "  → Atualizando archiver..."
yarn upgrade archiver@^7.0.1
yarn upgrade @types/archiver@^7.0.0

echo "  → Atualizando fs-extra..."
yarn upgrade fs-extra@^11.3.2
yarn upgrade @types/fs-extra@^11.0.4

echo "  → Atualizando tar-fs..."
yarn upgrade tar-fs@^3.1.1

echo "  → Atualizando bluebird..."
yarn upgrade bluebird@^3.7.2
yarn upgrade @types/bluebird@^3.5.42

echo -e "${GREEN}✓ Dependências atualizadas${NC}"
echo ""

# Build
echo "🏗️  Executando build..."
if yarn build; then
    echo -e "${GREEN}✓ Build concluído com sucesso${NC}"
else
    echo -e "${RED}✗ Build falhou - Restaurando backup...${NC}"
    cp package.json.backup.phase2 package.json
    cp yarn.lock.backup.phase2 yarn.lock
    yarn install
    exit 1
fi
echo ""

# Tests
echo "🧪 Executando testes..."
if yarn test; then
    echo -e "${GREEN}✓ Todos os testes passaram${NC}"
else
    echo -e "${RED}✗ Alguns testes falharam${NC}"
    echo ""
    echo "Por favor, revise os erros de teste acima."
    echo "Problemas comuns:"
    echo "  - lru-cache: API changes (max, length, dispose, etc.)"
    echo "  - semver: Mudanças em parsing e comparação"
    echo "  - axios-retry: Mudanças em configuração"
    echo ""
    read -p "Deseja manter as mudanças mesmo com testes falhando? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
        echo "Restaurando backup..."
        cp package.json.backup.phase2 package.json
        cp yarn.lock.backup.phase2 yarn.lock
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
    echo -e "${YELLOW}⚠ Lint encontrou problemas (revise manualmente)${NC}"
fi
echo ""

echo -e "${GREEN}✅ Fase 2 de atualizações concluída!${NC}"
echo ""
echo "📊 Próximos passos IMPORTANTES:"
echo "  1. ⚠️  REVISAR uso de lru-cache - API pode ter mudado"
echo "  2. Testar funcionalidades que usam caching extensivamente"
echo "  3. Testar funcionalidades que usam semver"
echo "  4. Executar benchmarks de performance"
echo "  5. Testar em ambiente de staging antes de produção"
echo ""
echo "💾 Backups salvos em:"
echo "  - package.json.backup.phase2"
echo "  - yarn.lock.backup.phase2"
echo ""
echo "📚 Consultar:"
echo "  - https://github.com/isaacs/node-lru-cache#breaking-changes (lru-cache v7)"
echo "  - https://github.com/npm/node-semver/blob/main/CHANGELOG.md (semver v7)"
echo ""
