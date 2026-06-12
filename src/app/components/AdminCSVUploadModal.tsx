import { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, FileText, Download } from 'lucide-react';
import { GlobalSupplier } from '../data/globalSuppliersData';

interface AdminCSVUploadModalProps {
  onImport: (suppliers: GlobalSupplier[]) => void;
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  category: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  glCode: string;
  error?: string;
}

const COLORS = [
  'bg-[#E8F0FE] text-[#4D8EF7]', 'bg-[#E8F5E9] text-[#2E7D32]',
  'bg-[#FFF3E0] text-[#E65100]', 'bg-[#EDE7F6] text-[#6A1B9A]',
  'bg-[#E0F7FA] text-[#00838F]', 'bg-[#FCE4EC] text-[#AD1457]',
];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const get = (key: string) => {
      const idx = headers.findIndex(h => h.includes(key));
      return idx >= 0 ? vals[idx] ?? '' : '';
    };
    const name = get('name') || get('supplier');
    const row: ParsedRow = {
      name,
      category: get('category') || get('cat'),
      country: get('country') || get('cc'),
      email: get('email') || get('mail'),
      phone: get('phone') || get('tel'),
      website: get('website') || get('url') || get('web'),
      glCode: get('gl') || get('code'),
    };
    if (!row.name) row.error = 'Supplier name is required';
    return row;
  });
}

export default function AdminCSVUploadModal({ onImport, onClose }: AdminCSVUploadModalProps) {
  const [stage, setStage] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setStage('preview');
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleImport() {
    const valid = rows.filter(r => !r.error);
    const suppliers: GlobalSupplier[] = valid.map((r, i) => {
      const words = r.name.split(' ');
      const initials = words.map(w => w[0]).slice(0, 2).join('').toUpperCase();
      return {
        id: `gs_csv_${Date.now()}_${i}`,
        name: r.name,
        initials,
        avatarColor: COLORS[i % COLORS.length],
        country: r.country || 'GB',
        categories: r.category ? [r.category] : [],
        vendorId: `GV${String(Math.floor(Math.random() * 900 + 100))}`,
      };
    });
    onImport(suppliers);
    setStage('done');
  }

  function downloadTemplate() {
    const csv = 'Supplier Name,Category,Country,Email,Phone,Website,GL Code\nHenry Schein,Clinical,IE,contact@henryschein.com,+353 1 000 0000,henryschein.ie,2410\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'supplier_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => r.error);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
          <div>
            <h2 className="text-lg font-semibold text-[#030213]">
              {stage === 'upload' ? 'Import Suppliers via CSV' : stage === 'preview' ? 'Preview Import' : 'Import Complete'}
            </h2>
            <p className="text-xs text-[#717182] mt-0.5">
              {stage === 'upload' ? 'Upload a CSV file to bulk-add suppliers to the global registry.' : stage === 'preview' ? `${validRows.length} valid · ${errorRows.length} errors` : `${validRows.length} suppliers added to the global registry.`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload stage */}
        {stage === 'upload' && (
          <div className="p-7 space-y-5">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragging ? 'border-[#4D8EF7] bg-[#F0F5FF]' : 'border-[#D4CEE1] hover:border-[#4D8EF7] hover:bg-[#FAFBFF]'
              }`}
            >
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              <Upload className="w-10 h-10 text-[#A0A0B0] mx-auto mb-3" />
              <p className="text-sm font-medium text-[#030213]">Drop your CSV here or click to browse</p>
              <p className="text-xs text-[#A0A0B0] mt-1">Accepts .csv files up to 10 MB</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#F8F9FC] rounded-xl border border-[#E0E0E6]">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#717182]" />
                <div>
                  <p className="text-sm font-medium text-[#030213]">Download template</p>
                  <p className="text-xs text-[#717182]">CSV with all required columns pre-filled.</p>
                </div>
              </div>
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-white transition-colors">
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
        )}

        {/* Preview stage */}
        {stage === 'preview' && (
          <>
            <div className="overflow-y-auto flex-1 p-7">
              {errorRows.length > 0 && (
                <div className="mb-4 p-3 bg-[#FFEBEE] border border-[#EF9A9A] rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#C62828] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#C62828]">{errorRows.length} row{errorRows.length !== 1 ? 's' : ''} have errors and will be skipped.</p>
                </div>
              )}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#F0EFF6] bg-[#FAFAFA]">
                    {['STATUS', 'NAME', 'CATEGORY', 'COUNTRY', 'EMAIL', 'GL CODE'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider py-2.5 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8F9FC]">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.error ? 'bg-[#FFFAFA]' : ''}>
                      <td className="py-2.5 pr-4">
                        {r.error
                          ? <span className="flex items-center gap-1 text-[#C62828]"><AlertTriangle className="w-3 h-3" /> Error</span>
                          : <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]">Pending</span>
                        }
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-[#030213]">{r.name || <span className="text-[#C62828]">Missing</span>}</td>
                      <td className="py-2.5 pr-4 text-[#717182]">{r.category || '—'}</td>
                      <td className="py-2.5 pr-4 text-[#717182]">{r.country || '—'}</td>
                      <td className="py-2.5 pr-4 text-[#717182] max-w-[140px] truncate">{r.email || '—'}</td>
                      <td className="py-2.5 pr-4 text-[#717182]">{r.glCode || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-[#FAFBFC]">
              <button onClick={() => setStage('upload')} className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-white transition-colors">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Import {validRows.length} supplier{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {/* Done stage */}
        {stage === 'done' && (
          <div className="flex flex-col items-center justify-center py-20 px-8">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#2E7D32]" />
            </div>
            <h3 className="text-lg font-semibold text-[#030213] mb-2">{validRows.length} suppliers imported</h3>
            <p className="text-sm text-[#717182] text-center max-w-sm mb-6">
              All valid rows have been added to the global registry.
            </p>
            <button onClick={onClose} className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
