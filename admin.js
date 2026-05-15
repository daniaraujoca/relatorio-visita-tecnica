// Dashboard Admin - versão simplificada do Super Admin
// Apenas cria técnicos, não cria admins

// Reutiliza todo o código do super-admin, apenas modificando partes específicas
let currentUser = null;
let empresas = [];
let locais = [];
let usuarios = [];
let tecnicos = [];
let editingTecnicoId = null;
let agendamentos = [];
let relatorios = [];
const defaultDashboardView = 'tecnicos';

// Resolve o client do Supabase de forma compatível (evita "supabase.from is not a function")
function getSupabaseClient() {
  if (window.DB?.client?.from) return window.DB.client;
  if (window.supabaseClient?.from) return window.supabaseClient;
  if (window.supabase?.from) return window.supabase;
  return null;
}

// Client temporário para cadastrar usuário via signUp sem trocar a sessão atual
function getSignupClient() {
  const lib = window.supabaseLib || window.supabase;
  if (!lib?.createClient) return null;
  const url = window.SUPABASE_URL || 'https://poubmaidjueyeduseeed.supabase.co';
  const anon = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdWJtYWlkanVleWVkdXNlZWVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDc4ODksImV4cCI6MjA3NzUyMzg4OX0.SKW5aPkTqCJctj_lCqQeL9CaVpOnGJ2wH2vV3QT70mY';
  return lib.createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function init() {
  currentUser = await DB.auth.getCurrentUser();
  
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }
  
  if (currentUser.role !== 'admin' && currentUser.role !== 'super-admin') {
    alert('Acesso negado. Apenas Admins podem acessar esta página.');
    DB.auth.redirectToDashboard(currentUser.role);
    return;
  }
  
  document.getElementById('userName').textContent = currentUser.name;
  await loadAllData();
  showView(defaultDashboardView);
}

async function loadAllData() {
  Utils.showLoading('Carregando dados...');
  
  try {
    const [empresasRes, locaisRes, usuariosRes, agendamentosRes, relatoriosRes] = await Promise.all([
      DB.empresas.getAll(),
      DB.locais.getAll(),
      DB.users.getAll(),
      DB.agendamentos.getAll(),
      DB.relatorios.getAll()
    ]);
    
    empresas = empresasRes.data || [];
    locais = locaisRes.data || [];
    usuarios = usuariosRes.data || [];
    agendamentos = agendamentosRes.data || [];
    relatorios = relatoriosRes.data || [];
    
    tecnicos = usuarios.filter(u => u.role === 'tecnico');
    
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    Utils.showError('Erro ao carregar dados do sistema');
  } finally {
    Utils.hideLoading();
  }
}

function showView(viewName) {
  updateNavActive(viewName);
  document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
  const viewId = `view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`;
  document.getElementById(viewId)?.classList.remove('hidden');
  
  switch(viewName) {
    
    case 'busca': break;
case 'tecnicos': renderTecnicos(); break;
    case 'empresas': renderEmpresas(); break;
    case 'locais': renderLocais(); break;
    case 'agendamentos': renderAgendamentos(); break;
    case 'relatorios': renderRelatorios(); break;
  }
  
  closeSidebarMenu();
  Utils.scrollToTop();
}

