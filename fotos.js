// fotos.js
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dehekhogh";
const CLOUDINARY_UPLOAD_PRESET_IMG = "visitas_unsigned"; // preset de imagens
const CLOUDINARY_UPLOAD_FOLDER_IMG = "visitas";          // pasta de imagens

export function initFotosForm(db) {
  document.addEventListener('DOMContentLoaded', () => {
    // Preenche campos com dados da capa salvos no localStorage
    document.getElementById('tipo').value = localStorage.getItem('tipoServico') || '';
    document.getElementById('local').value = localStorage.getItem('nomeLocal') || '';
    document.getElementById('tecnico').value = localStorage.getItem('nomeTecnico') || '';
    document.getElementById('endereco').value = localStorage.getItem('endereco') || '';
    document.getElementById('dataHora').value = localStorage.getItem('dataHora') || '';
  });

  document.getElementById('fotoForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const foto = document.getElementById('foto').files[0];
    const btnSalvar = document.getElementById('btnSalvarFoto');
    const msgSucesso = document.getElementById('mensagemSucesso');
    const erroFoto = document.getElementById('erroFoto');

    erroFoto.textContent = '';
    erroFoto.style.display = 'none';
    msgSucesso.style.display = 'none';

    if (!foto) {
      erroFoto.textContent = 'Por favor, selecione uma foto antes de continuar.';
      erroFoto.style.display = 'block';
      return;
    }

    // Recupera dados essenciais
    const empresaId = localStorage.getItem('empresaId') || '';
    const tecnicoId = localStorage.getItem('usuarioId') || '';
    const tipoServico = document.getElementById('tipo').value;
    const nomeLocal = document.getElementById('local').value;
    const nomeTecnico = document.getElementById('tecnico').value;
    const endereco = document.getElementById('endereco').value;
    const dataHora = document.getElementById('dataHora').value;

    if (!empresaId || !tecnicoId) {
      alert("Usuário ou empresa não identificados. Faça login novamente.");
      return;
    }

    try {
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Enviando...";

      // Upload para Cloudinary
      const fotoURL = await uploadImagemCloudinary(foto);

      // Salva no Firestore
      await addDoc(collection(db, "fotosAdicionais"), {
        empresaId,
        tecnicoId,
        tipoServico,
        nomeLocal,
        nomeTecnico,
        endereco,
        dataHora: Timestamp.fromDate(new Date(dataHora)),
        fotoURL
      });

      msgSucesso.style.display = 'block';
      this.reset();

    } catch (error) {
      alert("Erro ao salvar foto: " + error.message);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Foto";
    }
  });
}

async function uploadImagemCloudinary(file) {
  const maxMB = 8;
  if (file.size > maxMB * 1024 * 1024) throw new Error(`Imagem acima de ${maxMB} MB.`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET_IMG);
  if (CLOUDINARY_UPLOAD_FOLDER_IMG) formData.append("folder", CLOUDINARY_UPLOAD_FOLDER_IMG);

  const baseName = `${Date.now()}_${file.name}`.replace(/\s+/g, "_");
  formData.append("public_id", baseName);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const resp = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.secure_url;
}
