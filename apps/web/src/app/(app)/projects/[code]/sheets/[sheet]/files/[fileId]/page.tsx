import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { AutodeskViewer } from '@/components/viewer/AutodeskViewer';
import { Badge, PageHeader, Alert } from '@/components/ds';
import { refreshTranslation } from '@/app/actions/aps';
import { ActionForm } from '@/components/ActionForm';
import { CAD_FORMATS } from '@/lib/aps';

const APS_LABEL: Record<string, string> = {
  not_started: 'Not sent to Autodesk',
  uploading: 'Uploading to Autodesk',
  uploaded: 'Uploaded',
  translating: 'Translating',
  success: 'Ready to view',
  failed: 'Translation failed',
  unsupported: 'Format not supported',
};

export default async function FileViewPage({ params }: { params: Promise<{ code: string; sheet: string; fileId: string }> }) {
  const access = await requireInternal();
  const { code, sheet, fileId } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const { data: file } = await adminDb()
    .from('files')
    .select('id, original_name, format, storage_path, aps_status, aps_error, aps_checked_at, project_id')
    .eq('id', fileId)
    .eq('project_id', project.id)
    .maybeSingle();
  if (!file) notFound();
  const isCad = (CAD_FORMATS as readonly string[]).includes(file.format);
  let pdfUrl: string | null = null;
  if (file.format === 'pdf') {
    const { data } = await adminDb().storage.from('drawings').createSignedUrl(file.storage_path, 300);
    pdfUrl = data?.signedUrl ?? null;
  }
  const status = file.aps_status ?? 'not_started';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${project.code} · ${sheet}`}
        title={file.original_name}
        description="Viewing is read-only. Download is available from the sheet page."
        actions={<Link href={`/projects/${code}/sheets/${sheet}`} className="text-sm font-semibold text-brand-700 underline">Back to sheet</Link>}
      />
      {isCad ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={status === 'success' ? 'success' : status === 'failed' ? 'error' : 'info'}>{APS_LABEL[status] ?? status}</Badge>
            {file.aps_checked_at && <span className="text-xs text-text-muted">Checked {formatCheckTime(file.aps_checked_at)}</span>}
            {['translating', 'uploading'].includes(status) && (
              <ActionForm action={refreshTranslation} submitLabel="Check translation" variant="secondary">
                <input type="hidden" name="fileId" value={file.id} />
              </ActionForm>
            )}
          </div>
          {file.aps_error && <Alert tone="error">{file.aps_error}</Alert>}
          {status === 'success' ? <AutodeskViewer fileId={file.id} label={file.original_name} /> : <Alert tone="info">This file is not ready to view yet. Translation takes a few minutes after upload.</Alert>}
        </>
      ) : pdfUrl ? (
        <iframe src={pdfUrl} title={`PDF of ${file.original_name}`} className="h-[75vh] w-full rounded-md border border-border bg-surface" />
      ) : (
        <Alert tone="error">This file could not be opened.</Alert>
      )}
    </div>
  );
}

function formatCheckTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', hour12: false }).format(new Date(value)) + ' IST';
}
