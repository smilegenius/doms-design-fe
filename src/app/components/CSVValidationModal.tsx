import { AlertCircle, CheckCircle2, Download, X } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

interface CSVValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  validRows: number;
  totalRows: number;
  errors: ValidationError[];
  fileName: string;
}

export default function CSVValidationModal({
  isOpen,
  onClose,
  onProceed,
  validRows,
  totalRows,
  errors,
  fileName,
}: CSVValidationModalProps) {
  const hasErrors = errors.length > 0;
  const errorCount = errors.length;

  const downloadErrorReport = () => {
    const csvContent = [
      'Row,Field,Error,Value',
      ...errors.map((e) => `${e.row},${e.field},${e.message},"${e.value}"`),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation_errors_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="CSV Validation Results"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {hasErrors && (
            <Button
              variant="outline"
              icon={<Download className="w-4 h-4" />}
              onClick={downloadErrorReport}
            >
              Download Error Report
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onProceed}
            disabled={validRows === 0}
          >
            Import {validRows} Valid Practice{validRows !== 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#F8F9FC] rounded-lg p-4 border border-[#E0E0E6]">
            <div className="text-sm text-[#717182] mb-1">Total Practices</div>
            <div className="text-2xl font-semibold text-[#030213]">{totalRows}</div>
          </div>
          <div className="bg-[#E8F5E9] rounded-lg p-4 border border-[#A5D6A7]">
            <div className="text-sm text-[#2E7D32] mb-1">Valid Practices</div>
            <div className="text-2xl font-semibold text-[#2E7D32]">{validRows}</div>
          </div>
          <div className="bg-[#FFEBEE] rounded-lg p-4 border border-[#FFCDD2]">
            <div className="text-sm text-[#C62828] mb-1">Errors Found</div>
            <div className="text-2xl font-semibold text-[#C62828]">{errorCount}</div>
          </div>
        </div>

        {/* File Info */}
        <div className="flex items-center gap-2 text-sm text-[#5A5568]">
          <span className="font-medium">File:</span>
          <span>{fileName}</span>
        </div>

        {/* Status Message */}
        {!hasErrors ? (
          <div className="bg-[#E8F5E9] border border-[#A5D6A7] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2E7D32] mt-0.5" />
              <div>
                <h4 className="font-medium text-[#2E7D32] mb-1">
                  Validation Successful
                </h4>
                <p className="text-sm text-[#2E7D32]">
                  All {totalRows} practices passed validation. Click "Import" to proceed.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFF9E6] border border-[#FFE5A0] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#E65100] mt-0.5" />
              <div>
                <h4 className="font-medium text-[#030213] mb-1">
                  Validation Issues Found
                </h4>
                <p className="text-sm text-[#5A5568]">
                  {errorCount} error{errorCount !== 1 ? 's' : ''} detected. You can import {validRows} valid practice{validRows !== 1 ? 's' : ''} or fix the errors and re-upload.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error List */}
        {hasErrors && (
          <div className="border border-[#E0E0E6] rounded-lg overflow-hidden">
            <div className="bg-[#F3F3F5] px-4 py-3 border-b border-[#E0E0E6]">
              <h4 className="font-semibold text-[#030213]">Validation Errors</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-[#FAFBFC] sticky top-0">
                  <tr className="border-b border-[#E0E0E6]">
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">
                      Row
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">
                      Field
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">
                      Error
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error, index) => (
                    <tr
                      key={index}
                      className="border-b border-[#E0E0E6] hover:bg-[#F8F9FC]"
                    >
                      <td className="px-4 py-3 text-sm text-[#030213] font-medium">
                        {error.row}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5A5568]">
                        {error.field}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#C62828]">
                        {error.message}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#717182]">
                        {error.value || '(empty)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
