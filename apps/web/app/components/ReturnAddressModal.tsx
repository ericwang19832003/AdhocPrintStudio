"use client";

import { useState } from "react";
import { X, MapPin, AlertCircle } from "lucide-react";

type ReturnAddressModalProps = {
  initialLabel?: string;
  initialAddress?: string;
  onSave: (label: string, address: string) => void;
  onClose: () => void;
};

export function ReturnAddressModal({
  initialLabel = "",
  initialAddress = "",
  onSave,
  onClose,
}: ReturnAddressModalProps) {
  const [label, setLabel] = useState(initialLabel);
  const [address, setAddress] = useState(initialAddress);

  const lines = address.split("\n").filter((l) => l.trim());
  const isValid = label.trim() && lines.length >= 2;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <MapPin
              size={16}
              style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}
            />
            Return Address
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Label */}
          <div className="modal-field">
            <label className="modal-field-label" htmlFor="return-label">
              Label
            </label>
            <input
              id="return-label"
              type="text"
              className="modal-field-input"
              placeholder="e.g. Main Office"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Address textarea */}
          <div className="modal-field">
            <label className="modal-field-label" htmlFor="return-address">
              Address
            </label>
            <textarea
              id="return-address"
              className="modal-field-textarea"
              placeholder={"Acme Corp\n123 Main St\nSpringfield, IL 62701"}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={4}
            />
          </div>

          {/* Live preview */}
          {lines.length > 0 && (
            <div className="return-address-preview">
              <p className="return-preview-label">Preview</p>
              <div className="return-preview-block">
                {lines.map((line, i) => (
                  <div key={i} className="return-preview-line">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* USPS hint */}
          <div className="usps-hint">
            <AlertCircle size={13} className="usps-hint-icon" />
            <span>
              Use USPS format: Name, Street, City State ZIP on separate lines for best
              deliverability.
            </span>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-ghost-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-accent"
              disabled={!isValid}
              onClick={() => {
                onSave(label.trim(), address.trim());
                onClose();
              }}
            >
              Save address
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