function renderTecnicos() {
  const tbody = document.getElementById('tecnicosTableBody');
  
  if (tecnicos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum técnico cadastrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = tecnicos.map(tec => `
    <tr>
      <td>${tec.name}</td>
      <td>${tec.email || 'N/A'}</td>
      <td style="white-space: nowrap; min-width: 200px;">
        <button class="btn btn-primary btn-sm" onclick="editTecnico('${tec.id}')" style="margin-right: 8px;">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTecnico('${tec.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}

function renderEmpresas() {
  const tbody = document.getElementById('empresasTableBody');
  
  if (empresas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma empresa cadastrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = empresas.map(emp => `
    <tr>
      <td>${emp.nome}</td>
      <td>${Utils.formatDateOnly(emp.created_at)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editEmpresa('${emp.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEmpresa('${emp.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}

function renderLocais() {
  const tbody = document.getElementById('locaisTableBody');
  
  if (locais.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum local cadastrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = locais.map(local => {
    const empresa = empresas.find(e => e.id === local.empresa_id);
    return `
      <tr>
        <td>${empresa ? empresa.nome : 'N/A'}</td>
        <td>${local.nome}</td>
        <td>${local.endereco}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editLocal('${local.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLocal('${local.id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAgendamentos() {
  const tbody = document.getElementById('agendamentosTableBody');
  
  if (agendamentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum agendamento cadastrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = agendamentos.map(agend => {
    const statusClass = agend.status === 'concluido' ? 'success' : agend.status === 'cancelado' ? 'danger' : 'warning';
    
    return `
      <tr>
        <td>${Utils.formatDate(agend.data_agendamento)}</td>
        <td>${agend.empresas?.nome || 'N/A'}</td>
        <td>${agend.locais?.nome || 'N/A'}</td>
        <td>${agend.profiles?.name || 'N/A'}</td>
        <td><span class="badge badge-${statusClass}">${agend.status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editAgendamento('${agend.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAgendamento('${agend.id}')">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRelatorios() {
  const tbody = document.getElementById('relatoriosTableBody');
  
  if (relatorios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum relatório cadastrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = relatorios.map(rel => `
    <tr>
      <td>${Utils.formatDate(rel.created_at)}</td>
      <td>${rel.nome_empresa}</td>
      <td>${rel.nome_local}</td>
      <td>${rel.tecnico_nome}</td>
        <td class="actions-cell">
          <button class="btn btn-primary btn-sm" onclick="viewRelatorio('${rel.id}')" style="margin-right: 5px;">Ver</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRelatorio('${rel.id}')">Excluir</button>
        </td>
    </tr>
  `).join('');
}

// MODAIS
function showModalNovoTecnico() {
  editingTecnicoId = null;
  document.getElementById('modalTecnicoTitle').textContent = 'Novo Técnico';
  document.getElementById('formTecnico').reset();

  const senhaEl = document.getElementById('tecnicoSenha');
  if (senhaEl) {
    senhaEl.required = true;
    senhaEl.placeholder = '';
    senhaEl.value = '';
  }

  document.getElementById('modalTecnico').classList.remove('hidden');
}

function editTecnico(id) {
  const tec = tecnicos.find(t => String(t.id) === String(id));
  if (!tec) {
    Utils.showError('Técnico não encontrado.');
    return;
  }

  editingTecnicoId = tec.id;

  document.getElementById('modalTecnicoTitle').textContent = 'Editar Técnico';
  document.getElementById('modalTecnico').classList.remove('hidden');

  document.getElementById('tecnicoNome').value = tec.name || '';
  const telEl = document.getElementById('tecnicoTelefone');
  if (telEl) telEl.value = tec.telefone || '';
  document.getElementById('tecnicoEmail').value = tec.email || '';

  const senhaEl = document.getElementById('tecnicoSenha');
  if (senhaEl) {
    senhaEl.required = false; // não alteramos senha por aqui
    senhaEl.placeholder = 'Deixe em branco para manter';
    senhaEl.value = '';
  }
}

// Garante disponibilidade para onclick inline
window.editTecnico = editTecnico;


function showModalNovaEmpresa() {
  document.getElementById('modalEmpresaTitle').textContent = 'Nova Empresa';
  document.getElementById('formEmpresa').reset();
  document.getElementById('empresaId').value = '';
  document.getElementById('modalEmpresa').classList.remove('hidden');
}

function showModalNovoLocal() {
  document.getElementById('modalLocalTitle').textContent = 'Novo Local';
  document.getElementById('formLocal').reset();
  document.getElementById('localId').value = '';
  
  const select = document.getElementById('localEmpresaId');
  select.innerHTML = '<option value="">Selecione...</option>' + 
    empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  
  document.getElementById('modalLocal').classList.remove('hidden');
}

function showModalNovoAgendamento() {
  document.getElementById('modalAgendamentoTitle').textContent = 'Novo Agendamento';
  document.getElementById('formAgendamento').reset();
  document.getElementById('agendamentoId').value = '';
  
  document.getElementById('agendamentoEmpresaId').innerHTML = '<option value="">Selecione...</option>' + 
    empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  
  document.getElementById('agendamentoTecnicoId').innerHTML = '<option value="">Selecione...</option>' + 
    tecnicos.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  
  document.getElementById('modalAgendamento').classList.remove('hidden');
}

function loadLocaisForAgendamento() {
  const empresaId = document.getElementById('agendamentoEmpresaId').value;
  const locaisFiltrados = locais.filter(l => l.empresa_id === empresaId);
  
  document.getElementById('agendamentoLocalId').innerHTML = '<option value="">Selecione...</option>' + 
    locaisFiltrados.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// CRUD - TÉCNICOS
document.getElementById('formTecnico').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nome = document.getElementById('tecnicoNome').value;
  const telefone = document.getElementById('tecnicoTelefone')?.value || '';
  const email = document.getElementById('tecnicoEmail').value;
  const senha = document.getElementById('tecnicoSenha').value;

  Utils.showLoading(editingTecnicoId ? 'Salvando técnico...' : 'Criando técnico...');
  
  try {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase não inicializado.');

    if (editingTecnicoId) {
      // Edita apenas o perfil (não altera senha/auth por aqui)
      const { error: updErr } = await sb
        .from('profiles')
        .update({ name: nome, telefone, email })
        .eq('id', editingTecnicoId);

      if (updErr) throw updErr;

    } else {
      // Cria usuário via signUp SEM usar Admin API no navegador
      const signupClient = getSignupClient();
      if (!signupClient) throw new Error('Supabase signup client indisponível.');

      const { data: signupData, error: signupErr } = await signupClient.auth.signUp({
        email,
        password: senha,
      });

      if (signupErr) throw signupErr;
      const newUserId = signupData?.user?.id;
      if (!newUserId) throw new Error('Falha ao obter ID do técnico criado.');

      const { error: profileError } = await sb
        .from('profiles')
        .insert([{ id: newUserId, name: nome, role: 'tecnico', telefone, email }]);

      if (profileError) throw profileError;
    }
    
    Utils.showSuccess(editingTecnicoId ? 'Técnico atualizado com sucesso!' : 'Técnico criado com sucesso!');
    closeModal('modalTecnico');
    await loadAllData();
    renderTecnicos();
    
  } catch (error) {
    console.error('Erro ao criar técnico:', error);
    Utils.showError('Erro ao criar técnico: ' + error.message);
  } finally {
    Utils.hideLoading();
  }
});

async function deleteTecnico(id) {
  if (!Utils.confirm('Tem certeza que deseja excluir este técnico?')) return;
  
  Utils.showLoading('Excluindo técnico...');
  
  try {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase não inicializado.');

    const { error } = await sb.from('profiles').delete().eq('id', id);
    
    if (error) throw error;
    
    Utils.showSuccess('Técnico excluído com sucesso!');
    await loadAllData();
    renderTecnicos();
    
  } catch (error) {
    console.error('Erro ao excluir técnico:', error);
    Utils.showError('Erro ao excluir técnico');
  } finally {
    Utils.hideLoading();
  }
}

// CRUD - EMPRESAS
document.getElementById('formEmpresa').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('empresaId').value;
  const dados = {
    nome: document.getElementById('empresaNome').value,
    cnpj: document.getElementById('empresaCnpj').value,
    endereco: document.getElementById('empresaEndereco').value,
    telefone: document.getElementById('empresaTelefone').value,
    responsavel: document.getElementById('empresaResponsavel').value
  };
  
  Utils.showLoading(id ? 'Atualizando...' : 'Criando...');
  
  try {
    if (id) {
      await DB.empresas.update(id, dados);
    } else {
      await DB.empresas.create(dados);
    }
    
    Utils.showSuccess('Empresa salva com sucesso!');
    closeModal('modalEmpresa');
    await loadAllData();
    renderEmpresas();
    
  } catch (error) {
    console.error('Erro ao salvar empresa:', error);
    Utils.showError('Erro ao salvar empresa');
  } finally {
    Utils.hideLoading();
  }
});

function editEmpresa(id) {
  const empresa = empresas.find(e => e.id === id);
  if (!empresa) return;
  
  document.getElementById('modalEmpresaTitle').textContent = 'Editar Empresa';
  document.getElementById('empresaId').value = empresa.id;
  document.getElementById('empresaNome').value = empresa.nome;
  document.getElementById('empresaCnpj').value = empresa.cnpj || '';
  document.getElementById('empresaEndereco').value = empresa.endereco || '';
  document.getElementById('empresaTelefone').value = empresa.telefone || '';
  document.getElementById('empresaResponsavel').value = empresa.responsavel || '';
  document.getElementById('modalEmpresa').classList.remove('hidden');
}

async function deleteEmpresa(id) {
  if (!Utils.confirm('Tem certeza? Isso excluirá todos os locais e agendamentos desta empresa.')) return;
  
  Utils.showLoading('Excluindo...');
  
  try {
    await DB.empresas.delete(id);
    Utils.showSuccess('Empresa excluída com sucesso!');
    await loadAllData();
    renderEmpresas();
  } catch (error) {
    Utils.showError('Erro ao excluir empresa');
  } finally {
    Utils.hideLoading();
  }
}

// CRUD - LOCAIS
document.getElementById('formLocal').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('localId').value;
  const dados = {
    empresa_id: document.getElementById('localEmpresaId').value,
    nome: document.getElementById('localNome').value,
    tipo_local: document.getElementById('localTipo').value,
    endereco: document.getElementById('localEndereco').value,
    telefone: document.getElementById('localTelefone').value,
    responsavel: document.getElementById('localResponsavel').value,
    horario_funcionamento: document.getElementById('localHorario').value
  };
  
  Utils.showLoading(id ? 'Atualizando...' : 'Criando...');
  
  try {
    if (id) {
      await DB.locais.update(id, dados);
    } else {
      await DB.locais.create(dados);
    }
    
    Utils.showSuccess('Local salvo com sucesso!');
    closeModal('modalLocal');
    await loadAllData();
    renderLocais();
    
  } catch (error) {
    console.error('Erro ao salvar local:', error);
    Utils.showError('Erro ao salvar local');
  } finally {
    Utils.hideLoading();
  }
});

function editLocal(id) {
  const local = locais.find(l => l.id === id);
  if (!local) return;
  
  document.getElementById('modalLocalTitle').textContent = 'Editar Local';
  document.getElementById('localId').value = local.id;
  
  const select = document.getElementById('localEmpresaId');
  select.innerHTML = '<option value="">Selecione...</option>' + 
    empresas.map(e => `<option value="${e.id}" ${e.id === local.empresa_id ? 'selected' : ''}>${e.nome}</option>`).join('');
  
  document.getElementById('localNome').value = local.nome;
  document.getElementById('localTipo').value = local.tipo_local || '';
  document.getElementById('localEndereco').value = local.endereco;
  document.getElementById('localTelefone').value = local.telefone || '';
  document.getElementById('localResponsavel').value = local.responsavel || '';
  document.getElementById('localHorario').value = local.horario_funcionamento || '';
  document.getElementById('modalLocal').classList.remove('hidden');
}

async function deleteLocal(id) {
  if (!Utils.confirm('Tem certeza que deseja excluir este local?')) return;
  
  Utils.showLoading('Excluindo...');
  
  try {
    await DB.locais.delete(id);
    Utils.showSuccess('Local excluído com sucesso!');
    await loadAllData();
    renderLocais();
  } catch (error) {
    Utils.showError('Erro ao excluir local');
  } finally {
    Utils.hideLoading();
  }
}

// CRUD - AGENDAMENTOS
document.getElementById('formAgendamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('agendamentoId').value;
  const empresaId = document.getElementById('agendamentoEmpresaId').value;
  const localId = document.getElementById('agendamentoLocalId').value;
  const tecnicoId = document.getElementById('agendamentoTecnicoId').value;
  const dataAgendamento = document.getElementById('agendamentoData').value;
  const status = document.getElementById('agendamentoStatus').value;
  
  Utils.showLoading(id ? 'Atualizando...' : 'Criando...');
  
  try {
    const data = {
      empresa_id: empresaId,
      local_id: localId,
      tecnico_id: tecnicoId,
      data_agendamento: new Date(dataAgendamento).toISOString(),
      status
    };
    
    if (id) {
      await DB.agendamentos.update(id, data);
    } else {
      await DB.agendamentos.create(data);
    }
    
    Utils.showSuccess('Agendamento salvo com sucesso!');
    closeModal('modalAgendamento');
    await loadAllData();
    renderAgendamentos();
    
  } catch (error) {
    console.error('Erro ao salvar agendamento:', error);
    Utils.showError('Erro ao salvar agendamento');
  } finally {
    Utils.hideLoading();
  }
});

function editAgendamento(id) {
  const agend = agendamentos.find(a => a.id === id);
  if (!agend) return;
  
  document.getElementById('modalAgendamentoTitle').textContent = 'Editar Agendamento';
  document.getElementById('agendamentoId').value = agend.id;
  
  document.getElementById('agendamentoEmpresaId').innerHTML = '<option value="">Selecione...</option>' + 
    empresas.map(e => `<option value="${e.id}" ${e.id === agend.empresa_id ? 'selected' : ''}>${e.nome}</option>`).join('');
  
  loadLocaisForAgendamento();
  setTimeout(() => {
    document.getElementById('agendamentoLocalId').value = agend.local_id;
  }, 100);
  
  document.getElementById('agendamentoTecnicoId').innerHTML = '<option value="">Selecione...</option>' + 
    tecnicos.map(t => `<option value="${t.id}" ${t.id === agend.tecnico_id ? 'selected' : ''}>${t.name}</option>`).join('');
  
  const dataFormatada = new Date(agend.data_agendamento).toISOString().slice(0, 16);
  document.getElementById('agendamentoData').value = dataFormatada;
  document.getElementById('agendamentoStatus').value = agend.status;
  
  document.getElementById('modalAgendamento').classList.remove('hidden');
}

async function deleteAgendamento(id) {
  if (!Utils.confirm('Tem certeza que deseja excluir este agendamento?')) return;
  
  Utils.showLoading('Excluindo...');
  
  try {
    await DB.agendamentos.delete(id);
    Utils.showSuccess('Agendamento excluído com sucesso!');
    await loadAllData();
    renderAgendamentos();
  } catch (error) {
    Utils.showError('Erro ao excluir agendamento');
  } finally {
    Utils.hideLoading();
  }
}

// RELATÓRIOS
async function viewRelatorio(id) {
  Utils.showLoading('Carregando relatório...');
  
  try {
    const { data: relatorio, error } = await DB.relatorios.getById(id);
    
    if (error || !relatorio) {
      Utils.showError('Erro ao carregar relatório');
      return;
    }
    
    // Gerar PDF
    // Visualizar PDF
  // Visualizar PDF
await PDFGenerator.viewPDF(relatorio);

    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    Utils.showError('Erro ao gerar PDF: ' + error.message);
  } finally {
    Utils.hideLoading();
  }
}

async function editRelatorio(id) {
    Utils.showLoading('Carregando relatório para edição...');
    try {
        const { data: relatorio, error } = await DB.relatorios.getById(id);
        if (error || !relatorio) {
            Utils.showError('Erro ao carregar dados do relatório para edição.');
            return;
        }
        // O admin deve ser redirecionado para a página de edição do técnico, pois é lá que o formulário está.
        window.location.href = `dashboard-tecnico.html?editId=${id}`;
    } catch (error) {
        console.error('Erro ao preparar edição do relatório:', error);
        Utils.showError('Erro ao preparar edição do relatório: ' + error.message);
    } finally {
        Utils.hideLoading();
    }
}




async function deleteRelatorio(id) {
  if (!Utils.confirm('Tem certeza que deseja excluir este relatório?')) return;
  
  Utils.showLoading('Excluindo...');
  
  try {
    await DB.relatorios.delete(id);
    Utils.showSuccess('Relatório excluído com sucesso!');
    await loadAllData();
    renderRelatorios();
  } catch (error) {
    Utils.showError('Erro ao excluir relatório');
  } finally {
    Utils.hideLoading();
  }
}

// LOGOUT
async function handleLogout() {
  if (Utils.confirm('Deseja realmente sair?')) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Erro no logout:', error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = 'index.html';
    }
  }
}


window.addEventListener('DOMContentLoaded', init);


// ============================================
// BUSCA AVANÇADA GLOBAL — ECO GLP
// ============================================
let currentFilter = 'all';
let advancedSearchDebounce = null;

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatSearchDate(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  try {
    if (window.Utils?.formatDate) return Utils.formatDate(value);
    return new Date(value).toLocaleString('pt-BR');
  } catch (_) {
    return raw;
  }
}

function dateOnlyForSearch(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getEmpresaNameById(id) {
  const found = (empresas || []).find(e => String(e.id) === String(id));
  return found?.nome || '';
}

function getLocalNameById(id) {
  const found = (locais || []).find(l => String(l.id) === String(id));
  return found?.nome || '';
}

function getUserNameById(id) {
  const found = (usuarios || tecnicos || []).find(u => String(u.id) === String(id));
  return found?.name || found?.email || '';
}

function safeJoinSearch(parts) {
  return normalizeSearchText(parts.filter(Boolean).join(' | '));
}

function buildSearchRecords() {
  const records = [];

  const usersSource = Array.isArray(usuarios) ? usuarios : [];
  const tecnicosSource = Array.isArray(tecnicos) ? tecnicos : [];
  const allUsers = usersSource.length ? usersSource : tecnicosSource;

  allUsers.forEach(user => {
    records.push({
      type: 'usuarios',
      label: user.role === 'tecnico' ? 'Técnico' : 'Usuário',
      id: user.id,
      title: user.name || user.email || 'Usuário sem nome',
      subtitle: user.email || 'E-mail não informado',
      empresa: user.empresas?.nome || getEmpresaNameById(user.empresa_id),
      local: '',
      usuario: `${user.name || ''} ${user.email || ''}`,
      date: user.created_at || '',
      meta: [
        user.role ? `Perfil: ${user.role}` : '',
        user.telefone ? `Telefone: ${user.telefone}` : ''
      ].filter(Boolean),
      searchText: safeJoinSearch([user.name, user.email, user.telefone, user.role, user.empresas?.nome, getEmpresaNameById(user.empresa_id), user.id])
    });
  });

  (empresas || []).forEach(empresa => {
    records.push({
      type: 'empresas',
      label: 'Empresa',
      id: empresa.id,
      title: empresa.nome || 'Empresa sem nome',
      subtitle: empresa.cnpj || empresa.responsavel || 'Cadastro de empresa',
      empresa: empresa.nome || '',
      local: empresa.endereco || '',
      usuario: empresa.responsavel || '',
      date: empresa.created_at || '',
      meta: [
        empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : '',
        empresa.telefone ? `Telefone: ${empresa.telefone}` : '',
        empresa.responsavel ? `Responsável: ${empresa.responsavel}` : '',
        empresa.endereco ? `Endereço: ${empresa.endereco}` : ''
      ].filter(Boolean),
      searchText: safeJoinSearch([empresa.nome, empresa.cnpj, empresa.telefone, empresa.responsavel, empresa.endereco, empresa.id])
    });
  });

  (locais || []).forEach(local => {
    const empresaName = local.empresas?.nome || getEmpresaNameById(local.empresa_id);
    records.push({
      type: 'locais',
      label: 'Local',
      id: local.id,
      title: local.nome || 'Local sem nome',
      subtitle: empresaName || 'Empresa não informada',
      empresa: empresaName,
      local: `${local.nome || ''} ${local.endereco || ''}`,
      usuario: local.responsavel || '',
      date: local.created_at || '',
      meta: [
        empresaName ? `Empresa: ${empresaName}` : '',
        local.endereco ? `Endereço: ${local.endereco}` : '',
        local.responsavel ? `Responsável: ${local.responsavel}` : ''
      ].filter(Boolean),
      searchText: safeJoinSearch([local.nome, local.endereco, local.responsavel, empresaName, local.id])
    });
  });

  (agendamentos || []).forEach(ag => {
    const empresaName = ag.empresas?.nome || getEmpresaNameById(ag.empresa_id);
    const localName = ag.locais?.nome || getLocalNameById(ag.local_id);
    const tecnicoName = ag.profiles?.name || ag.users?.name || getUserNameById(ag.tecnico_id);
    records.push({
      type: 'agendamentos',
      label: 'Agendamento',
      id: ag.id,
      title: `${empresaName || 'Empresa não informada'} — ${localName || 'Local não informado'}`,
      subtitle: `Data: ${formatSearchDate(ag.data_agendamento)}`,
      empresa: empresaName,
      local: localName,
      usuario: tecnicoName,
      date: ag.data_agendamento || ag.created_at || '',
      meta: [
        tecnicoName ? `Técnico: ${tecnicoName}` : '',
        ag.status ? `Status: ${ag.status}` : '',
        ag.observacoes ? `Obs.: ${ag.observacoes}` : ''
      ].filter(Boolean),
      searchText: safeJoinSearch([empresaName, localName, tecnicoName, ag.status, ag.observacoes, formatSearchDate(ag.data_agendamento), ag.id])
    });
  });

  (relatorios || []).forEach(rel => {
    const reportDate = rel.data_visita || rel.created_at;
    records.push({
      type: 'relatorios',
      label: 'Relatório',
      id: rel.id,
      title: `${rel.nome_empresa || 'Empresa não informada'} — ${rel.nome_local || 'Local não informado'}`,
      subtitle: `Data: ${formatSearchDate(reportDate)}`,
      empresa: rel.nome_empresa || '',
      local: `${rel.nome_local || ''} ${rel.endereco_local || ''}`,
      usuario: rel.tecnico_nome || '',
      date: reportDate || '',
      meta: [
        rel.tecnico_nome ? `Técnico: ${rel.tecnico_nome}` : '',
        rel.num_dispositivos ? `Dispositivo(s): ${rel.num_dispositivos}` : '',
        rel.tipo_empreendimento ? `Tipo: ${rel.tipo_empreendimento}` : '',
        rel.status ? `Status: ${rel.status}` : ''
      ].filter(Boolean),
      searchText: safeJoinSearch([rel.nome_empresa, rel.nome_local, rel.endereco_local, rel.tecnico_nome, rel.num_dispositivos, rel.tipo_empreendimento, rel.status, formatSearchDate(reportDate), rel.id])
    });
  });

  return records;
}

function getAdvancedSearchFilters() {
  return {
    type: document.getElementById('searchType')?.value || currentFilter || 'all',
    q: normalizeSearchText(document.getElementById('globalSearch')?.value || ''),
    empresa: normalizeSearchText(document.getElementById('searchEmpresa')?.value || ''),
    local: normalizeSearchText(document.getElementById('searchLocal')?.value || ''),
    usuario: normalizeSearchText(document.getElementById('searchUsuario')?.value || ''),
    from: document.getElementById('searchDateFrom')?.value || '',
    to: document.getElementById('searchDateTo')?.value || ''
  };
}

function recordMatchesAdvancedSearch(record, filters) {
  if (filters.type !== 'all' && record.type !== filters.type) return false;
  if (filters.q && !record.searchText.includes(filters.q)) return false;
  if (filters.empresa && !normalizeSearchText(record.empresa).includes(filters.empresa)) return false;
  if (filters.local && !normalizeSearchText(record.local).includes(filters.local)) return false;
  if (filters.usuario && !normalizeSearchText(record.usuario).includes(filters.usuario)) return false;

  const recordDate = dateOnlyForSearch(record.date);
  if (filters.from && (!recordDate || recordDate < filters.from)) return false;
  if (filters.to && (!recordDate || recordDate > filters.to)) return false;

  return true;
}

function setSearchFilter(filter) {
  currentFilter = filter || 'all';
  const select = document.getElementById('searchType');
  if (select) select.value = currentFilter;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });

  executeAdvancedSearch();
}

function executeAdvancedSearch() {
  const filters = getAdvancedSearchFilters();
  currentFilter = filters.type;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === currentFilter);
  });

  const hasAnyFilter = [filters.q, filters.empresa, filters.local, filters.usuario, filters.from, filters.to].some(Boolean) || filters.type !== 'all';
  const summary = document.getElementById('searchResults');
  const countEl = document.getElementById('searchCount');
  const list = document.getElementById('advancedSearchResults');

  if (!list || !summary || !countEl) return;

  if (!hasAnyFilter) {
    summary.hidden = true;
    list.hidden = true;
    list.innerHTML = '';
    return;
  }

  const results = buildSearchRecords().filter(record => recordMatchesAdvancedSearch(record, filters));
  countEl.textContent = results.length;
  summary.hidden = false;
  list.hidden = false;
  list.innerHTML = renderAdvancedSearchResults(results);
}

