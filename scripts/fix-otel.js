#!/usr/bin/env node

/**
 * Este script corrige as definições de tipos do @opentelemetry/sdk-metrics para compatibilidade com TypeScript 3.9.x
 * O problema está no uso de getters em interfaces, que não são suportados corretamente pelo TS 3.9.x
 */

const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de definição de tipos problemático
const typesFilePath = path.resolve(
  __dirname,
  '../node_modules/@opentelemetry/sdk-metrics/build/src/aggregator/exponential-histogram/mapping/types.d.ts'
);
console.log('Caminho do arquivo de definições de tipos:', typesFilePath);

// Verifica se o arquivo existe
if (fs.existsSync(typesFilePath)) {
  console.log('Corrigindo definições de tipos do @opentelemetry/sdk-metrics para compatibilidade com TS 3.9.x...');

  // Lê o conteúdo atual do arquivo
  let content = fs.readFileSync(typesFilePath, 'utf8');

  // Substitui a sintaxe do getter por uma propriedade regular
  const fixedContent = content.replace(
    /get scale\(\): number;/g,
    'scale: number;'
  );

  // Salva o arquivo modificado
  fs.writeFileSync(typesFilePath, fixedContent, 'utf8');

  console.log('Type definitions have been successfully fixed');
} else {
  console.log('The @opentelemetry/sdk-metrics type definition file was not found');
}
