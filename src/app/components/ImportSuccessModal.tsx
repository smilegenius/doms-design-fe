import { CheckCircle2, ArrowRight } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface ImportSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  importedCount: number;
}

export default function ImportSuccessModal({ isOpen, onClose, importedCount }: ImportSuccessModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Successful"
      size="md"
    >
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-[#2E7D32]" />
        </div>
        <h3 className="text-2xl font-semibold text-[#030213] mb-2">
          Successfully Imported!
        </h3>
        <p className="text-[#5A5568] mb-6">
          {importedCount} practice{importedCount !== 1 ? 's' : ''} {importedCount !== 1 ? 'have' : 'has'} been imported successfully.
        </p>
        <Button
          variant="primary"
          onClick={onClose}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          View Practices
        </Button>
      </div>
    </Modal>
  );
}
