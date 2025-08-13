# Sistema de Fila de Publicações

Sistema de filas robusto para processamento em background de publicações em redes sociais, implementado com Supabase pgmq e Realtime.

## Visão Geral

O sistema substitui o processamento sequencial anterior por um sistema de filas que permite:

- ✅ **Background Processing**: Publicações processadas em segundo plano
- ✅ **Real-time Updates**: Status atualizado instantaneamente via Supabase Realtime
- ✅ **Queue Management**: Controle de filas com pgmq (PostgreSQL Message Queue)
- ✅ **Retry Logic**: Tentativas automáticas para jobs que falharam
- ✅ **Timeout Protection**: Jobs presos são automaticamente liberados
- ✅ **Concurrent Processing**: Até 5 jobs simultâneos para melhor performance

## Arquitetura

### Componentes Principais

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PublishButton │────▶│ /api/publications│────▶│  publication_jobs│
│                 │    │    /enqueue      │    │     table       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ usePublication  │◀───│  Supabase       │◀───│     pgmq        │
│    Status       │    │  Realtime       │    │     queue       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                               ┌─────────────────┐    ┌─────────────────┐
                               │    pg_cron      │────▶│ /api/internal/  │
                               │  (every 10s)    │    │process-publication│
                               └─────────────────┘    └─────────────────┘
```

### Fluxo de Dados

1. **Frontend**: Usuário clica em "Publicar"
2. **Upload**: Arquivos são enviados para o servidor
3. **Enqueue**: Jobs são criados na tabela `publication_jobs` e adicionados à fila pgmq
4. **Processing**: pg_cron executa a cada 10 segundos e processa jobs da fila
5. **Updates**: Status dos jobs é atualizado em tempo real via Realtime
6. **Frontend**: Interface atualiza automaticamente conforme jobs são processados

## Estrutura do Banco de Dados

### Tabela `publication_jobs`

```sql
CREATE TABLE publication_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'x', 'linkedin')),
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  platform_response jsonb,
  metadata jsonb DEFAULT '{}'::jsonb
);
```

### Extensões Necessárias

```sql
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Fila pgmq

```sql
SELECT pgmq.create('publication_queue');
```

## APIs

### `/api/publications/enqueue` (POST)

Cria jobs de publicação e os adiciona à fila.

**Request:**
```json
{
  "userId": "uuid",
  "selectedOptions": ["tiktok_video", "instagram_feed"],
  "mediaFiles": [
    {
      "name": "video.mp4",
      "size": 1024000,
      "type": "video/mp4",
      "url": "https://..."
    }
  ],
  "captions": {
    "universal": "Legenda universal",
    "specific": {
      "tiktok_video": "Legenda específica para TikTok"
    }
  },
  "settings": {
    "tiktok_video": {
      "privacy": "PUBLIC_TO_EVERYONE",
      "allowComments": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully enqueued 2 publication job(s)",
  "data": {
    "jobs": [
      {
        "job_id": "job-uuid-1",
        "platform": "tiktok_video",
        "status": "pending"
      },
      {
        "job_id": "job-uuid-2", 
        "platform": "instagram_feed",
        "status": "pending"
      }
    ],
    "totalEnqueued": 2,
    "totalRequested": 2
  }
}
```

### `/api/internal/process-publication` (POST)

API interna chamada pelo pg_cron para processar jobs.

**Request:**
```json
{
  "job_id": "uuid",
  "user_id": "uuid",
  "platform": "tiktok_video",
  "content": {
    "mediaFiles": [...],
    "caption": "...",
    "settings": {...}
  }
}
```

## Hooks React

### `usePublicationStatus`

Hook para acompanhar status de jobs em tempo real.

