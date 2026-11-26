import type { ReporteExportable, Celda } from "./exportable";

/**
 * Genera un libro `.xlsx` en memoria con las hojas `Información`, `Resumen` y `Detalle`.
 * Importa `exceljs` bajo demanda para evitar cargar la librería en el bundle inicial.
 *
 * @param reporte - Estructura exportable preparada con metadatos, indicadores y tablas.
 */
export async function generarExcel(reporte: ReporteExportable) {
  const ExcelJS = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  libro.creator = "Lavandería El Cobre";
  libro.created = reporte.generadoEn;
  libro.title = reporte.titulo;
  const informacion = libro.addWorksheet("Información");
  informacion.addRow(["Lavandería El Cobre", reporte.titulo]);
  informacion.addRow([
    "Generado en Chile",
    new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      dateStyle: "short",
      timeStyle: "medium",
    }).format(reporte.generadoEn),
  ]);
  for (const fila of [...reporte.metadatos, ...reporte.indicadores])
    informacion.addRow(fila);
  informacion.columns = [{ width: 32 }, { width: 85 }];
  for (const tabla of [reporte.resumen, reporte.detalle]) {
    const hoja = libro.addWorksheet(tabla.titulo);
    hoja.addRow(tabla.columnas);
    // Las cadenas se guardan como texto, incluso si empiezan con =, +, - o @.
    for (const fila of tabla.filas) hoja.addRow(fila);
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, hoja.rowCount), column: tabla.columnas.length },
    };
    hoja.columns.forEach((columna, indice) => {
      // Estima el ancho con una muestra acotada para no penalizar reportes extensos.
      columna.width = Math.min(
        48,
        Math.max(
          14,
          tabla.columnas[indice].length + 3,
          ...tabla.filas.slice(0, 100).map((f) => String(f[indice]).length + 2),
        ),
      );
      columna.eachCell?.((celda, row) => {
        if (row > 1 && typeof celda.value === "number")
          celda.numFmt = tabla.columnas[indice].includes("CLP")
            ? "#,##0.00"
            : "#,##0.##";
      });
    });
    if (tabla === reporte.resumen) {
      hoja.lastRow!.font = { bold: true };
      hoja.lastRow!.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEDD5" },
      };
    }
  }
  for (const hoja of libro.worksheets) {
    hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    hoja.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDB541A" },
    };
    hoja.getRow(1).height = 28;
    hoja.eachRow((row) =>
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: true };
      }),
    );
    // `paperSize: 9` corresponde a hoja A4 en la especificación OOXML.
    hoja.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  const contenido = await libro.xlsx.writeBuffer();
  return new Blob([new Uint8Array(contenido)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Genera un documento PDF A4 apaisado con metadatos, indicadores, tabla resumen
 * y tabla detalle en página separada, añadiendo cabecera y numeración al final.
 * Importa `jspdf` y `jspdf-autotable` de forma diferida.
 *
 * @param reporte - Estructura exportable preparada con metadatos, indicadores y tablas.
 */
export async function generarPdf(reporte: ReporteExportable) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({
    orientation: "landscape",
    format: "a4",
    compress: true,
  });
  doc.setProperties({ title: reporte.titulo, author: "Lavandería El Cobre" });
  doc.setFontSize(9);
  let y = 34;
  const emitTexto = (texto: string) => {
    const lineas = doc.splitTextToSize(texto, 267);
    doc.text(lineas, 15, y);
    y += lineas.length * 4 + 1;
  };
  for (const [nombre, valor] of reporte.metadatos)
    emitTexto(`${nombre}: ${valor}`);
  emitTexto(
    reporte.indicadores
      .map(
        ([nombre, valor]) =>
          `${nombre}: ${typeof valor === "number" ? valor.toLocaleString("es-CL", { maximumFractionDigits: 2 }) : valor}`,
      )
      .join("   |   "),
  );
  const formatear = (celda: Celda) =>
    typeof celda === "number"
      ? celda.toLocaleString("es-CL", { maximumFractionDigits: 2 })
      : celda;
  for (const [indice, tabla] of [reporte.resumen, reporte.detalle].entries()) {
    if (indice) {
      doc.addPage();
      y = 34;
    }
    doc.setFontSize(11);
    doc.text(tabla.titulo, 15, y + 3);
    autoTable(doc, {
      startY: y + 7,
      margin: { top: 32, bottom: 18, left: 15, right: 15 },
      head: [tabla.columnas],
      body: tabla.filas.map((fila) => fila.map(formatear)),
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.5,
        overflow: "linebreak",
      },
      headStyles: { fillColor: [219, 84, 26], textColor: 255 },
      alternateRowStyles: { fillColor: [253, 248, 243] },
      rowPageBreak: "avoid",
      didParseCell: (dato) => {
        if (
          dato.section === "body" &&
          typeof tabla.filas[dato.row.index]?.[dato.column.index] === "number"
        )
          dato.cell.styles.halign = "right";
        if (
          tabla === reporte.resumen &&
          dato.section === "body" &&
          dato.row.index === tabla.filas.length - 1
        ) {
          dato.cell.styles.fontStyle = "bold";
          dato.cell.styles.fillColor = [255, 237, 213];
        }
      },
    });
  }
  // Cabecera y pie se estampan al cierre para conocer el total real de páginas.
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.setTextColor(219, 84, 26);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Lavandería El Cobre", 15, 15);
    doc.setTextColor(41, 37, 36);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(reporte.titulo, 15, 23);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generado: ${new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" }).format(reporte.generadoEn)} · Horario de Chile`,
      15,
      201,
    );
    doc.text(`Página ${pagina} de ${paginas}`, 282, 201, { align: "right" });
  }
  return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
}

/**
 * Dispara la descarga de un `Blob` en el navegador y libera su object URL
 * tras una espera prudente para no cancelar descargas aún en curso.
 *
 * @param contenido - Archivo binario a descargar.
 * @param nombre - Nombre completo del archivo incluyendo extensión.
 */
export function descargarArchivo(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  try {
    enlace.click();
  } finally {
    enlace.remove();
    // Se difiere la revocación porque algunos navegadores leen el blob de forma asíncrona tras el click.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/**
 * Genera el reporte en el formato solicitado y dispara inmediatamente su descarga.
 *
 * @param reporte - Reporte normalizado para exportación.
 * @param formato - Formato de salida (`"pdf"` o `"excel"`).
 */
export async function exportarReporte(
  reporte: ReporteExportable,
  formato: "pdf" | "excel",
) {
  const contenido =
    formato === "pdf" ? await generarPdf(reporte) : await generarExcel(reporte);
  descargarArchivo(
    contenido,
    `${reporte.nombre}.${formato === "pdf" ? "pdf" : "xlsx"}`,
  );
}
