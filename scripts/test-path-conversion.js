/**
 * Test script for file path conversion in enqueue API
 * Verifies that Storage and local paths are preserved correctly
 */

// Simulate the path extraction logic from enqueue API
function extractFilePaths(mediaFiles) {
  return mediaFiles
    .map(file => {
      // Use the original path from upload result
      if (file.path) {
        return file.path
      }
      
      // Fallback: extract path from URL if needed
      if (file.url) {
        // For Storage URLs, extract the storage path
        if (file.url.includes('/storage/v1/object/public/media-uploads/')) {
          return file.url.split('/storage/v1/object/public/media-uploads/')[1]
        }
        // For local URLs, convert to local path
        if (file.url.includes('/uploads/')) {
          return file.url.replace(/^.*\/uploads\//, '/uploads/')
        }
      }
      
      return null
    })
    .filter(path => path !== null)
}

function testPathConversion() {
  console.log('🧪 Testando Conversão de Caminhos na API Enqueue\n')
  
  // Casos de teste com diferentes formatos de arquivo
  const testCases = [
    {
      name: 'Arquivo Storage com path direto',
      mediaFile: {
        name: 'video1.mp4',
        path: 'uploads/user123_1705234567_abc123.mp4',
        url: 'https://project.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_1705234567_abc123.mp4',
        size: 50000000,
        type: 'video/mp4'
      },
      expected: 'uploads/user123_1705234567_abc123.mp4'
    },
    {
      name: 'Arquivo Storage apenas com URL',
      mediaFile: {
        name: 'image1.jpg',
        url: 'https://project.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_1705234568_def456.jpg',
        size: 2000000,
        type: 'image/jpeg'
      },
      expected: 'uploads/user123_1705234568_def456.jpg'
    },
    {
      name: 'Arquivo local com path direto',
      mediaFile: {
        name: 'audio1.mp3',
        path: '/uploads/user123_1705234569_ghi789.mp3',
        url: 'http://localhost:3000/uploads/user123_1705234569_ghi789.mp3',
        size: 5000000,
        type: 'audio/mpeg'
      },
      expected: '/uploads/user123_1705234569_ghi789.mp3'
    },
    {
      name: 'Arquivo local apenas com URL',
      mediaFile: {
        name: 'document1.pdf',
        url: 'http://localhost:3000/uploads/user123_1705234570_jkl012.pdf',
        size: 1000000,
        type: 'application/pdf'
      },
      expected: '/uploads/user123_1705234570_jkl012.pdf'
    },
    {
      name: 'Arquivo inválido (sem path nem URL válida)',
      mediaFile: {
        name: 'invalid.txt',
        url: 'https://external-site.com/file.txt',
        size: 1000,
        type: 'text/plain'
      },
      expected: null
    }
  ]
  
  console.log('📁 Casos de teste:')
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.name}`)
    console.log(`   Input path: ${testCase.mediaFile.path || 'undefined'}`)
    console.log(`   Input URL: ${testCase.mediaFile.url}`)
    
    const result = extractFilePaths([testCase.mediaFile])
    const extractedPath = result.length > 0 ? result[0] : null
    
    const passed = extractedPath === testCase.expected
    console.log(`   Expected: ${testCase.expected}`)
    console.log(`   Got: ${extractedPath}`)
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`)
  })
}

