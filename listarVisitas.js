// listarVisitas.js

import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { gerarPDFVisita, uploadPDFToCloudinary } from "./pdf-utils.js";

// Elementos da página
const visitasContainer = document.getElementById("visitasContainer");
const btnFiltrar = document.getElementById("btnFiltrar");
const loading = document.getElementById("loading");

// Configuração Cloudinary para PDFs
const CLOUDINARY_CLOUD_NAME = "dehekhogh";
const CLOUDINARY_PDF_PRESET = "visits_pdfs_unsigned";
const CLOUDINARY_PDF_FOLDER = "visits_pdfs";

// Proteção de rota: só permite acesso se estiver autenticado
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("index.html");
  }
});

// Quando clicar em “Filtrar”, recarrega a lista
btnFiltrar.addEventListener("click", carregarVisitas);

// Carrega visitas no carregamento da página
carregarVisitas();

async function carregarVisitas() {
  visitasContainer.innerHTML = "";
  loading.style.display = "block";

  const empresaId = localStorage.getItem("empresaId") || "";
  const filtroTecnico = (document.getElementById("filtroTecnico").value || "").toLowerCase();
  const filtroData    = document.getElementById("filtroData").value || "";
  const filtroServico = document.getElementById("filtroServico").value || "";

  if (!empresaId) {
    visitasContainer.innerHTML = "<p>Empresa não identificada. Faça login novamente.</p>";
    loading.style.display = "none";
    return;
  }

  try {
    // Busca todas as visitas da empresa
    const baseQuery = query(
      collection(db, "visitas"),
      where("empresaId", "==", empresaId)
    );
    const snap = await getDocs(baseQuery);

    let encontrou = false;

    for (const docVisita of snap.docs) {
      const visita = docVisita.data();
      const visitaId = docVisita.id;

      // Converte Timestamp para Date se necessário
      const dataVisita = visita.dataHora.toDate
        ? visita.dataHora.toDate()
        : new Date(visita.dataHora);

      // Aplica filtros
      const tecnicoMatch = visita.nomeTecnico
        .toLowerCase()
        .includes(filtroTecnico);
      const dataMatch = !filtroData
        || dataVisita.toISOString().slice(0, 10) === filtroData;
      const servicoMatch = !filtroServico
        || visita.tipoServico === filtroServico;

      if (!(tecnicoMatch && dataMatch && servicoMatch)) {
        continue;
      }
      encontrou = true;

      // Busca fotos adicionais relacionadas
      const fotosAdicionais = await buscarFotosAdicionais(visita);

      // Monta HTML das fotos
      let fotosHTML = `
        <img
          src="${visita.fotoURL}"
          alt="Foto principal da visita em ${visita.nomeLocal}"
          class="foto-principal"
          data-lightbox
        />
      `;
      if (fotosAdicionais.length > 0) {
        fotosHTML += `<div class="fotos-adicionais">`;
        for (const f of fotosAdicionais) {
          fotosHTML += `
            <img
              src="${f.fotoURL}"
              alt="Foto adicional da visita em ${visita.nomeLocal}"
              data-lightbox
            />
          `;
        }
        fotosHTML += `</div>`;
      }

      // Monta ações de PDF
      const acoesHTML = visita.pdfURL
        ? `<a class="btn" href="${visita.pdfURL}" target="_blank" rel="noopener">Baixar PDF</a>`
        : `<button class="btn" data-gerar-pdf="${visitaId}">Gerar PDF</button>`;

      // Cria card de visita
      const visitaCard = document.createElement("div");
      visitaCard.className = "visita-card";
      visitaCard.innerHTML = `
        ${fotosHTML}
        <h3>${visita.nomeLocal}</h3>
        <p><strong>Técnico:</strong> ${visita.nomeTecnico}</p>
        <p><strong>Serviço:</strong> ${visita.tipoServico}</p>
        <p><strong>Endereço:</strong> ${visita.endereco}</p>
        <p><strong>Data:</strong> ${dataVisita.toLocaleString()}</p>
        <div class="acoes-visita">${acoesHTML}</div>
      `;

      visitasContainer.appendChild(visitaCard);
    }

    if (!encontrou) {
      visitasContainer.innerHTML = "<p>Nenhuma visita encontrada com os filtros aplicados.</p>";
    }

    ativarLightbox();
    ativarBotoesPDF();

  } catch (error) {
    console.error("Erro ao carregar visitas:", error);
    visitasContainer.innerHTML = "<p>Erro ao carregar visitas.</p>";
  } finally {
    loading.style.display = "none";
  }
}

