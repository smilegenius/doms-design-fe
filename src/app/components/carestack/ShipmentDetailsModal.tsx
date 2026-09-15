import { useState } from 'react';
import { Truck } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import type { CaseLike } from '../../data/carestack';
import { COURIERS, recordShipment } from '../../data/carestack';
import { CS_CURRENT_USER, dmyToIso, ghostBtn, inputCls, isoToDmy, labelCls, primaryBtn, todayIso } from './shared';

// Captured when a case moves to Shipped while CareStack is on. Feeds the
// Shipping sub-tab, the CareStack appointment note and the shipment email.
export default function ShipmentDetailsModal({
  caseData, onClose, currentUser = CS_CURRENT_USER,
}: {
  caseData: CaseLike;
  onClose: () => void;
  currentUser?: string;
}) {
  const { toast } = useToast();
  const [shipmentDate, setShipmentDate] = useState(todayIso());
  const [courier, setCourier] = useState(COURIERS[0]);
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [expected, setExpected] = useState(dmyToIso(caseData.requestedDelivery));

  const save = () => {
    recordShipment(caseData, {
      shipmentDate: isoToDmy(shipmentDate),
      courier,
      trackingNumber: tracking.trim(),
      trackingUrl: trackingUrl.trim() || undefined,
      expectedDelivery: isoToDmy(expected),
    }, currentUser);
    toast.success(`Shipment recorded for ${caseData.id} — practice notified`);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Shipment details"
      size="md"
      footer={
        <>
          <button onClick={onClose} className={ghostBtn}>Add later</button>
          <button onClick={save} disabled={!shipmentDate} className={primaryBtn}><Truck className="w-3.5 h-3.5" />Save shipment</button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[#5A5568] leading-relaxed">
          <span className="font-semibold text-[#030213]">{caseData.id}</span> · {caseData.patientName} has been marked as shipped. Record how it is travelling so the practice can follow the delivery.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Shipment date <span className="text-[#D4183D]">*</span></label>
            <input type="date" value={shipmentDate} onChange={e => setShipmentDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Courier</label>
            <select value={courier} onChange={e => setCourier(e.target.value)} className={inputCls}>
              {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tracking number</label>
            <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="e.g. RM 1234 5678 9GB" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Expected delivery</label>
            <input type="date" value={expected} onChange={e => setExpected(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Tracking link <span className="normal-case tracking-normal text-[#A0A0B0]">(optional)</span></label>
            <input value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://" className={inputCls} />
          </div>
        </div>
        <p className="text-[10px] text-[#A0A0B0] leading-relaxed">
          If a CareStack appointment is linked, a “Lab Work Shipped” note is added to it. The dentist and practice manager are emailed (cc reception) either way.
        </p>
      </div>
    </Modal>
  );
}
