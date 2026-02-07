
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  ImageRun,
  HeadingLevel,
  UnderlineType,
  TableLayoutType
} from "docx";
import saveAs from "file-saver";
import { LPJData } from "../types";
import { formatIDR } from "../utils";

// Satuan twips (1/1440 inci). A4 content area ~9000 twips.
const COL_WIDTHS = {
  no: 700,
  date: 1500,
  desc: 3200,
  debit: 1800,
  kredit: 1800
};

export const exportToWord = async (data: LPJData) => {
  const { config, transactions } = data;
  
  const totalIncome = transactions
    .filter(t => t.type === 'Pemasukan')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === 'Pengeluaran')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const tableHeaderRow = new TableRow({
    children: [
      new TableCell({ width: { size: COL_WIDTHS.no, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.date, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Tanggal", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Deskripsi", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Debit", bold: true })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: "Kredit", bold: true })], alignment: AlignmentType.CENTER })] }),
    ],
  });

  const transactionRows = transactions.map((t, i) => {
    return new TableRow({
      children: [
        new TableCell({ width: { size: COL_WIDTHS.no, type: WidthType.DXA }, children: [new Paragraph({ text: (i + 1).toString(), alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.date, type: WidthType.DXA }, children: [new Paragraph({ text: t.date, alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: COL_WIDTHS.desc, type: WidthType.DXA }, children: [new Paragraph({ text: t.description.toUpperCase() })] }),
        new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ text: t.type === 'Pemasukan' ? formatIDR(t.amount) : "-", alignment: AlignmentType.RIGHT })] }),
        new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ text: t.type === 'Pengeluaran' ? formatIDR(t.amount) : "-", alignment: AlignmentType.RIGHT })] }),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      new TableCell({ 
        columnSpan: 3, 
        width: { size: COL_WIDTHS.no + COL_WIDTHS.date + COL_WIDTHS.desc, type: WidthType.DXA }, 
        children: [new Paragraph({ children: [new TextRun({ text: "SUBTOTAL KAS", bold: true })], alignment: AlignmentType.RIGHT })] 
      }),
      new TableCell({ width: { size: COL_WIDTHS.debit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: formatIDR(totalIncome), bold: true })], alignment: AlignmentType.RIGHT })] }),
      new TableCell({ width: { size: COL_WIDTHS.kredit, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: formatIDR(totalExpense), bold: true })], alignment: AlignmentType.RIGHT })] }),
    ],
  });

  const balanceRow = new TableRow({
    children: [
      new TableCell({ 
        columnSpan: 3, 
        width: { size: COL_WIDTHS.no + COL_WIDTHS.date + COL_WIDTHS.desc, type: WidthType.DXA }, 
        children: [new Paragraph({ children: [new TextRun({ text: "SALDO AKHIR PANITIA", bold: true })], alignment: AlignmentType.RIGHT })] 
      }),
      new TableCell({ 
        columnSpan: 2, 
        width: { size: COL_WIDTHS.debit + COL_WIDTHS.kredit, type: WidthType.DXA }, 
        children: [new Paragraph({ children: [new TextRun({ text: formatIDR(balance), bold: true })], alignment: AlignmentType.CENTER })] 
      }),
    ],
  });

  const allPossibleSigners = [
    { name: config.chairpersonName, title: config.chairpersonTitle || 'Ketua Panitia' },
    { name: config.treasurerName, title: config.treasurerTitle || 'Bendahara' },
    { name: config.official3Name, title: config.official3Title || 'Jabatan 3' },
    { name: config.official4Name, title: config.official4Title || 'Jabatan 4' }
  ];
  const activeSigners = allPossibleSigners.filter(s => s.name && s.name.trim() !== '');
  const displaySigners = activeSigners.length === 0 ? allPossibleSigners.slice(0, 2) : activeSigners;

  const signatureCells = displaySigners.map(s => {
    return new TableCell({
      width: { size: 4500, type: WidthType.DXA }, // Setengah lebar A4
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [
        new Paragraph({ children: [new TextRun({ text: s.title, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
        new Paragraph({ text: "", spacing: { before: 1200, after: 1200 } }),
        new Paragraph({ 
          children: [new TextRun({ text: s.name || "....................", bold: true, underline: { type: UnderlineType.SINGLE } })], 
          alignment: AlignmentType.CENTER 
        }),
      ],
    });
  });

  const signatureRows = [];
  for (let i = 0; i < signatureCells.length; i += 2) {
    signatureRows.push(new TableRow({
      children: signatureCells.slice(i, i + 2)
    }));
  }

  const sections = [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "LAPORAN PERTANGGUNGJAWABAN (LPJ) KEUANGAN", bold: true, size: 28, underline: { type: UnderlineType.SINGLE } }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [
            new TextRun({ text: config.eventName.toUpperCase() || "[NAMA KEGIATAN]", bold: true, size: 36, color: "1E3A8A" }),
          ],
        }),
        config.organizationName ? new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: config.organizationName.toUpperCase(), bold: true, size: 24 }),
          ],
        }) : null,
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 400 },
          children: [
            new TextRun({ text: `TANGGAL LAPORAN: ${config.reportDate}`, bold: true, font: "Courier New" }),
          ],
        }),

        new Paragraph({ children: [new TextRun({ text: "I. PENDAHULUAN", bold: true })], spacing: { before: 400, after: 200 } }),
        new Paragraph({ children: [new TextRun(config.background || "Belum diisi.")], alignment: AlignmentType.JUSTIFIED, spacing: { after: 400 } }),

        new Paragraph({ children: [new TextRun({ text: "II. RINCIAN ANGGARAN KEUANGAN", bold: true })], spacing: { before: 400, after: 200 } }),
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: [tableHeaderRow, ...transactionRows, totalRow, balanceRow],
        }),

        new Paragraph({ children: [new TextRun({ text: "III. PENUTUP", bold: true })], spacing: { before: 400, after: 200 } }),
        new Paragraph({ children: [new TextRun(config.conclusion || "Belum diisi.")], alignment: AlignmentType.JUSTIFIED, spacing: { after: 800 } }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "MENGETAHUI,", bold: true })],
          spacing: { before: 600, after: 300 }
        }),
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: signatureRows,
          borders: { 
            top: { style: BorderStyle.NONE }, 
            bottom: { style: BorderStyle.NONE }, 
            left: { style: BorderStyle.NONE }, 
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
          },
        }),
      ].filter(Boolean) as any[],
    },
  ];

  const receiptImages = Array.from(new Set(transactions.map(t => t.receiptBase64).filter(Boolean)));
  if (receiptImages.length > 0) {
    (sections[0].children as any[]).push(new Paragraph({ 
      children: [new TextRun({ text: "LAMPIRAN BUKTI TRANSAKSI", bold: true, size: 40 })],
      alignment: AlignmentType.CENTER, 
      spacing: { before: 1000, after: 400 },
      pageBreakBefore: true
    }));
    
    for (const [idx, img] of receiptImages.entries()) {
        const relatedTx = transactions.find(t => t.receiptBase64 === img);
        (sections[0].children as any[]).push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: `BUKTI TRANSAKSI ${idx + 1}: ${relatedTx ? relatedTx.description : ''}`, bold: true, size: 24 }),
            ],
            spacing: { before: 400, after: 200 }
        }));
        try {
            const response = await fetch(img!);
            const arrayBuffer = await response.arrayBuffer();
            
            // Cast options to any to fix docx union type inference issue
            (sections[0].children as any[]).push(new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new ImageRun({
                        data: new Uint8Array(arrayBuffer),
                        transformation: { width: 450, height: 600 },
                    } as any),
                ],
                spacing: { after: 800 }
            }));
        } catch (e) {
            console.error("Failed to add image to Word doc", e);
        }
    }
  }

  const doc = new Document({ 
    sections,
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22 },
        },
      },
    }
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `LPJ_${config.eventName || "Laporan"}.docx`);
};
