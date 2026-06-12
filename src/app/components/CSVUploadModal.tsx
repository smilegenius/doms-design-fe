import { useState, useRef } from 'react';
import { Upload, FileText, Download, X, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export default function CSVUploadModal({ isOpen, onClose, onUpload }: CSVUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (selectedFile) {
      setUploading(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onUpload(selectedFile);
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'Practice Name,Practice Code,Manager Name,Manager Email,Manager Phone,Dentist 1 Name,Dentist 1 Email,Dentist 1 Phone,Dentist 1 Performer Code,Dentist 2 Name,Dentist 2 Email,Dentist 2 Phone,Dentist 2 Performer Code,Staff 1 Name,Staff 1 Email,Staff 1 Phone\nSmile Genius Example,SGE-001,Sarah Chen,sarah@example.com,+44 20 1234 5678,Dr. John Smith,john.smith@example.com,+44 20 1234 5679,DEN-001,Dr. Jane Doe,jane.doe@example.com,+44 20 1234 5680,DEN-002,Emma Wilson,emma@example.com,+44 20 1234 5681';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'practice_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDragActive(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Practices from CSV"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={!selectedFile}
            loading={uploading}
          >
            Upload & Validate
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Template Download */}
        <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[#4D8EF7] mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-[#030213] mb-1">Need a template?</h4>
              <p className="text-sm text-[#5A5568] mb-3">
                Download our CSV template with the correct format and required columns
              </p>
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={downloadTemplate}
              >
                Download Template
              </Button>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-[#4D8EF7] bg-gradient-to-r from-[#4D8EF7]/5 to-[#A59DFF]/5'
              : 'border-[#E0E0E6] bg-[#FAFBFC]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-[#4D8EF7]" />
              <div className="text-left">
                <div className="font-medium text-[#030213]">{selectedFile.name}</div>
                <div className="text-sm text-[#717182]">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="ml-4 p-1 hover:bg-[#E8E5F0] rounded transition-colors"
              >
                <X className="w-5 h-5 text-[#717182]" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-[#717182] mx-auto mb-4" />
              <h3 className="font-medium text-[#030213] mb-2">
                Drag and drop your CSV file here
              </h3>
              <p className="text-sm text-[#5A5568] mb-4">or</p>
              <Button
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse Files
              </Button>
            </>
          )}
        </div>

        {/* Requirements */}
        <div className="bg-[#FFF9E6] border border-[#FFE5A0] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#E65100] mt-0.5" />
            <div>
              <h4 className="font-medium text-[#030213] mb-2">CSV Requirements</h4>
              <ul className="text-sm text-[#5A5568] space-y-1">
                <li>• File must be in CSV format (.csv)</li>
                <li>• <strong>Required:</strong> Practice Name, Practice Code</li>
                <li>• <strong>Required:</strong> At least one Practice Manager (Name, Email)</li>
                <li>• <strong>Required:</strong> At least one Dentist (Name, Email)</li>
                <li>• Optional: Practice Manager Phone, Dentist Phone/Performer Code</li>
                <li>• Optional: Multiple Dentists (Dentist 2, Dentist 3, etc.)</li>
                <li>• Optional: Staff members (Staff 1 Name/Email/Phone, etc.)</li>
                <li>• Email format must be valid</li>
                <li>• Practice Codes must be unique</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
