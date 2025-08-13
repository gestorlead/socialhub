/**
 * Script para executar testes de debug de upload via linha de comando
 * Execute com: node scripts/run-debug-tests.js
 */

console.log('🧪 Debug Upload Tests - Versão CLI\n')

console.log('📋 Páginas de Debug Criadas:')
console.log('   ✅ /debug-upload - Interface completa de teste')
console.log('   ✅ /api/internal/upload - Upload com logs detalhados')
console.log('   ✅ /api/debug/init-chunked-upload - Inicialização chunked')
console.log('   ✅ /api/debug/upload-chunk - Upload de chunks')
console.log('   ✅ /api/debug/finalize-chunked-upload - Finalização chunked')

console.log('\n🚀 Como usar:')
console.log('   1. Acesse http://localhost:3000/debug-upload')
console.log('   2. Clique em "Executar Bateria de Testes"')
console.log('   3. Ou selecione um arquivo e clique "Testar Arquivo"')
console.log('   4. Monitore os logs no console do navegador e servidor')

console.log('\n🔍 O que os testes fazem:')
console.log('   📊 Testam arquivos de 0.1MB até 50MB')
console.log('   ⚡ Upload direto primeiro, depois chunked se falhar')
console.log('   📝 Logs detalhados de headers, Content-Length, etc.')
console.log('   📈 Medição de tempo e taxa de sucesso')
console.log('   🎯 Identificação exata do limite que causa erro 413')

console.log('\n🧩 Estratégia de Debug:')
console.log('   1. API /internal/upload com logs maximizados')
console.log('   2. Teste progressivo de tamanhos para encontrar limite')
console.log('   3. Teste de diferentes chunk sizes se upload direto falhar')
console.log('   4. Identificação da configuração exata do servidor')

console.log('\n⚙️ APIs de Debug Isoladas:')
console.log('   🔧 /api/internal/upload:')
console.log('      - Logs detalhados de headers e payload')
console.log('      - Medição de tempo de cada etapa')
console.log('      - Identificação exata de onde falha')
console.log('')
console.log('   🧩 /api/debug/init-chunked-upload:')
console.log('      - Inicializa upload chunked')
console.log('      - Cria diretório temporário')
console.log('      - Salva metadados do upload')
console.log('')
console.log('   📦 /api/debug/upload-chunk:')
console.log('      - Recebe chunks individuais')
console.log('      - Logs de tamanho e progresso')
console.log('      - Validação de integridade')
console.log('')
console.log('   🔗 /api/debug/finalize-chunked-upload:')
console.log('      - Combina chunks em arquivo final')
console.log('      - Verificação de integridade')
console.log('      - Limpeza de arquivos temporários')

console.log('\n📊 Informações que vamos coletar:')
console.log('   🔍 Limite exato do Content-Length')
console.log('   ⏱️  Tempo de processamento por tamanho')
console.log('   🌐 Headers de resposta em caso de erro')
console.log('   💾 Uso de memória durante upload')
console.log('   🚦 Ponto exato onde ocorre erro 413')

console.log('\n🎯 Objetivos:')
console.log('   1. Identificar se o limite é do servidor web (nginx/apache)')
console.log('   2. Verificar se é configuração do Next.js')
console.log('   3. Testar se chunking resolve o problema')
console.log('   4. Encontrar chunk size ótimo')
console.log('   5. Implementar solução definitiva no app principal')

console.log('\n📈 Resultados Esperados:')
console.log('   ✅ Mapeamento completo dos limites')
console.log('   ✅ Identificação da causa do erro 413')
console.log('   ✅ Estratégia de chunk size otimizada')
console.log('   ✅ Solução implementável no app principal')

console.log('\n🚀 Próximos Passos:')
console.log('   1. Execute npm run dev')
console.log('   2. Acesse /debug-upload no navegador')
console.log('   3. Execute bateria de testes')
console.log('   4. Analise resultados nos logs')
console.log('   5. Implemente solução baseada nos achados')

function checkEnvironment() {
  console.log('\n🔧 Verificação do Ambiente:')
  
  // Verificar se estamos no diretório correto
  const fs = require('fs')
  const path = require('path')
  
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const nextConfigPath = path.join(process.cwd(), 'next.config.js')
  
  console.log(`   📂 Diretório atual: ${process.cwd()}`)
  console.log(`   📦 package.json: ${fs.existsSync(packageJsonPath) ? '✅' : '❌'}`)
  console.log(`   ⚙️  next.config.js: ${fs.existsSync(nextConfigPath) ? '✅' : '❌'}`)
  
  // Verificar se as páginas de debug existem
  const debugPagePath = path.join(process.cwd(), 'app', 'debug-upload', 'page.tsx')
  const internalApiPath = path.join(process.cwd(), 'app', 'api', 'internal', 'upload', 'route.ts')
  
  console.log(`   🧪 Debug page: ${fs.existsSync(debugPagePath) ? '✅' : '❌'}`)
  console.log(`   🔧 Internal API: ${fs.existsSync(internalApiPath) ? '✅' : '❌'}`)
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      console.log(`   📋 Projeto: ${packageJson.name}`)
      console.log(`   🏷️  Versão: ${packageJson.version}`)
    } catch (error) {
      console.log('   ❌ Erro lendo package.json')
    }
  }
}

checkEnvironment()

console.log('\n✨ Sistema de debug pronto!')
console.log('Execute npm run dev e acesse /debug-upload para começar os testes.')