function renderAdvancedSearchResults(results) {
  if (!results.length) {
    return `
      <div class="advanced-empty-state">
        <strong>Nenhum resultado encontrado.</strong>
        <span>Revise os termos, remova filtros ou tente buscar apenas por empresa, local, usuário ou data.</span>
      </div>
    `;
  }

  return results.map(record => {
    const meta = (record.meta || []).slice(0, 4).map(item => `<span>${escapeHtmlForSearch(item)}</span>`).join('');
    const primaryAction = record.type === 'relatorios'
      ? `<button type="button" class="btn btn-primary btn-sm" onclick="viewRelatorio('${record.id}')">Ver PDF</button>`
      : `<button type="button" class="btn btn-primary btn-sm" onclick="openSearchResult('${record.type}', '${record.id}')">Abrir</button>`;

    return `
      <article class="advanced-result-card">
        <div class="advanced-result-type">${escapeHtmlForSearch(record.label)}</div>
        <div class="advanced-result-content">
          <h3>${escapeHtmlForSearch(record.title)}</h3>
          <p>${escapeHtmlForSearch(record.subtitle)}</p>
          <div class="advanced-result-meta">${meta}</div>
        </div>
        <div class="advanced-result-actions">
          ${primaryAction}
          <button type="button" class="btn btn-secondary btn-sm" onclick="openSearchResult('${record.type}', '${record.id}')">Ir para lista</button>
        </div>
      </article>
    `;
  }).join('');
}