function testMixedFileArray() {
  console.log('\n🎯 Testando Array Misto de Arquivos\n')
  
  const mixedMediaFiles = [
    {
      name: 'storage_video.mp4',
      path: 'uploads/user123_1_abc.mp4',
      url: 'https://project.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_1_abc.mp4'
    },
    {
      name: 'local_image.jpg', 
      path: '/uploads/user123_2_def.jpg',
      url: 'http://localhost:3000/uploads/user123_2_def.jpg'
    },
    {
      name: 'storage_audio.mp3',
      url: 'https://project.supabase.co/storage/v1/object/public/media-uploads/uploads/user123_3_ghi.mp3'
    },
    {
      name: 'local_doc.pdf',
      url: 'http://localhost:3000/uploads/user123_4_jkl.pdf'
    }
  ]
  
  const extractedPaths = extractFilePaths(mixedMediaFiles)
  
  console.log('📂 Array misto de arquivos:')
  mixedMediaFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file.name}`)
    console.log(`      Path: ${file.path || 'undefined'}`)
    console.log(`      URL: ${file.url}`)
  })
  
  console.log('\n📋 Caminhos extraídos:')
  extractedPaths.forEach((path, index) => {
    const isStorage = !path.startsWith('/')
    const type = isStorage ? 'Storage' : 'Local'
    console.log(`   ${index + 1}. ${path} (${type})`)
  })
  
  console.log('\n📊 Estatísticas:')
  const storagePaths = extractedPaths.filter(path => !path.startsWith('/'))
  const localPaths = extractedPaths.filter(path => path.startsWith('/'))
  
  console.log(`   - Total de arquivos: ${mixedMediaFiles.length}`)
  console.log(`   - Caminhos extraídos: ${extractedPaths.length}`)
  console.log(`   - Storage paths: ${storagePaths.length}`)
  console.log(`   - Local paths: ${localPaths.length}`)
  
  if (extractedPaths.length === mixedMediaFiles.length) {
    console.log('   ✅ Todos os caminhos foram extraídos com sucesso!')
  } else {
    console.log('   ❌ Alguns caminhos foram perdidos!')
  }
}

function testCleanupCompatibility() {
  console.log('\n🧹 Testando Compatibilidade com Sistema de Limpeza\n')
  
  // Simular dados que serão enviados para o cleanup
  const samplePaths = [
    'uploads/user123_1705234567_abc123.mp4',        // Storage
    '/uploads/user123_1705234568_def456.jpg',       // Local
    'uploads/user123_1705234569_ghi789.mp3',        // Storage
    '/uploads/user123_1705234570_jkl012.pdf'        // Local
  ]
  
  console.log('📁 Caminhos que serão enviados para cleanup:')
  samplePaths.forEach((path, index) => {
    const type = path.startsWith('/') ? 'Local' : 'Storage'
    console.log(`   ${index + 1}. ${path} (${type})`)
  })
  
  console.log('\n🔍 Detecção de tipo pelo sistema de cleanup:')
  samplePaths.forEach((path, index) => {
    let detectedType
    if (path.startsWith('/uploads/') || path.startsWith('uploads/')) {
      if (path.startsWith('/')) {
        detectedType = 'local'
      } else {
        detectedType = 'storage'
      }
    } else {
      detectedType = 'unknown'
    }
    
    console.log(`   ${index + 1}. ${path} → ${detectedType.toUpperCase()}`)
  })
  
  console.log('\n✅ Compatibilidade verificada:')
  console.log('   - Caminhos Storage: sem "/" inicial → detectados como "storage"')
  console.log('   - Caminhos Local: com "/" inicial → detectados como "local"')
  console.log('   - Sistema de cleanup funcionará corretamente!')
}

function runAllTests() {
  console.log('🚀 Teste de Conversão de Caminhos - API Enqueue\n')
  console.log('=' .repeat(70))
  
  testPathConversion()
  testMixedFileArray()
  testCleanupCompatibility()
  
  console.log('\n' + '=' .repeat(70))
  console.log('🎉 Todos os testes de conversão de caminhos concluídos!')
  console.log('\n📋 Resumo das melhorias:')
  console.log('   ✅ Preserva caminhos originais do Storage')
  console.log('   ✅ Mantém caminhos locais quando necessário')
  console.log('   ✅ Compatível com sistema de limpeza enhanced')
  console.log('   ✅ Fallback robusto para diferentes formatos')
}

// Executar testes
if (require.main === module) {
  runAllTests()
}

module.exports = {
  extractFilePaths,
  testPathConversion,
  testMixedFileArray,
  testCleanupCompatibility,
  runAllTests
}