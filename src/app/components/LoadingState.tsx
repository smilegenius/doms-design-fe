import { Loader2 } from 'lucide-react';

export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-12 h-12 text-[#4D8EF7] animate-spin mb-4" />
      <p className="text-[#5A5568]">Loading practices...</p>
    </div>
  );
}
