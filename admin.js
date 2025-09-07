import { auth, db, firebaseConfig } from "./firebaseConfig.js";
import { signOut, createUserWithEmailAndPassword, getAuth, signOut as signOutAuth } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { collection, addDoc, getDocs, doc, setDoc, query, where, Timestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { gerarPDFVisita } from "./pdf-utils.js";

// Elementos
const userRoleSpan = document.getElementById("userRole");
const btnLogout = document.getElementById("btnLogout");
const secEmpresas = document.getElementById("secEmpresas");
const secUsuarios = document.getElementById("secUsuarios");
const secRelatorios = document.getElementById("secRelatorios");
const empresaSelectContainer = document.getElementById("empresaSelectContainer");

// Contexto do usuário logado
let role = (localStorage.getItem("role") || "").toLowerCase();
const empresaId = localStorage.getItem("empresaId");
const nomeEmpresa = localStorage.getItem("nomeEmpresa");

// Ajusta visibilidade
userRoleSpan.textContent = `Papel: ${role}`;
if (role === "superadmin") {
  secEmpresas.style.display = "block";
  secUsuarios.style.display = "block";
  secRelatorios.style.display = "block";
  empresaSelectContainer.style.display = "block";
  carregarEmpresasSelect("empresaUsuario");
  carregarEmpresasSelect("relatorioEmpresa");
  carregarUsuarios();
} else if (role === "admin_empresa") {
  secUsuarios.style.display = "block";
  secRelatorios.style.display = "block";
  empresaSelectContainer.style.display = "none";
  const sel = document.getElementById("relatorioEmpresa");
  sel.innerHTML = `<option value="${empresaId}">${nomeEmpresa}</option>`;
  carregarUsuarios();
} else {
  alert("Acesso negado.");
  window.location.href = "admin-login.html";
}

// Logout
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.clear();
  window.location.href = "admin-login.html";
});

// Cadastro de empresa (superadmin)
document.getElementById("formEmpresa")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeEmpresa").value.trim();
  const cnpj = document.getElementById("cnpjEmpresa").value.trim();
  if (!nome) return alert("Informe o nome da empresa.");
  await addDoc(collection(db, "empresas"), {
    nome,
    cnpj,
    criadoEm: Timestamp.now()
  });
  alert("Empresa cadastrada.");
  e.target.reset();
  carregarEmpresasSelect("empresaUsuario");
  carregarEmpresasSelect("relatorioEmpresa");
});

// Cadastro de usuário (superadmin ou admin_empresa)
document.getElementById("formUsuario")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeUsuario").value.trim();
  const email = document.getElementById("emailUsuario").value.trim();
  const senha = document.getElementById("senhaUsuario").value;
  const roleUsuario = document.getElementById("roleUsuario").value;
  let empresaUsuarioId = empresaId;

  if (role === "superadmin") {
    empresaUsuarioId = document.getElementById("empresaUsuario").value;
    if (!empresaUsuarioId) return alert("Selecione a empresa.");
  }

  if (!nome || !email || !senha || !roleUsuario) {
    return alert("Preencha todos os campos.");
  }

  try {
    // Cria app secundário para não derrubar sessão do app principal
    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

    // Salva perfil no Firestore usando o db do app principal
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nome,
      email,
      role: roleUsuario,
      empresaId: empresaUsuarioId,
      nomeEmpresa: role === "superadmin" ? await nomeEmpresaPorId(empresaUsuarioId) : nomeEmpresa,
      ativo: true,
      criadoEm: Timestamp.now()
    });

    // Encerra sessão do app secundário
    await signOutAuth(secondaryAuth);

    alert("Usuário criado com sucesso.");
    e.target.reset();
    carregarUsuarios(); // Atualiza lista
  } catch (err) {
    alert("Erro ao criar usuário: " + err.message);
  }
});

// Geração de relatório PDF
document.getElementById("btnGerarRelatorio")?.addEventListener("click", async () => {
  const empresaSel = document.getElementById("relatorioEmpresa").value;
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;

  if (!empresaSel) return alert("Selecione a empresa.");
  if (!dataInicio || !dataFim) return alert("Informe o período.");

  const visitas = [];
  const q = query(collection(db, "visitas"), where("empresaId", "==", empresaSel));
  const snap = await getDocs(q);
  snap.forEach(docSnap => {
    const v = docSnap.data();
    const dataVisita = v.dataHora?.toDate ? v.dataHora.toDate() : new Date(v.dataHora);
    if (dataVisita >= new Date(dataInicio) && dataVisita <= new Date(dataFim)) {
      visitas.push(v);
    }
  });

  if (!visitas.length) return alert("Nenhuma visita no período.");

  // Gera PDF consolidado
  const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js");
  const docPDF = new jsPDF();
  docPDF.setFontSize(16);
  docPDF.text(`Relatório de Visitas - ${await nomeEmpresaPorId(empresaSel)}`, 10, 20);
  docPDF.setFontSize(11);

  let y = 30;
  visitas.forEach((v, idx) => {
    docPDF.text(`${idx + 1}. ${v.tipoServico} - ${v.nomeLocal} - ${v.nomeTecnico} - ${new Date(v.dataHora.seconds * 1000).toLocaleString()}`, 10, y);
    y += 6;
    if (y > 280) { docPDF.addPage(); y = 20; }
  });

  docPDF.save(`relatorio_${empresaSel}_${dataInicio}_${dataFim}.pdf`);
});

// Utilitários
async function carregarEmpresasSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecione</option>`;
  const snap = await getDocs(collection(db, "empresas"));
  snap.forEach(docSnap => {
    const e = docSnap.data();
    sel.innerHTML += `<option value="${docSnap.id}">${e.nome}</option>`;
  });
}

async function nomeEmpresaPorId(id) {
  if (!id) return "";
  const snap = await getDoc(doc(db, "empresas", id));
  return snap.exists() ? snap.data().nome : "";
}

async function carregarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  if (!lista) return;
  lista.innerHTML = "<p>Carregando usuários...</p>";

  let q;
  if (role === "superadmin") {
    q = collection(db, "usuarios");
  } else if (role === "admin_empresa") {
    q = query(collection(db, "usuarios"), where("empresaId", "==", empresaId));
  } else {
    lista.innerHTML = "<p>Sem permissão para visualizar usuários.</p>";
    return;
  }

  const snap = await getDocs(q);
  if (snap.empty) {
    lista.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    return;
  }

  let html = `
    <table class="tabela-usuarios">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Email</th>
          <th>Função</th>
          <th>Empresa</th>
        </tr>
      </thead>
      <tbody>
  `;

  snap.forEach(docSnap => {
    const u = docSnap.data();
    html += `
      <tr>
        <td>${u.nome}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.nomeEmpresa || ""}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  lista.innerHTML = html;
}
