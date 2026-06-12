export function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#E0E0E6]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#E0E0E6] rounded w-3/4" />
          <div className="h-3 bg-[#E0E0E6] rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-[#E0E0E6] rounded w-full" />
        <div className="h-3 bg-[#E0E0E6] rounded w-2/3" />
      </div>
      <div className="h-6 bg-[#E0E0E6] rounded w-1/4" />
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 10 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg border border-[#E0E0E6] overflow-hidden">
      <table className="w-full">
        <thead className="bg-[#F3F3F5] border-b border-[#E0E0E6]">
          <tr>
            <th className="px-6 py-4">
              <div className="h-4 bg-[#E0E0E6] rounded w-20 animate-pulse" />
            </th>
            <th className="px-6 py-4">
              <div className="h-4 bg-[#E0E0E6] rounded w-24 animate-pulse" />
            </th>
            <th className="px-6 py-4">
              <div className="h-4 bg-[#E0E0E6] rounded w-16 animate-pulse" />
            </th>
            <th className="px-6 py-4">
              <div className="h-4 bg-[#E0E0E6] rounded w-20 animate-pulse" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-[#E0E0E6]">
              <td className="px-6 py-4">
                <div className="h-4 bg-[#E0E0E6] rounded w-32 animate-pulse" />
              </td>
              <td className="px-6 py-4">
                <div className="h-4 bg-[#E0E0E6] rounded w-24 animate-pulse" />
              </td>
              <td className="px-6 py-4">
                <div className="h-4 bg-[#E0E0E6] rounded w-20 animate-pulse" />
              </td>
              <td className="px-6 py-4">
                <div className="h-6 bg-[#E0E0E6] rounded w-16 animate-pulse" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-[#E0E0E6] border-t-[#4D8EF7] rounded-full animate-spin" />
    </div>
  );
}
