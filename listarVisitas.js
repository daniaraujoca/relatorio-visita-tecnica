import {
  collection, getDocs, query, where, updateDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { auth, db } from "./firebaseConfig.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { gerarPDFVisita, uploadPDFToCloudinary } from "./pdf-utils.js";

const visitasContainer = document.getElementById("visitasContainer");
const btnFiltrar = document.getElementById("btnFiltrar");
const loading = document.getElementById("loading");

// Proteção de rota
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("index.html");
  }
});

// Carrega ao iniciar e ao filtrar
btnFiltrar.addEventListener("click", carregarVisitas);
carregarVisitas();

async function carregarVisitas() {
  visitasContainer.innerHTML = "";
  loading.style.display = "block";

  const empresaId = localStorage.getItem("empresaId");
  const filtroTecnico = (document.getElementById("filtroTecnico").value || "").toLowerCase();
  const filtroData = document.getElementById("filtroData").value;
  const filtroServico = document.getElementById("filtroServico").value;

  if (!empresaId) {
    visitasContainer.innerHTML = "<p>Empresa não identificada.</p>";
    loading.style.display = "none";
    return;
  }

  try {
    const baseQuery = query(
      collection(db, "visitas"),
      where("empresaId", "==", empresaId)
    );
    const snap = await getDocs(baseQuery);
    let encontrou = false;

    for (const d of snap.docs) {
      const visita = d.data();
      const dataVisita = visita.dataHora.toDate
        ? visita.dataHora.toDate()
        : new Date(visita.dataHora);

      const tecnicoMatch = visita.nomeTecnico.toLowerCase().includes(filtroTecnico);
      const dataMatch = !filtroData || dataVisita.toISOString().slice(0,10) === filtroData;
      const servicoMatch = !filtroServico || visita.tipoServico === filtroServico;

      if (!(tecnicoMatch && dataMatch && servicoMatch)) continue;
      encontrou = true;

      // Buscar fotos adicionais
      const fotosAdicionais = await buscarFotosAdicionais(visita);

      // Monta card
      const card = document.createElement("div");
      card.className = "visita-card";
      let fotosHTML =
        `<img src="${visita.fotoURL}" alt="Foto em ${visita.nomeLocal}" class="foto-principal" data-lightbox>`;
      if (fotosAdicionais.length) {
        fotosHTML += `<div class="fotos-adicionais">` +
          fotosAdicionais.map((f, i) =>
            `<img src="${f.fotoURL}" alt="Adicional ${i+1}" data-lightbox>`
          ).join("") +
          `</div>`;
      }

      const acoesHTML = visita.pdfURL
        ? `<a class="btn" href="${visita.pdfURL}" target="_blank">Baixar PDF</a>`
        : `<button class="btn" data-gerar-pdf="${d.id}">Gerar PDF</button>`;

      card.innerHTML = `
        ${fotosHTML}
        <h3>${visita.nomeLocal}</h3>
        <p><strong>Técnico:</strong> ${visita.nomeTecnico}</p>
        <p><strong>Serviço:</strong> ${visita.tipoServico}</p>
        <p><strong>Endereço:</strong> ${visita.endereco}</p>
        <p><strong>Data:</strong> ${dataVisita.toLocaleString()}</p>
        <div class="acoes-visita">${acoesHTML}</div>
      `;
      visitasContainer.appendChild(card);
    }

    if (!encontrou) {
      visitasContainer.innerHTML = "<p>Nenhuma visita encontrada.</p>";
    }

    ativarLightbox();
    ativarBotoesPDF();

  } catch (e) {
    visitasContainer.innerHTML = "<p>Erro ao carregar visitas.</p>";
    console.error(e);
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
    console.error(err);
  }
  return fotos;
}

// Lightbox
function ativarLightbox() { /* ... mesmo código anterior ... */ }

// Botões PDF
function ativarBotoesPDF() { /* ... mesmo código anterior ... */ }
