'use client'

import { useState, useRef } from 'react'

interface UploadTest {
  name: string
  size: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  result?: any
  error?: string
  duration?: number
  chunkSize?: number
  uploadMethod: 'direct' | 'chunked'
}

export default function PublicDebugPage() {
  const [tests, setTests] = useState<UploadTest[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setLogs(prev => [...prev, logMessage])
  }

  const addTest = (name: string, size: number, uploadMethod: 'direct' | 'chunked', chunkSize?: number) => {
    const test: UploadTest = {
      name,
      size,
      status: 'pending',
      uploadMethod,
      chunkSize
    }
    setTests(prev => [...prev, test])
    return tests.length
  }

  const updateTest = (index: number, updates: Partial<UploadTest>) => {
    setTests(prev => prev.map((test, i) => i === index ? { ...test, ...updates } : test))
  }

  // Função para criar arquivo de teste de tamanho específico
  const createTestFile = (sizeInMB: number): File => {
    const sizeInBytes = sizeInMB * 1024 * 1024
    const content = new ArrayBuffer(sizeInBytes)
    const uint8Array = new Uint8Array(content)
    
    // Preencher com dados aleatórios para simular arquivo real
    for (let i = 0; i < sizeInBytes; i += 1024) {
      const end = Math.min(i + 1024, sizeInBytes)
      for (let j = i; j < end; j++) {
        uint8Array[j] = Math.floor(Math.random() * 256)
      }
    }
    
    return new File([uint8Array], `test_${sizeInMB}MB.bin`, { type: 'application/octet-stream' })
  }

  // Upload direto - sem autenticação
  const testDirectUpload = async (file: File, testIndex: number) => {
    const startTime = Date.now()
    updateTest(testIndex, { status: 'uploading' })
    addLog(`Iniciando upload direto: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    const formData = new FormData()
    formData.append('files', file)
    formData.append('userId', 'public-debug-user')

    try {
      // Usar API pública sem autenticação
      const response = await fetch('/api/public-upload', {
        method: 'POST',
        body: formData
      })

      const duration = Date.now() - startTime
      
      if (response.ok) {
        const result = await response.json()
        addLog(`✅ Upload direto bem-sucedido: ${file.name} em ${duration}ms`)
        updateTest(testIndex, { 
          status: 'success', 
          result, 
          duration 
        })
      } else {
        const errorText = await response.text()
        addLog(`❌ Upload direto falhou: ${response.status} ${response.statusText} - ${errorText}`)
        updateTest(testIndex, { 
          status: 'error', 
          error: `${response.status}: ${errorText}`,
          duration 
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      addLog(`❌ Erro de rede no upload direto: ${error}`)
      updateTest(testIndex, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro de rede',
        duration 
      })
    }
  }

  // Upload chunked - sem autenticação
  const testChunkedUpload = async (file: File, chunkSize: number, testIndex: number) => {
    const startTime = Date.now()
    updateTest(testIndex, { status: 'uploading' })
    addLog(`Iniciando upload chunked: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) com chunks de ${chunkSize}KB`)

    const chunkSizeBytes = chunkSize * 1024
    const totalChunks = Math.ceil(file.size / chunkSizeBytes)
    
    try {
      // Primeiro, inicializar o upload chunked
      const initResponse = await fetch('/api/public-chunked/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          totalChunks,
          chunkSize: chunkSizeBytes
        })
      })

      if (!initResponse.ok) {
        throw new Error(`Falha na inicialização: ${initResponse.status}`)
      }

      const { uploadId } = await initResponse.json()
      addLog(`Upload inicializado: ID=${uploadId}, ${totalChunks} chunks`)

      // Upload de cada chunk
      const uploadedChunks = []
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSizeBytes
        const end = Math.min(start + chunkSizeBytes, file.size)
        const chunk = file.slice(start, end)

        addLog(`Enviando chunk ${chunkIndex + 1}/${totalChunks} (${chunk.size} bytes)`)

        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('uploadId', uploadId)
        formData.append('chunkIndex', chunkIndex.toString())
        formData.append('totalChunks', totalChunks.toString())

        const chunkResponse = await fetch('/api/public-chunked/upload', {
          method: 'POST',
          body: formData
        })

        if (!chunkResponse.ok) {
          throw new Error(`Falha no chunk ${chunkIndex}: ${chunkResponse.status}`)
        }

        const chunkResult = await chunkResponse.json()
        uploadedChunks.push(chunkResult)
        addLog(`✅ Chunk ${chunkIndex + 1} enviado com sucesso`)
      }

      // Finalizar upload - combinar chunks
      const finalizeResponse = await fetch('/api/public-chunked/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId })
      })

      const duration = Date.now() - startTime

      if (finalizeResponse.ok) {
        const result = await finalizeResponse.json()
        addLog(`✅ Upload chunked bem-sucedido: ${file.name} em ${duration}ms`)
        updateTest(testIndex, { 
          status: 'success', 
          result, 
          duration 
        })
      } else {
        const errorText = await finalizeResponse.text()
        throw new Error(`Falha na finalização: ${finalizeResponse.status} - ${errorText}`)
      }

    } catch (error) {
      const duration = Date.now() - startTime
      addLog(`❌ Erro no upload chunked: ${error}`)
      updateTest(testIndex, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        duration 
      })
    }
  }

  // Executar bateria de testes automatizada
  const runAutomatedTests = async () => {
    setIsRunning(true)
    setTests([])
    setLogs([])
    addLog('🚀 Iniciando bateria de testes de upload PÚBLICO')

    // Testes com tamanhos progressivos
    const testSizes = [0.1, 0.5, 0.8, 1, 2, 5, 10, 20, 50] // MB
    const chunkSizes = [100, 400, 800] // KB

    for (const sizeMB of testSizes) {
      const file = createTestFile(sizeMB)
      
      // Teste upload direto
      const directTestIndex = addTest(`Direct Upload ${sizeMB}MB`, file.size, 'direct')
      await testDirectUpload(file, directTestIndex)
      
      // Aguardar um pouco entre testes
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Se o upload direto falhou com erro 413, testar chunked
      const directTest = tests[directTestIndex]
      if (directTest?.status === 'error' && directTest.error?.includes('413')) {
        addLog(`Upload direto falhou com 413, testando chunked para ${sizeMB}MB`)
        
        for (const chunkSize of chunkSizes) {
          const chunkedTestIndex = addTest(`Chunked Upload ${sizeMB}MB (${chunkSize}KB chunks)`, file.size, 'chunked', chunkSize)
          await testChunkedUpload(file, chunkSize, chunkedTestIndex)
          
          // Se funcionou, não precisa testar chunks menores
          const chunkedTest = tests[chunkedTestIndex]
          if (chunkedTest?.status === 'success') {
            addLog(`✅ Encontrado chunk size funcional: ${chunkSize}KB para arquivos de ${sizeMB}MB`)
            break
          }
          
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    addLog('🏁 Bateria de testes concluída')
    setIsRunning(false)
  }

  // Teste com arquivo selecionado pelo usuário
  const testSelectedFile = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      addLog('❌ Nenhum arquivo selecionado')
      return
    }

    setIsRunning(true)
    addLog(`🔍 Testando arquivo selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // Teste direto primeiro
    const directTestIndex = addTest(`User File Direct: ${file.name}`, file.size, 'direct')
    await testDirectUpload(file, directTestIndex)

    // Se falhou, testar chunked
    const directTest = tests[directTestIndex]
    if (directTest?.status === 'error') {
      addLog('Upload direto falhou, testando chunked...')
      const chunkedTestIndex = addTest(`User File Chunked: ${file.name}`, file.size, 'chunked', 400)
      await testChunkedUpload(file, 400, chunkedTestIndex)
    }

    setIsRunning(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🧪 Debug Upload PÚBLICO - Sem Autenticação
        </h1>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>⚠️ PÁGINA PÚBLICA</strong> - Esta página não requer autenticação e usa APIs específicas para debug.
                Acesso direto via IP: <code>http://192.99.35.46:3001/public-debug</code>
              </p>
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Controles de Teste</h2>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <button
              onClick={runAutomatedTests}
              disabled={isRunning}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-gray-400"
            >
              {isRunning ? '🔄 Executando...' : '🚀 Executar Bateria de Testes'}
            </button>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <button
                onClick={testSelectedFile}
                disabled={isRunning}
                className="bg-green-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400"
              >
                🔍 Testar Arquivo
              </button>
            </div>

            <button
              onClick={() => { setTests([]); setLogs([]) }}
              disabled={isRunning}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400"
            >
              🗑️ Limpar
            </button>
          </div>

          <p className="text-sm text-gray-600">
            Este teste é completamente isolado e usa APIs públicas sem autenticação. 
            Detectará automaticamente o limite exato do servidor.
          </p>
        </div>

        {/* Resultados dos Testes */}
        {tests.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">📊 Resultados dos Testes</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left">Teste</th>
                    <th className="px-4 py-2 text-left">Tamanho</th>
                    <th className="px-4 py-2 text-left">Método</th>
                    <th className="px-4 py-2 text-left">Chunk Size</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Duração</th>
                    <th className="px-4 py-2 text-left">Resultado/Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2 font-mono text-sm">{test.name}</td>
                      <td className="px-4 py-2">{formatSize(test.size)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          test.uploadMethod === 'direct' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {test.uploadMethod}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {test.chunkSize ? `${test.chunkSize}KB` : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          test.status === 'success' ? 'bg-green-100 text-green-800' :
                          test.status === 'error' ? 'bg-red-100 text-red-800' :
                          test.status === 'uploading' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {test.status === 'success' ? '✅ Sucesso' :
                           test.status === 'error' ? '❌ Erro' :
                           test.status === 'uploading' ? '🔄 Enviando' :
                           '⏳ Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-2">{formatDuration(test.duration)}</td>
                      <td className="px-4 py-2 max-w-xs truncate">
                        {test.status === 'error' ? (
                          <span className="text-red-600 text-sm">{test.error}</span>
                        ) : test.status === 'success' ? (
                          <span className="text-green-600 text-sm">
                            {test.result?.message || 'Upload concluído'}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-black rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-white mb-4">📝 Logs Detalhados</h2>
            
            <div className="bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {logs.join('\n')}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}