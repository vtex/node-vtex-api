#!/bin/bash

# Script para renomear temporariamente os arquivos de definição de tipos do Axios
# para permitir a utilização da nossa definição personalizada

AXIOS_TYPES_FILE="./node_modules/axios/index.d.ts"
BACKUP_FILE="./node_modules/axios/index.d.ts.bak"

# Função para restaurar o arquivo original
restore_original() {
  if [ -f "$BACKUP_FILE" ]; then
    echo "Restaurando arquivo de tipos original do Axios"
    mv "$BACKUP_FILE" "$AXIOS_TYPES_FILE"
  fi
}

# Verifica se estamos executando o backup ou a restauração
if [ "$1" == "restore" ]; then
  restore_original
  exit 0
fi

# Verifica se o arquivo de definição de tipos existe
if [ -f "$AXIOS_TYPES_FILE" ]; then
  echo "Fazendo backup do arquivo de tipos do Axios"
  # Faz backup do arquivo original
  mv "$AXIOS_TYPES_FILE" "$BACKUP_FILE"

  # Cria um arquivo vazio no lugar
  echo "// Este arquivo foi substituído por uma definição personalizada em src/typings/axios.d.ts" > "$AXIOS_TYPES_FILE"
  echo "// O arquivo original foi salvo como index.d.ts.bak" >> "$AXIOS_TYPES_FILE"
  echo "export {};" >> "$AXIOS_TYPES_FILE"

  echo "Arquivo de tipos do Axios substituído com sucesso"
else
  echo "Arquivo de tipos do Axios não encontrado em $AXIOS_TYPES_FILE"
  exit 1
fi