async function buscarFotosAdicionais(visita) {
  const fotos = [];
  try {
    const q = query(
      collection(db, "fotosAdicionais"),
      where("empresaId", "==", visita.empresaId),
      where("nomeLocal", "==", visita.nomeLocal),
      where("nomeTecnico", "==", visita.nomeTecnico),
      where("endereco", "==", visita.endereco),
      where("dataHora", "==", visita.dataHora)
    );
    const snap = await getDocs(q);
    snap.forEach(docSnap => fotos.push(docSnap.data()));
  } catch (err) {
    console.error("Erro ao buscar fotos adicionais:", err);
  }
  return fotos;
}

// Lightbox acessível
function ativarLightbox() {
  const imagens = document.querySelectorAll("[data-lightbox]");
  imagens.forEach(img => {
    img.addEventListener("click", () => {
      const overlay = document.createElement("div");
      overlay.className = "lightbox-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-label", "Imagem ampliada, clique para fechar");
      overlay.tabIndex = -1;

      const big = document.createElement("img");
      big.src = img.src;
      big.className = "lightbox-img";
      big.alt = img.alt || "Imagem ampliada";

      overlay.appendChild(big);
      document.body.appendChild(overlay);
      document.body.classList.add("no-scroll");
      overlay.focus();

      const close = () => {
        document.body.classList.remove("no-scroll");
        overlay.remove();
        document.removeEventListener("keydown", onEsc);
      };
      const onEsc = e => { if (e.key === "Escape") close(); };

      overlay.addEventListener("click", close);
      document.addEventListener("keydown", onEsc);
    });
  });
}

// Botões de gerar PDF
function ativarBotoesPDF() {
  document.querySelectorAll("[data-gerar-pdf]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const visitaId = btn.getAttribute("data-gerar-pdf");
      try {
        btn.disabled = true;
        btn.textContent = "Gerando...";

        // Coleta dados do card
        const card = btn.closest(".visita-card");
        const nomeLocal   = card.querySelector("h3").textContent;
        const linhas      = card.querySelectorAll("p");
        const nomeTecnico = linhas[0].textContent.replace("Técnico:", "").trim();
        const tipoServico = linhas[1].textContent.replace("Serviço:", "").trim();
        const endereco    = linhas[2].textContent.replace("Endereço:", "").trim();
        const dataStr     = linhas[3].textContent.replace("Data:", "").trim();
        const fotoPrincipal = card.querySelector(".foto-principal")?.src || null;
        const fotosAdicNodes = card.querySelectorAll(".fotos-adicionais img");
        const fotosAdicionais = Array.from(fotosAdicNodes).map(n => ({ fotoURL: n.src }));

        // Contexto para PDF
        const empresaId   = localStorage.getItem("empresaId") || "";
        const nomeEmpresa = localStorage.getItem("nomeEmpresa") || "";
        if (!empresaId) throw new Error("Empresa não identificada.");

        const visitaPlain = {
          empresaId,
          nomeEmpresa,
          nomeTecnico,
          tipoServico,
          nomeLocal,
          endereco,
          dataHora: new Date(dataStr).toISOString(),
          fotoURL: fotoPrincipal
        };

        // Gera PDF
        const pdfBlob = await gerarPDFVisita(visitaPlain, fotosAdicionais);
        const filename = `visita_${visitaId}_${Date.now()}`;

        // Envia para Cloudinary (raw)
        const pdfURL = await uploadPDFToCloudinary(
          pdfBlob,
          filename,
          CLOUDINARY_CLOUD_NAME,
          CLOUDINARY_PDF_PRESET,
          CLOUDINARY_PDF_FOLDER
        );

        // Atualiza Firestore com o PDF
        await updateDoc(doc(db, "visitas", visitaId), {
          pdfURL,
          pdfGeradoEm: Timestamp.now()
        });

        // Substitui botão por link
        const acoes = card.querySelector(".acoes-visita");
        acoes.innerHTML = `<a class="btn" href="${pdfURL}" target="_blank" rel="noopener">Baixar PDF</a>`;

      } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
      } finally {
        if (document.body.contains(btn)) {
          btn.disabled = false;
          btn.textContent = "Gerar PDF";
        }
      }
    });
  });
}
