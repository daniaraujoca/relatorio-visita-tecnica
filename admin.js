// ... todo o seu código original até a parte do relatório ...

// Geração de relatório PDF (melhorado com tabela)
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

  const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js");
  const { default: autoTable } = await import("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/dist/jspdf.plugin.autotable.min.js");

  const docPDF = new jsPDF();
  docPDF.setFontSize(16);
  docPDF.text(`Relatório de Visitas - ${await nomeEmpresaPorId(empresaSel)}`, 10, 20);
  docPDF.setFontSize(11);

  autoTable(docPDF, {
    startY: 30,
    head: [['#', 'Data/Hora', 'Serviço', 'Local', 'Técnico']],
    body: visitas.map((v, idx) => [
      idx + 1,
      new Date(v.dataHora.seconds * 1000).toLocaleString(),
      v.tipoServico,
      v.nomeLocal,
      v.nomeTecnico
    ]),
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [0, 120, 215] }
  });

  docPDF.save(`relatorio_${empresaSel}_${dataInicio}_${dataFim}.pdf`);
});

// ... funções utilitárias originais ...

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

  // Ordena por nome
  const usuarios = [];
  snap.forEach(docSnap => usuarios.push(docSnap.data()));
  usuarios.sort((a, b) => a.nome.localeCompare(b.nome));

  let html = `
    <button onclick="carregarUsuarios()">Atualizar lista</button>
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

  usuarios.forEach(u => {
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