function escapeHtmlForSearch(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function openSearchResult(type, id) {
  const map = {
    usuarios: document.getElementById('viewUsuarios') ? 'usuarios' : 'tecnicos',
    empresas: 'empresas',
    locais: 'locais',
    agendamentos: 'agendamentos',
    relatorios: 'relatorios'
  };

  const view = map[type];
  if (view && typeof showView === 'function') showView(view);

  setTimeout(() => {
    const card = document.getElementById(`view${view ? view.charAt(0).toUpperCase() + view.slice(1) : ''}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function resetAdvancedSearch() {
  ['globalSearch', 'searchEmpresa', 'searchLocal', 'searchUsuario', 'searchDateFrom', 'searchDateTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  currentFilter = 'all';
  const select = document.getElementById('searchType');
  if (select) select.value = 'all';
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === 'all'));

  const summary = document.getElementById('searchResults');
  const list = document.getElementById('advancedSearchResults');
  if (summary) summary.hidden = true;
  if (list) {
    list.hidden = true;
    list.innerHTML = '';
  }
}


function ensureSearchFilterLabels() {
  const labels = {
    all: 'Todos',
    usuarios: 'Usuários',
    tecnicos: 'Técnicos',
    empresas: 'Empresas',
    locais: 'Locais',
    agendamentos: 'Agendamentos',
    relatorios: 'Relatórios'
  };

  document.querySelectorAll('.filter-btn').forEach(btn => {
    const key = btn.dataset.filter;
    if (labels[key] && !btn.textContent.trim()) {
      btn.textContent = labels[key];
    }
    if (labels[key]) {
      btn.setAttribute('aria-label', labels[key]);
    }
  });
}

function setupAdvancedSearch() {
  ensureSearchFilterLabels();
  const searchableInputs = ['globalSearch', 'searchEmpresa', 'searchLocal', 'searchUsuario', 'searchDateFrom', 'searchDateTo'];
  searchableInputs.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        executeAdvancedSearch();
      }
    });
    el.addEventListener('input', () => {
      clearTimeout(advancedSearchDebounce);
      advancedSearchDebounce = setTimeout(executeAdvancedSearch, 350);
    });
  });
}

document.addEventListener('DOMContentLoaded', setupAdvancedSearch);

window.setSearchFilter = setSearchFilter;
window.executeAdvancedSearch = executeAdvancedSearch;
window.resetAdvancedSearch = resetAdvancedSearch;
window.openSearchResult = openSearchResult;
window.defaultDashboardView = defaultDashboardView;

window.toggleSidebarMenu = toggleSidebarMenu;
window.closeSidebarMenu = closeSidebarMenu;
window.updateNavActive = updateNavActive;
