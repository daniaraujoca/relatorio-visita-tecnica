import { auth, db, firebaseConfig } from "./firebaseConfig.js";
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
import { gerarPDFVisita, uploadPDFToCloudinary } from "./pdf-utils.js";

// Elementos de UI
const userRoleSpan = document.getElementById("userRole");
const btnLogout = document.getElementById("btnLogout");
const secEmpresas = document.getElementById("secEmpresas");
const secUsuarios = document.getElementById("secUsuarios");
const secRelatorios = document.getElementById("secRelatorios");
const empresaSelectContainer = document.getElementById("empresaSelectContainer");
const loadingUsuarios = document.getElementById("loadingUsuarios");

// PDF/Cloudinary
const CLOUDINARY_CLOUD_NAME = "dehekhogh";
const CLOUDINARY_PDF_PRESET = "visits_pdfs_unsigned";
const CLOUDINARY_PDF_FOLDER = "visits_pdfs";

// 1) Valida sessão e ajusta interface
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

    localStorage.setItem("usuarioId", user.uid);
    localStorage.setItem("role", role);
    localStorage.setItem("empresaId", empresaId);
    localStorage.setItem("nomeEmpresa", nomeEmpresa);

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

// 2) Logout
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.clear();
  window.location.replace("index.html");
});

// 3) Cadastro de empresa
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

// 4) Cadastro de usuário
document.getElementById("formUsuario").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome        = document.getElementById("nomeUsuario").value.trim();
  const email       = document.getElementById("emailUsuario").value.trim();
  const senha       = document.getElementById("senhaUsuario").value;
  const roleUsuario = document.getElementById("roleUsuario").value;
  let   empresaUsuarioId = localStorage.getItem("empresaId");

  if (localStorage.getItem("role") === "superadmin") {
    empresaUsuarioId = document.getElementById("empresaUsuario").value;
    if (!empresaUsuarioId) return alert("Selecione a empresa.");
  }

  if (!nome || !email || !senha || !roleUsuario) {
    return alert("Preencha todos os campos.");
  }

  try {
    // App secundário para criar sem deslogar
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

// 5) Geração de relatório
document.getElementById("btnGerarRelatorio").addEventListener("click", async () => {
  const empresaSel = document.getElementById("relatorioEmpresa").value;
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim    = document.getElementById("dataFim").value;

  if (!empresaSel) {
    alert("Selecione a empresa.");
    return;
  }

  if (!dataInicio || !dataFim) {
    alert("Informe o período.");
    return;
  }

  // Ajusta intervalo de datas para incluir todo o dia final
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  fim.setHours(23, 59, 59, 999);

  // Busca visitas no período
  const visitas = [];
  const qVisitas = query(
    collection(db, "visitas"),
    where("empresaId", "==", empresaSel)
  );
  const snapVisitas = await getDocs(qVisitas);
  snapVisitas.forEach(docSnap => {
    const v = docSnap.data();
    const dt = v.dataHora.toDate ? v.dataHora.toDate() : new Date(v.dataHora);
    if (dt >= inicio && dt <= fim) {
      visitas.push(v);
    }
  });

  if (!visitas.length) {
    alert("Nenhuma visita no período.");
    return;
  }

  try {
    // Importa jsPDF e autoTable corretamente
    await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    await import("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/dist/jspdf.plugin.autotable.min.js");

    const { jsPDF } = window.jspdf;

    // Gera PDF
    const docPDF = new jsPDF();
    docPDF.setFontSize(16);
    const nomeEmpresa = await nomeEmpresaPorId(empresaSel);
    docPDF.text(`Relatório de Visitas - ${nomeEmpresa}`, 10, 20);
    docPDF.setFontSize(11);

    docPDF.autoTable({
      startY: 30,
      head: [['#', 'Data/Hora', 'Serviço', 'Local', 'Técnico']],
      body: visitas.map((v, i) => [
        i + 1,
        new Date(v.dataHora.seconds * 1000).toLocaleString(),
        v.tipoServico,
        v.nomeLocal,
        v.nomeTecnico
      ]),
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [0, 120, 215] }
    });

    // Gera blob e envia para Cloudinary
    const pdfBlob = docPDF.output("blob");
    const filename = `relatorio_${empresaSel}_${Date.now()}`;
    const pdfURL = await uploadPDFToCloudinary(pdfBlob, filename, CLOUDINARY_CLOUD_NAME);
    console.log("PDF URL:", pdfURL);


    // Exibe visualização embutida
    const container = document.getElementById("relatorioContainer");
    container.innerHTML = `
      <h3>Relatório Gerado</h3>
      <iframe
        src="${pdfURL}"
        width="100%"
        height="600px"
        style="border: 1px solid #ccc;"
        title="Relatório de Visitas"
      ></iframe>
      <p>
        Se o relatório não carregar, <a href="${pdfURL}" target="_blank">clique aqui para abrir</a>.
      </p>
    `;
  } catch (err) {
    alert("Erro ao gerar relatório: " + err.message);
  }
});


// Funções auxiliares

async function carregarEmpresasSelect(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = `<option value="">Selecione</option>`;
  const snap = await getDocs(collection(db, "empresas"));
  snap.forEach(docSnap => {
    const e = docSnap.data();
    sel.innerHTML += `<option value="${docSnap.id}">${e.nome}</option>`;
  });
}

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

async function nomeEmpresaPorId(id) {
  if (!id) return "";
  const snap = await getDoc(doc(db, "empresas", id));
  return snap.exists() ? snap.data().nome : "";
}





