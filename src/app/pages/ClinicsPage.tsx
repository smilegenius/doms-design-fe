import { useState, useMemo } from 'react';
import { Plus, Upload, Grid3x3, List, Filter } from 'lucide-react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import DropdownFilter from '../components/DropdownFilter';
import ClinicsTable from '../components/ClinicsTable';
import ClinicsGrid from '../components/ClinicsGrid';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import CSVUploadModal from '../components/CSVUploadModal';
import CSVValidationModal from '../components/CSVValidationModal';
import ImportSuccessModal from '../components/ImportSuccessModal';
import { Clinic, mockClinics } from '../data/clinicsData';

type ViewMode = 'table' | 'grid';

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>(mockClinics);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // CSV Import States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validRowCount, setValidRowCount] = useState(0);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [pendingImportData, setPendingImportData] = useState<Clinic[]>([]);

  // Filter options
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const cityOptions = useMemo(() => {
    const cities = Array.from(new Set(clinics.map((c) => c.city))).sort();
    return [
      { value: 'all', label: 'All Cities' },
      ...cities.map((city) => ({ value: city, label: city })),
    ];
  }, [clinics]);

  // Filtered and paginated clinics
  const filteredClinics = useMemo(() => {
    return clinics.filter((clinic) => {
      const matchesSearch =
        searchQuery === '' ||
        clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clinic.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clinic.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || clinic.status === statusFilter;
      const matchesCity = cityFilter === 'all' || clinic.city === cityFilter;

      return matchesSearch && matchesStatus && matchesCity;
    });
  }, [clinics, searchQuery, statusFilter, cityFilter]);

  const totalPages = Math.ceil(filteredClinics.length / itemsPerPage);
  const paginatedClinics = filteredClinics.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // CSV Import Handlers
  const handleFileUpload = (file: File) => {
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').filter((row) => row.trim());
      const headers = rows[0].split(',');

      const errors: ValidationError[] = [];
      const validData: Clinic[] = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',');
        const rowData: any = {};

        headers.forEach((header, index) => {
          rowData[header.trim()] = values[index]?.trim() || '';
        });

        // Validation
        let hasError = false;

        if (!rowData['Practice Name']) {
          errors.push({
            row: i + 1,
            field: 'Practice Name',
            message: 'Required field is missing',
            value: rowData['Practice Name'],
          });
          hasError = true;
        }

        if (!rowData['City']) {
          errors.push({
            row: i + 1,
            field: 'City',
            message: 'Required field is missing',
            value: rowData['City'],
          });
          hasError = true;
        }

        if (rowData['Email'] && !rowData['Email'].match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          errors.push({
            row: i + 1,
            field: 'Email',
            message: 'Invalid email format',
            value: rowData['Email'],
          });
          hasError = true;
        }

        if (!['active', 'inactive'].includes(rowData['Status']?.toLowerCase())) {
          errors.push({
            row: i + 1,
            field: 'Status',
            message: 'Status must be "active" or "inactive"',
            value: rowData['Status'],
          });
          hasError = true;
        }

        if (!hasError) {
          validData.push({
            id: `imported-${Date.now()}-${i}`,
            name: rowData['Practice Name'],
            address: rowData['Address'] || '',
            city: rowData['City'],
            country: rowData['Country'] || 'United Kingdom',
            contactPerson: rowData['Contact Person'] || '',
            phone: rowData['Phone'] || '',
            email: rowData['Email'] || '',
            licenseNumber: rowData['License Number'] || '',
            status: rowData['Status'].toLowerCase() as 'active' | 'inactive',
          });
        }
      }

      setValidationErrors(errors);
      setValidRowCount(validData.length);
      setTotalRowCount(rows.length - 1);
      setPendingImportData(validData);
      setUploadModalOpen(false);
      setValidationModalOpen(true);
    };

    reader.readAsText(file);
  };

  const handleProceedImport = () => {
    setClinics([...clinics, ...pendingImportData]);
    setValidationModalOpen(false);
    setSuccessModalOpen(true);
  };

  const handleEdit = (clinic: Clinic) => {
    console.log('Edit practice:', clinic);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCityFilter('all');
  };

  return (
    <Layout activePage="practice-management">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold text-[#030213]">Practice Management</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              icon={<Upload className="w-5 h-5" />}
              onClick={() => setUploadModalOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-5 h-5" />}
              onClick={() => console.log('Add practice')}
            >
              Add Practice
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-[#E0E0E6] p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <SearchInput
              placeholder="Search practices..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
              className="p-3 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity"
            >
              {viewMode === 'table' ? (
                <Grid3x3 className="w-5 h-5 text-white" />
              ) : (
                <List className="w-5 h-5 text-white" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-[#717182]" />
            <DropdownFilter
              label="Status"
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <DropdownFilter
              label="City"
              options={cityOptions}
              value={cityFilter}
              onChange={setCityFilter}
            />
            {(searchQuery || statusFilter !== 'all' || cityFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingState />
        ) : filteredClinics.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#E0E0E6]">
            <EmptyState
              type={searchQuery || statusFilter !== 'all' || cityFilter !== 'all' ? 'no-results' : 'no-clinics'}
              onAction={clearFilters}
            />
          </div>
        ) : (
          <>
            {viewMode === 'table' ? (
              <ClinicsTable clinics={paginatedClinics} onEdit={handleEdit} />
            ) : (
              <ClinicsGrid clinics={paginatedClinics} onEdit={handleEdit} />
            )}

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredClinics.length}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(items) => {
                    setItemsPerPage(items);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CSVUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleFileUpload}
      />

      <CSVValidationModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        onProceed={handleProceedImport}
        validRows={validRowCount}
        totalRows={totalRowCount}
        errors={validationErrors}
        fileName={uploadedFileName}
      />

      <ImportSuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        importedCount={validRowCount}
      />
    </Layout>
  );
}
