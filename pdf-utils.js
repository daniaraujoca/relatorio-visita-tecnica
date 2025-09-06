// pdf-utils.js
// Geração de PDF (jsPDF) e upload de PDF (Cloudinary raw)

export async function ensureJsPDF() {
  if (!window.jsPDF) {
    const mod = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js");
    window.jsPDF = mod.jsPDF;
  }
}

export async function imageUrlToDataUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Falha ao carregar imagem para o PDF.");
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function gerarPDFVisita(visita, fotosAdicionais = [], logoEmpresaUrl = null) {
  await ensureJsPDF();
  const doc = new window.jsPDF({ unit: "mm", format: "a4" });
  let y = 15;

  // Cabeçalho com logo (opcional)
  if (logoEmpresaUrl) {
    try {
      const logo = await imageUrlToDataUrl(logoEmpresaUrl);
      doc.addImage(logo, "PNG", 10, 10, 25, 12);
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Visita Técnica", 40, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const linhas = [
    `Empresa: ${visita.nomeEmpresa || "—"}`,
    `Técnico: ${visita.nomeTecnico}`,
    `Tipo de Serviço: ${visita.tipoServico}`,
    `Local: ${visita.nomeLocal}`,
    `Endereço: ${visita.endereco}`,
    `Data/Hora: ${new Date(visita.dataHora).toLocaleString()}`
  ];
  linhas.forEach((t) => { doc.text(t, 10, y); y += 6; });

  y += 2;
  doc.setDrawColor(200);
  doc.line(10, y, 200, y);
  y += 6;

  // Fotos
  doc.setFont("helvetica", "bold");
  doc.text("Registro Fotográfico", 10, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  const addPageIfNeeded = (h = 70) => {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + h > pageH - 10) {
      doc.addPage();
      y = 15;
    }
  };

  // Foto principal
  if (visita.fotoURL) {
    try {
      addPageIfNeeded(70);
      const dataUrl = await imageUrlToDataUrl(visita.fotoURL);
      doc.text("Foto principal:", 10, y);
      y += 6;
      doc.addImage(dataUrl, "JPEG", 10, y, 90, 60);
      y += 66;
    } catch {}
  }

  // Fotos adicionais
  if (fotosAdicionais.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Fotos adicionais:", 10, y);
    doc.setFont("helvetica", "normal");
    y += 6;

    const w = 90, h = 60;
    let col = 0;
    for (const f of fotosAdicionais) {
      addPageIfNeeded(h + 12);
      try {
        const dataUrl = await imageUrlToDataUrl(f.fotoURL);
        const x = col === 0 ? 10 : 110;
        doc.addImage(dataUrl, "JPEG", x, y, w, h);
        if (col === 1) { y += h + 8; col = 0; } else { col = 1; }
      } catch {}
    }
    if (col === 1) y += h + 8;
  }

  // Rodapé
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Emitido em: ${new Date().toLocaleString()}`, 10, pageH - 10);

  return doc.output("blob");
}

export async function uploadPDFToCloudinary(pdfBlob, filename, cloudName, uploadPreset, folder = "visits_pdfs") {
  const formData = new FormData();
  formData.append("file", pdfBlob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  formData.append("upload_preset", uploadPreset);
  if (folder) formData.append("folder", folder);

  // resource_type = raw → usando endpoint /raw/upload
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
  const resp = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.secure_url;
}
