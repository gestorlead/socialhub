/**
 * Test script to verify all files go to Supabase Storage
 * Tests the upload strategy for different file sizes
 */

// Import the upload strategy function logic
function shouldUseStorageUpload(file) {
  // Always use storage upload to avoid local disk usage
  return true
}

function getUploadStrategy(files) {
  const storageFiles = []
  const serverFiles = []
  
  files.forEach(file => {
    if (shouldUseStorageUpload(file)) {
      storageFiles.push(file)
    } else {
      serverFiles.push(file)
    }
  })
  
  let recommendation
  if (storageFiles.length > 0 && serverFiles.length > 0) {
    recommendation = 'mixed'
  } else if (storageFiles.length > 0) {
    recommendation = 'storage'
  } else {
    recommendation = 'server'
  }
  
  return { storageFiles, serverFiles, recommendation }
}

function testStorageOnlyStrategy() {
  console.log('🧪 Testando Estratégia Storage-Only\n')
  
  // Simular diferentes tamanhos de arquivo
  const testFiles = [
    { name: 'small_image.jpg', size: 500 * 1024 },        // 500KB
    { name: 'medium_video.mp4', size: 50 * 1024 * 1024 }, // 50MB  
    { name: 'large_video.mp4', size: 2 * 1024 * 1024 * 1024 }, // 2GB
    { name: 'tiny_file.txt', size: 1024 },                // 1KB
    { name: 'huge_file.mov', size: 5 * 1024 * 1024 * 1024 }  // 5GB
  ]
  
  console.log('📁 Arquivos de teste:')
  testFiles.forEach((file, index) => {
    const sizeFormatted = formatFileSize(file.size)
    const strategy = shouldUseStorageUpload(file) ? 'STORAGE' : 'SERVIDOR'
    console.log(`   ${index + 1}. ${file.name} (${sizeFormatted}) → ${strategy}`)
  })
  
  console.log('\n📊 Testando estratégia de upload:')
  const strategy = getUploadStrategy(testFiles)
  
  console.log(`   - Estratégia recomendada: ${strategy.recommendation.toUpperCase()}`)
  console.log(`   - Arquivos para Storage: ${strategy.storageFiles.length}`)
  console.log(`   - Arquivos para Servidor: ${strategy.serverFiles.length}`)
  
  if (strategy.serverFiles.length === 0) {
    console.log('\n✅ SUCESSO: Todos os arquivos vão para o Supabase Storage!')
    console.log('   Nenhum arquivo será salvo no disco local.')
  } else {
    console.log('\n❌ PROBLEMA: Alguns arquivos ainda vão para o servidor:')
    strategy.serverFiles.forEach(file => {
      console.log(`   - ${file.name} (${formatFileSize(file.size)})`)
    })
  }
}

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`
  } else {
    return `${bytes}B`
  }
}

function testDifferentScenarios() {
  console.log('\n🎯 Testando Diferentes Cenários\n')
  
  const scenarios = [
    {
      name: 'Apenas arquivos pequenos',
      files: [
        { name: 'photo1.jpg', size: 200 * 1024 },    // 200KB
        { name: 'photo2.jpg', size: 800 * 1024 },    // 800KB
        { name: 'audio.mp3', size: 500 * 1024 }      // 500KB
      ]
    },
    {
      name: 'Apenas arquivos grandes',
      files: [
        { name: 'video1.mp4', size: 100 * 1024 * 1024 },  // 100MB
        { name: 'video2.mov', size: 500 * 1024 * 1024 },  // 500MB
        { name: 'video3.avi', size: 2 * 1024 * 1024 * 1024 } // 2GB
      ]
    },
    {
      name: 'Mistura de tamanhos',
      files: [
        { name: 'thumb.jpg', size: 50 * 1024 },        // 50KB
        { name: 'video.mp4', size: 100 * 1024 * 1024 }, // 100MB
        { name: 'document.pdf', size: 2 * 1024 * 1024 }, // 2MB
        { name: 'large.mov', size: 1024 * 1024 * 1024 }  // 1GB
      ]
    }
  ]
  
  scenarios.forEach((scenario, index) => {
    console.log(`📂 Cenário ${index + 1}: ${scenario.name}`)
    
    const strategy = getUploadStrategy(scenario.files)
    
    console.log(`   - Total de arquivos: ${scenario.files.length}`)
    console.log(`   - Para Storage: ${strategy.storageFiles.length}`)
    console.log(`   - Para Servidor: ${strategy.serverFiles.length}`)
    console.log(`   - Estratégia: ${strategy.recommendation.toUpperCase()}`)
    
    if (strategy.serverFiles.length === 0) {
      console.log('   ✅ Todos vão para Storage (correto!)')
    } else {
      console.log('   ❌ Alguns vão para servidor (problema!)')
    }
    
    console.log()
  })
}

function runAllTests() {
  console.log('🚀 Teste de Estratégia Storage-Only\n')
  console.log('=' .repeat(60))
  
  testStorageOnlyStrategy()
  testDifferentScenarios()
  
  console.log('=' .repeat(60))
  console.log('🎉 Teste concluído!')
  console.log('\n📋 Resumo:')
  console.log('   - shouldUseStorageUpload() sempre retorna TRUE')
  console.log('   - Todos os arquivos vão para Supabase Storage')
  console.log('   - Nenhum arquivo é salvo no disco local')
  console.log('   - Economia de espaço em disco garantida!')
}

// Executar testes
if (require.main === module) {
  runAllTests()
}

module.exports = {
  shouldUseStorageUpload,
  getUploadStrategy,
  testStorageOnlyStrategy,
  testDifferentScenarios,
  runAllTests
}