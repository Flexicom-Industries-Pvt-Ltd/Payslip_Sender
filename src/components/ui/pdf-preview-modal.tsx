import React, { useEffect, useState } from 'react';
import { Modal } from './modal';
import { Download, ExternalLink, FileText } from 'lucide-react';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  filename?: string;
  employeeName?: string;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  file,
  filename,
  employeeName,
}: PdfPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && isOpen) {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [file, isOpen]);

  const displayName = filename || file?.name || 'Salary Slip';

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Payslip Preview: ${displayName}`}
      description={employeeName ? `Assigned to: ${employeeName}` : 'Confidential in-memory attachment preview'}
      maxWidth="4xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-medium text-slate-700">{displayName}</span>
            {file && (
              <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Full Window
              </a>
            )}
          </div>
        </div>

        <div className="w-full h-[65vh] bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative flex items-center justify-center">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="text-sm text-slate-400">Preparing preview...</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

