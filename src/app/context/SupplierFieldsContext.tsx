import { createContext, useContext, useState, ReactNode } from 'react';

export interface OrgSupplierField {
  id: string;
  label: string;
  required: boolean;
  placeholder: string;
}

interface SupplierFieldsContextType {
  fields: OrgSupplierField[];
  addField: (field: Omit<OrgSupplierField, 'id'>) => void;
  updateField: (id: string, updates: Partial<OrgSupplierField>) => void;
  removeField: (id: string) => void;
}

const defaultFields: OrgSupplierField[] = [
  { id: 'sale-rep',       label: 'Sale Rep',         required: false, placeholder: 'e.g. John Adams' },
  { id: 'payment-terms',  label: 'Payment Terms',    required: true,  placeholder: 'e.g. 1 Week, Net 15, Net 30' },
];

const SupplierFieldsContext = createContext<SupplierFieldsContextType | null>(null);

export function SupplierFieldsProvider({ children }: { children: ReactNode }) {
  const [fields, setFields] = useState<OrgSupplierField[]>(defaultFields);

  function addField(field: Omit<OrgSupplierField, 'id'>) {
    setFields(prev => [...prev, { ...field, id: `field-${Date.now()}` }]);
  }
  function updateField(id: string, updates: Partial<OrgSupplierField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }
  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
  }

  return (
    <SupplierFieldsContext.Provider value={{ fields, addField, updateField, removeField }}>
      {children}
    </SupplierFieldsContext.Provider>
  );
}

export function useSupplierFields() {
  const ctx = useContext(SupplierFieldsContext);
  if (!ctx) throw new Error('useSupplierFields must be used within SupplierFieldsProvider');
  return ctx;
}
