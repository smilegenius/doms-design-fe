import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visiblePages = pages.filter((page) => {
    if (totalPages <= 7) return true;
    if (page === 1 || page === totalPages) return true;
    if (Math.abs(page - currentPage) <= 1) return true;
    return false;
  });

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-[#E0E0E6] bg-white">
      <div className="text-sm text-[#5A5568]">
        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to{' '}
        {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg hover:bg-[#F3F3F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#717182]" />
          </button>

          <div className="flex items-center gap-1">
            {visiblePages.map((page, index) => {
              const prevPage = visiblePages[index - 1];
              const showEllipsis = prevPage && page - prevPage > 1;

              return (
                <div key={page} className="flex items-center gap-1">
                  {showEllipsis && (
                    <span className="px-2 text-[#717182]">...</span>
                  )}
                  <button
                    onClick={() => onPageChange(page)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      page === currentPage
                        ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white'
                        : 'hover:bg-[#F3F3F5] text-[#030213]'
                    }`}
                  >
                    {page}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg hover:bg-[#F3F3F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#717182]" />
          </button>
        </div>

        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="px-3 py-2 border border-[#E0E0E6] rounded-lg text-sm text-[#030213] bg-white hover:bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#7C6FE7]/20"
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>
    </div>
  );
}
