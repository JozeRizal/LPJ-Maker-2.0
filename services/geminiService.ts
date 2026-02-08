
import { GoogleGenAI, Type } from "@google/genai";
import { LPJData } from "../types";
import { formatIDR } from "../utils";

export const generateReportNarrative = async (data: LPJData, userApiKey?: string) => {
  // Gunakan key dari user jika ada, jika tidak gunakan dari environment
  const apiKey = userApiKey || process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  const totalIncome = data.transactions
    .filter(t => t.type === 'Pemasukan')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = data.transactions
    .filter(t => t.type === 'Pengeluaran')
    .reduce((sum, t) => sum + t.amount, 0);

  const transactionList = data.transactions
    .map(t => `- ${t.date}: ${t.description} (${t.type}: ${formatIDR(t.amount)})`)
    .join('\n');

  const prompt = `
    Bertindaklah sebagai Sekretaris Organisasi profesional. Buat narasi LPJ formal dalam Bahasa Indonesia.
    Kegiatan: ${data.config.eventName}
    Organisasi: ${data.config.organizationName}
    Ringkasan Kas: Masuk ${formatIDR(totalIncome)}, Keluar ${formatIDR(totalExpense)}, Saldo ${formatIDR(totalIncome - totalExpense)}.
    
    Detail Transaksi:
    ${transactionList}

    Berikan output JSON: "background" (paragraf pembuka yang elegan) dan "conclusion" (paragraf penutup dan harapan).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            background: { type: Type.STRING },
            conclusion: { type: Type.STRING }
          },
          required: ["background", "conclusion"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Narrative Error:", error);
    return null;
  }
};

export const analyzeReceipt = async (base64Image: string, userApiKey?: string) => {
  const apiKey = userApiKey || process.env.API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  const mimeType = base64Image.split(';')[0].split(':')[1];
  const base64Data = base64Image.split(',')[1];

  const prompt = `
    Tugas: Bertindak sebagai Auditor Keuangan. Ekstrak SEMUA informasi dari foto nota/struk ini dengan akurasi 100%.
    
    Aturan Ekstraksi:
    1. Ekstrak setiap baris item belanja secara individual.
    2. Masukkan diskon atau potongan harga sebagai angka NEGATIF (misal: -1500).
    3. Masukkan Pajak (PPN/Tax) sebagai item terpisah jika ada.
    4. Pastikan jumlah total dari semua item yang kamu ekstrak SAMA dengan "Grand Total" yang tertera di nota.
    5. Jika ada teks yang buram, berikan estimasi terbaik berdasarkan konteks harga.
    6. JANGAN gunakan huruf kapital semua untuk deskripsi. Gunakan format huruf normal (contoh: dari "SUSU" menjadi "Susu").

    Format JSON yang harus dikembalikan:
    {
      "transactions": [
        {
          "date": "YYYY-MM-DD (Gunakan tanggal yang tertera di nota, jika tidak ada gunakan hari ini)",
          "description": "Nama Barang / Jasa (Gunakan Huruf Normal, Bukan Kapital Semua)",
          "amount": angka_saja (positif untuk barang, negatif untuk diskon),
          "type": "Selalu 'Pengeluaran'"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING }
                },
                required: ["date", "description", "amount", "type"]
              }
            }
          },
          required: ["transactions"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Scan Error:", error);
    return null;
  }
};
