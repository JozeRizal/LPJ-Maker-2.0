
export type TransactionType = 'Pemasukan' | 'Pengeluaran';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  receiptBase64?: string;
}

export interface ReportConfig {
  eventName: string;
  organizationName: string;
  reportDate: string;
  chairpersonName: string;
  chairpersonTitle: string; // Judul jabatan kustom untuk pejabat 1 (Ketua)
  treasurerName: string;
  treasurerTitle: string; // Judul jabatan kustom untuk pejabat 2 (Bendahara)
  official3Name?: string;
  official3Title?: string; // Judul jabatan kustom untuk pejabat 3
  official4Name?: string;
  official4Title?: string; // Judul jabatan kustom untuk pejabat 4
  background?: string;
  conclusion?: string;
}

export interface LPJData {
  config: ReportConfig;
  transactions: Transaction[];
}
