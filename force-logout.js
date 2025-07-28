#!/usr/bin/env node

// Script para forçar logout de todas as sessões ativas
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function forceLogoutAllSessions() {
  console.log('🔐 Forçando logout de todas as sessões ativas...\n');
  
  // Carregar variáveis de ambiente do arquivo .env
  let envVars = {};
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });
  } catch (error) {
    console.error('❌ Erro ao carregar .env:', error.message);
    return;
  }
  
  // Configurar cliente Supabase com privilégios administrativos
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    console.error('Certifique-se que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão configuradas');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // 1. Buscar todas as sessões ativas
    console.log('1️⃣ Buscando sessões ativas...');
    const { data: sessions, error: sessionError } = await supabase.auth.admin.listUsers();
    
    if (sessionError) {
      console.error('❌ Erro ao buscar usuários:', sessionError.message);
      return;
    }
    
    console.log(`📊 Encontrados ${sessions.users.length} usuários no sistema`);
    
    // 2. Mostrar usuários ativos
    const activeUsers = sessions.users.filter(user => user.last_sign_in_at);
    console.log(`👥 Usuários com login recente: ${activeUsers.length}`);
    
    activeUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - Último login: ${new Date(user.last_sign_in_at).toLocaleString()}`);
    });
    
    if (activeUsers.length === 0) {
      console.log('✅ Nenhum usuário ativo encontrado - sessões já limpas');
      return;
    }
    
    // 3. Forçar logout de todos os usuários
    console.log('\n2️⃣ Forçando logout de todos os usuários...');
    
    let logoutCount = 0;
    for (const user of activeUsers) {
      try {
        // Remover todas as sessões do usuário
        const { error: signOutError } = await supabase.auth.admin.signUserOut(user.id);
        
        if (signOutError) {
          console.error(`❌ Erro ao deslogar ${user.email}:`, signOutError.message);
        } else {
          console.log(`✅ ${user.email} - Logout forçado com sucesso`);
          logoutCount++;
        }
      } catch (error) {
        console.error(`❌ Erro inesperado ao deslogar ${user.email}:`, error.message);
      }
    }
    
    console.log(`\n📈 Resultado: ${logoutCount}/${activeUsers.length} usuários deslogados com sucesso`);
    
    // 4. Instruções para teste
    console.log('\n🧪 Para testar a proteção de rotas:');
    console.log('   1. Limpe os cookies do navegador (F12 > Application > Storage > Clear Storage)');
    console.log('   2. Acesse: https://socialhub.gestorlead.com.br/');
    console.log('   3. Deve ser redirecionado para a página de login');
    console.log('   4. Qualquer rota protegida deve redirecionar para login');
    
    console.log('\n✅ Processo concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Função para verificar sessões sem deslogar
async function checkActiveSessions() {
  console.log('🔍 Verificando sessões ativas...\n');
  
  // Carregar variáveis de ambiente do arquivo .env
  let envVars = {};
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
    });
  } catch (error) {
    console.error('❌ Erro ao carregar .env:', error.message);
    return;
  }
  
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    const { data: sessions, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Erro:', error.message);
      return;
    }
    
    const activeUsers = sessions.users.filter(user => user.last_sign_in_at);
    
    console.log(`📊 Total de usuários: ${sessions.users.length}`);
    console.log(`👥 Usuários com sessões ativas: ${activeUsers.length}\n`);
    
    if (activeUsers.length > 0) {
      console.log('🔑 Sessões ativas encontradas:');
      activeUsers.forEach((user, index) => {
        const lastLogin = new Date(user.last_sign_in_at).toLocaleString();
        console.log(`   ${index + 1}. ${user.email} - ${lastLogin}`);
      });
      
      console.log('\n💡 Para forçar logout de todos: node force-logout.js logout');
    } else {
      console.log('✅ Nenhuma sessão ativa - todas as rotas devem estar protegidas');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Processar argumentos da linha de comando
const command = process.argv[2];

switch (command) {
  case 'logout':
  case 'force-logout':
    forceLogoutAllSessions();
    break;
  case 'check':
  case 'status':
    checkActiveSessions();
    break;
  default:
    console.log('🔐 Gerenciador de Sessões - Social Hub\n');
    console.log('Uso:');
    console.log('  node force-logout.js check      # Verificar sessões ativas');
    console.log('  node force-logout.js logout     # Forçar logout de todos os usuários');
    console.log('\nExemplos:');
    console.log('  node force-logout.js check');
    console.log('  node force-logout.js logout');
    break;
}