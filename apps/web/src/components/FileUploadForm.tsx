'use client';

import { useRef, useState } from 'react';
import { prepareUpload, recordUpload } from '@/app/actions/sheets';
import { completeApsUpload, startApsUpload } from '@/app/actions/aps';
import { uploadParts } from '@/lib/aps-upload';
import { Alert, Button, inputClass } from './ds';

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload in steps. The file goes straight to storage (large CAD files never pass through a function).
 * CAD files are then sent to Autodesk the same way, and translation starts.
 */
export function FileUploadForm({ projectCode, sheetNumber }: { projectCode: string; sheetNumber: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'warning'; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return setMessage({ tone: 'error', text: 'Choose a file first.' });
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await prepareUpload({ projectCode, sheetNumber, fileName: file.name, sizeBytes: file.size });
      if ('error' in prepared) throw new Error(prepared.error);
      const put = await fetch(prepared.url, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } });
      if (!put.ok) throw new Error('The upload did not complete. Check your connection and try again.');
      const sha256 = await sha256Hex(file);
      const recorded = await recordUpload({ projectCode, sheetNumber, path: prepared.path, fileName: file.name, sizeBytes: file.size, sha256 });
      if ('error' in recorded) throw new Error(recorded.error);
      let text = recorded.nameWarning ? `Stored. ${recorded.nameWarning}` : 'File stored.';
      let tone: 'success' | 'warning' = recorded.nameWarning ? 'warning' : 'success';
      if (recorded.needsAutodesk) {
        const plan = await startApsUpload(recorded.fileId);
        if ('error' in plan) {
          text += ` Autodesk: ${plan.error}`;
          tone = 'warning';
        } else {
          await uploadParts(file, plan.urls);
          const done = await completeApsUpload(recorded.fileId, plan.uploadKey);
          if (done?.error) {
            text += ` Autodesk: ${done.error}`;
            tone = 'warning';
          } else {
            text += ' Sent to Autodesk; viewing will be ready after translation.';
          }
        }
      }
      setMessage({ tone, text });
      if (input.current) input.current.value = '';
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Upload failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="file" className="text-[13px] font-semibold">Drawing file (PDF, DWG, RVT, IFC or NWD)</label>
      <input id="file" ref={input} type="file" accept=".pdf,.dwg,.rvt,.ifc,.nwd" className={inputClass} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" pending={busy}>{busy ? 'Uploading…' : 'Upload file'}</Button>
        {message && <Alert tone={message.tone === 'warning' ? 'warning' : message.tone === 'success' ? 'success' : 'error'}>{message.text}</Alert>}
      </div>
    </form>
  );
}
