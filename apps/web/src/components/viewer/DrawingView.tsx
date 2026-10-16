import { AutodeskViewer } from './AutodeskViewer';
import { Alert, Badge } from '@/components/ds';
import type { DrawingView as View } from '@/lib/drawing-view';

const APS_LABEL: Record<string, string> = {
  not_started: 'Not sent to Autodesk',
  uploading: 'Uploading to Autodesk',
  uploaded: 'Uploaded',
  translating: 'Translating',
  success: 'Ready to view',
  failed: 'Translation failed',
  unsupported: 'Format not supported',
};

/**
 * One viewer for every role: PDF in the browser, CAD through the Autodesk Viewer. The access rules
 * are decided before this component is rendered (lib/drawing-view.ts), so it only displays.
 */
export function DrawingView({ view, downloadLabel = 'Download' }: { view: View; downloadLabel?: string }) {
  const { file } = view;
  const status = file.aps_status ?? 'not_started';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral">{file.format.toUpperCase()}</Badge>
          {view.isCad && <Badge tone={status === 'success' ? 'success' : status === 'failed' ? 'error' : 'info'}>{APS_LABEL[status] ?? status}</Badge>}
        </div>
        {view.downloadUrl && (
          <a className="text-sm font-semibold text-brand-700 underline" href={view.downloadUrl}>{downloadLabel}</a>
        )}
      </div>
      {view.isCad ? (
        !view.cadAllowed ? (
          <Alert tone="info">{view.cadBlockedReason}</Alert>
        ) : status === 'success' ? (
          <AutodeskViewer fileId={file.id} label={file.original_name} />
        ) : status === 'failed' ? (
          <Alert tone="error">{file.aps_error ?? 'Translation failed. Ask the firm to check the file.'}</Alert>
        ) : (
          <Alert tone="info">This file is not ready to view yet. Translation takes a few minutes after upload.</Alert>
        )
      ) : view.pdfUrl ? (
        <iframe src={view.pdfUrl} title={`PDF of ${file.original_name}`} className="h-[75vh] w-full rounded-md border border-border bg-surface" />
      ) : (
        <Alert tone="error">This file could not be opened.</Alert>
      )}
    </div>
  );
}