```tsx
import { usePublicationStatus } from '@/hooks/usePublicationStatus'

function MyComponent() {
  const { jobs, statusByPlatform, totalJobs, completedJobs } = usePublicationStatus({
    jobIds: ['job1', 'job2'], // opcional - rastrear jobs específicos
    autoFetch: true,
    trackingDurationMinutes: 10
  })

  return (
    <div>
      <p>Total de jobs: {totalJobs}</p>
      <p>Concluídos: {completedJobs}</p>
      
      {Object.entries(statusByPlatform).map(([platform, status]) => (
        <div key={platform}>
          {platform}: {status}
        </div>
      ))}
    </div>
  )
}
```

## Configuração de Produção

### Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Configurações do pg_cron

O sistema cria automaticamente os seguintes jobs de cron:

1. **Processamento de jobs**: A cada 10 segundos
2. **Retry de jobs falhados**: A cada 5 minutos  
3. **Limpeza de jobs antigos**: Diariamente às 2h

### RLS (Row Level Security)

```sql
-- Usuários podem ver apenas seus próprios jobs
CREATE POLICY "Users can view own publication jobs" 
  ON publication_jobs FOR SELECT 
  USING (auth.uid() = user_id);

-- Usuários podem criar jobs para si mesmos
CREATE POLICY "Users can insert own publication jobs" 
  ON publication_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Sistema pode atualizar jobs (para processamento)
CREATE POLICY "System can update publication jobs" 
  ON publication_jobs FOR UPDATE 
  USING (true);
```

## Monitoramento

### Métricas da Fila

```sql
-- Ver status atual da fila
SELECT * FROM pgmq.metrics('publication_queue');

-- Ver jobs por status
SELECT status, COUNT(*) 
FROM publication_jobs 
WHERE created_at > now() - interval '1 hour'
GROUP BY status;

-- Ver jobs em processamento há muito tempo
SELECT id, platform, started_at, now() - started_at as duration
FROM publication_jobs 
WHERE status = 'processing' 
  AND started_at < now() - interval '30 minutes';
```

### Logs Importantes

- Jobs criados: `[Publications Enqueue API] Job created successfully`
- Jobs processados: `[Process Publication API] Job completed successfully`
- Erros: `[Process Publication API] Job failed`
- Realtime: `[usePublicationStatus] Realtime update`

## Solução de Problemas

### Jobs Presos em "processing"

Jobs que ficam em processamento por mais de 30 minutos são automaticamente marcados como falhados pelo sistema.

### Jobs Falhando Repetidamente

Verifique:
1. Tokens de acesso das plataformas
2. Configurações de rate limiting
3. Logs da API de processamento interno

### Realtime Não Funcionando

Verifique:
1. Tabela `publication_jobs` está habilitada para Realtime
2. RLS policies estão corretas
3. Cliente Supabase tem as permissões necessárias

### Performance

Para alta carga:
1. Aumente `max_concurrent` jobs na função `process_publication_jobs`
2. Ajuste frequência do pg_cron (cuidado com rate limits)
3. Implemente particionamento da tabela `publication_jobs`

## Benefícios vs Sistema Anterior

| Aspecto | Sistema Anterior | Sistema Atual |
|---------|------------------|---------------|
| **UX** | Bloqueante, sequencial | Não-bloqueante, paralelo |
| **Performance** | 1 plataforma por vez | Até 5 plataformas simultâneas |
| **Confiabilidade** | Sem retry automático | Retry automático (3 tentativas) |
| **Monitoramento** | Polling manual | Realtime updates |
| **Escalabilidade** | Limitada | Horizontal via workers |
| **Timeout** | Jobs podem travar | Timeout automático (30min) |
| **Observabilidade** | Logs limitados | Métricas completas |

## Próximos Passos

1. **Analytics Dashboard**: Interface para visualizar métricas da fila
2. **Rate Limiting**: Implementar controle de rate por plataforma
3. **Priority Queue**: Diferentes prioridades para jobs
4. **Batch Processing**: Agrupar publicações similares
5. **Dead Letter Queue**: Fila para jobs que falharam definitivamente