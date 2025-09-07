import { collection, addDoc, Timestamp, doc, updateDoc, getDocs, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { auth } from "./firebaseConfig.js";
import { gerarPDFVisita, uploadPDFToCloudinary } from "./pdf-utils.js";

// Cloudinary
const CLOUDINARY_CLOUD_NAME = "dehekhogh";
const CLOUDINARY_UPLOAD_PRESET_IMG = "visitas_unsigned";
const CLOUDINARY_UPLOAD_FOLDER_IMG = "visitas";
const CLOUDINARY_UPLOAD_PRESET_PDF = "visits_pdfs_unsigned";
const CLOUDINARY_UPLOAD_FOLDER_PDF = "visits_pdfs";

export function initVisitaForm(db) {
  const form = document.getElementById('visitaForm');
  const btnSalvar = document.getElementById('btnSalvar');
  const msgSucesso = document.getElementById('mensagemSucesso');
  const nomeTecnicoInput = document.getElementById('nomeTecnico');

  // 🔹 Garante dados do técnico e empresa antes de permitir salvar
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (snap.exists()) {
        const dados = snap.data();
        localStorage.setItem("usuarioId", user.uid);
        localStorage.setItem("empresaId", dados.empresaId || "");
        localStorage.setItem("nomeEmpresa", dados.nomeEmpresa || "");
        if (!nomeTecnicoInput.value) {
          nomeTecnicoInput.value = dados.nome || "";
        }
        nomeTecnicoInput.disabled = false;
      } else {
        alert("Perfil de usuário não encontrado. Faça login novamente.");
        window.location.href = "login.html";
      }
    } else {
      alert("Sessão expirada. Faça login novamente.");
      window.location.href = "login.html";
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Limpa mensagens de erro
    document.querySelectorAll('.erro').forEach(el => { el.textContent = ''; el.style.display = 'none'; });

    const foto = document.getElementById('fotoLocal').files[0];
    const tipoServico = document.getElementById('tipoServico').value;
    const nomeLocal = document.getElementById('nomeLocal').value.trim();
    const nomeTecnico = nomeTecnicoInput.value.trim();
    const endereco = document.getElementById('endereco').value.trim();
    const dataHora = document.getElementById('dataHora').value;

    const empresaId = localStorage.getItem('empresaId') || '';
    const tecnicoId = localStorage.getItem('usuarioId') || '';
    const nomeEmpresa = localStorage.getItem('nomeEmpresa') || '';

    let valido = true;
    if (!foto) { mostrarErro('erroFoto', "Selecione uma foto."); valido = false; }
    if (!tipoServico) { mostrarErro('erroTipo', "Escolha o tipo de serviço."); valido = false; }
    if (!nomeLocal) { mostrarErro('erroLocal', "Informe o nome do local."); valido = false; }
    if (!nomeTecnico) { mostrarErro('erroTecnico', "Nome do técnico não identificado."); valido = false; }
    if (!endereco) { mostrarErro('erroEndereco', "Informe o endereço."); valido = false; }
    if (!dataHora) { mostrarErro('erroData', "Data e hora inválidas."); valido = false; }
    if (!empresaId) { alert("Empresa não identificada. Faça login novamente."); valido = false; }
    if (!tecnicoId) { alert("Usuário não identificado. Faça login novamente."); valido = false; }
    if (!valido) return;

    try {
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Salvando...";

      // 1) Upload da foto principal
      const fotoURL = await uploadImagemCloudinary(foto);

      // 2) Salvar visita
      const visitaRef = await addDoc(collection(db, "visitas"), {
        empresaId,
        tecnicoId,
        tipoServico,
        nomeLocal,
        nomeTecnico,
        endereco,
        dataHora: Timestamp.fromDate(new Date(dataHora)),
        fotoURL,
        status: "Concluída",
        pdfURL: null
      });

      // 3) Buscar fotos adicionais
      const fotosAdicionais = await buscarFotosAdicionaisDaVisita(db, {
        empresaId, nomeLocal, nomeTecnico, endereco, dataHora
      });

      // 4) Gerar PDF
      const visitaPlain = {
        empresaId,
        nomeEmpresa,
        nomeTecnico,
        tipoServico,
        nomeLocal,
        endereco,
        dataHora: new Date(dataHora).toISOString(),
        fotoURL
      };
      const pdfBlob = await gerarPDFVisita(visitaPlain, fotosAdicionais);

      // 5) Upload do PDF
      const filename = `visita_${visitaRef.id}_${Date.now()}`;
      const pdfURL = await uploadPDFToCloudinary(
        pdfBlob,
        filename,
        CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_UPLOAD_PRESET_PDF,
        CLOUDINARY_UPLOAD_FOLDER_PDF
      );

      // 6) Atualizar visita com pdfURL
      await updateDoc(doc(db, "visitas", visitaRef.id), {
        pdfURL,
        pdfGeradoEm: Timestamp.now()
      });

      // 7) Feedback
      msgSucesso.style.display = 'block';
      form.reset();
      const agora = new Date();
      document.getElementById('dataHora').value =
        `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}T${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

      // 8) Download imediato
      const baixarAgora = confirm("Relatório PDF gerado. Deseja baixar agora?");
      if (baixarAgora) window.open(pdfURL, "_blank");

      // 9) Persistir dados-chave
      localStorage.setItem('tipoServico', tipoServico);
      localStorage.setItem('nomeLocal', nomeLocal);
      localStorage.setItem('nomeTecnico', nomeTecnico);
      localStorage.setItem('endereco', endereco);
      localStorage.setItem('dataHora', dataHora);

    } catch (error) {
      alert("Erro ao salvar visita ou gerar PDF: " + error.message);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar e Avançar";
    }
  });

  function mostrarErro(id, mensagem) {
    const el = document.getElementById(id);
    el.textContent = mensagem;
    el.style.display = 'block';
  }
}

async function uploadImagemCloudinary(file) {
  const maxMB = 8;
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Imagem acima de ${maxMB} MB.`);

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET_IMG);
  if (CLOUDINARY_UPLOAD_FOLDER_IMG) fd.append("folder", CLOUDINARY_UPLOAD_FOLDER_IMG);

  const baseName = `${Date.now()}_${file.name}`.replace(/\s+/g, "_");
  fd.append("public_id", baseName);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const resp = await fetch(uploadUrl, { method: "POST", body: fd });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.secure_url;
}

async function buscarFotosAdicionaisDaVisita(db, { empresaId, nomeLocal, nomeTecnico, endereco, dataHora }) {
  const q = query(
    collection(db, "fotosAdicionais"),
    where("empresaId", "==", empresaId),
    where("nomeLocal", "==", nomeLocal),
    where("nomeTecnico", "==", nomeTecnico),
    where("endereco", "==", endereco),
    where("dataHora", "==", Timestamp.fromDate(new Date(dataHora)))
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
