import { auth, db } from "./firebaseConfig.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  Timestamp,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

// Elementos de UI
const userRoleSpan = document.getElementById("userRole");
const btnLogout = document.getElementById("btnLogout");
const secEmpresas = document.getElementById("secEmpresas");
const secUsuarios = document.getElementById("secUsuarios");
const secRelatorios = document.getElementById("secRelatorios");
const empresaSelectContainer = document.getElementById("empresaSelectContainer");
const loadingUsuarios = document.getElementById("loadingUsuarios");

// Verifica autenticação e perfil
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }
  try {
    const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!perfilSnap.exists()) throw new Error();
    const perfil = perfilSnap.data();

    const role = (perfil.role || "").toLowerCase();
    const empresaId = perfil.empresaId || "";
    const nomeEmpresa = perfil.nomeEmpresa || "";

    // Armazena contexto
    localStorage.setItem("usuarioId", user.uid);
    localStorage.setItem("role", role);
    localStorage.setItem("empresaId", empresaId);
    localStorage.setItem("nomeEmpresa", nomeEmpresa);

    // Ajusta interface
    userRoleSpan.textContent = `Papel: ${role}`;

    if (role === "superadmin") {
      secEmpresas.style.display = "block";
      secUsuarios.style.display = "block";
      secRelatorios.style.display = "block";
      empresaSelectContainer.style.display = "block";

      // Popula selects
      carregarEmpresasSelect("empresaUsuario");
      carregarEmpresasSelect("relatorioEmpresa");

      // Carrega usuários
      carregarUsuarios();
    } else if (role === "admin_empresa") {
      secUsuarios.style.display = "block";
      secRelatorios.style.display = "block";
      empresaSelectContainer.style.display = "none";

      // predefine relatório para a própria empresa
      const selRel = document.getElementById("relatorioEmpresa");
      selRel.innerHTML = `<option value="${empresaId}">${nomeEmpresa}</option>`;

      carregarUsuarios();
    } else {
      alert("Acesso negado.");
      await signOut(auth);
      localStorage.clear();
      window.location.replace("index.html");
    }
  } catch {
    window.location.replace("index.html");
  }
});

// Logout
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.clear();
  window.location.replace("index.html");
});

// Cadastro de empresa (superadmin)
document.getElementById("formEmpresa").addEventListener("submit", async (e) => {
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

// Cadastro de usuário (superadmin e admin_empresa)
document.getElementById("formUsuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nomeUsuario").value.trim();
  const email = document.getElementById("emailUsuario").value.trim();
  const senha = document.getElementById("senhaUsuario").value;
  const roleUsuario = document.getElementById("roleUsuario").value;
  let empresaUsuarioId = localStorage.getItem("empresaId");

  if (localStorage.getItem("role") === "superadmin") {
    empresaUsuarioId = document.getElementById("empresaUsuario").value;
    if (!empresaUsuarioId) return alert("Selecione a empresa.");
  }

  if (!nome || !email || !senha || !roleUsuario) {
    return alert("Preencha todos os campos.");
  }

  try {
    // Cria conta em app secundário para não desconectar o usuário atual
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js");
    const { getAuth, createUserWithEmailAndPassword } =
      await import("https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js");
    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nome,
      email,
      role: roleUsuario,
      empresaId: empresaUsuarioId,
      nomeEmpresa: localStorage.getItem("role") === "superadmin"
        ? await nomeEmpresaPorId(empresaUsuarioId)
        : localStorage.getItem("nomeEmpresa"),
      ativo: true,
      criadoEm: Timestamp.now()
    });

    await signOut(secondaryAuth);

    alert("Usuário criado com sucesso.");
    e.target.reset();
    carregarUsuarios();
  } catch (err) {
    alert("Erro ao criar usuário: " + err.message);
  }
});

// Geração de relatório em PDF
document.getElementById("btnGerarRelatorio").addEventListener("click", async () => {
  // ... mantenha a lógica de geração de PDF (igual antes)
});

// Carrega lista de empresas em um <select>
async function carregarEmpresasSelect(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = `<option value="">Selecione</option>`;
  const snap = await getDocs(collection(db, "empresas"));
  snap.forEach(docSnap => {
    const e = docSnap.data();
    sel.innerHTML += `<option value="${docSnap.id}">${e.nome}</option>`;
  });
}

// Carrega lista de usuários sob jurisdição
async function carregarUsuarios() {
  const lista = document.getElementById("listaUsuarios");
  lista.innerHTML = "";
  loadingUsuarios.style.display = "block";

  try {
    let q;
    if (localStorage.getItem("role") === "superadmin") {
      q = collection(db, "usuarios");
    } else {
      q = query(
        collection(db, "usuarios"),
        where("empresaId", "==", localStorage.getItem("empresaId"))
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      lista.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    } else {
      let html = `
        <table class="tabela-usuarios">
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Função</th><th>Empresa</th>
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
      html += `</tbody></table>`;
      lista.innerHTML = html;
    }
  } catch {
    lista.innerHTML = "<p>Erro ao carregar usuários.</p>";
  } finally {
    loadingUsuarios.style.display = "none";
  }
}

// Auxiliar para buscar nome de empresa pelo ID
async function nomeEmpresaPorId(id) {
  const snap = await getDoc(doc(db, "empresas", id));
  return snap.exists() ? snap.data().nome : "";
}
