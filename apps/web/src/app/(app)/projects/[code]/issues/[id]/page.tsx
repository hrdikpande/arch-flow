import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireInternal, projectByCode, canSee } from '@/lib/access';
import { adminDb } from '@/lib/supabase/admin';
import { internalDrawingView } from '@/lib/drawing-view';
import { DrawingView } from '@/components/viewer/DrawingView';
import { Badge, Card, PageHeader, Alert } from '@/components/ds';

/** Clash detail: the linked sheets, each drawn in the same viewer as the sheet page (CLS-05). */
export default async function ClashDetailPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const access = await requireInternal();
  const { code, id } = await params;
  const project = await projectByCode(code);
  if (!project || !canSee(access, project.id)) notFound();
  const db = adminDb();
  const { data: clash } = await db.from('clashes').select('id, number, title, description, priority, status, discipline_a, discipline_b').eq('id', id).eq('project_id', project.id).maybeSingle();
  if (!clash) notFound();
  const { data: links } = await db.from('clash_sheets').select('sheets:sheet_id(id, sheet_number, title, current_revision_id)').eq('clash_id', clash.id);
  const sheets = (links ?? []).map((l) => l.sheets as unknown as { id: string; sheet_number: string; title: string; current_revision_id: string | null } | null).filter(Boolean) as { id: string; sheet_number: string; title: string; current_revision_id: string | null }[];

  const cards = await Promise.all(
    sheets.slice(0, 6).map(async (sheet) => {
      if (!sheet.current_revision_id) return { sheet, view: null };
      const { data: file } = await db.from('files').select('id').eq('revision_id', sheet.current_revision_id).order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
      return { sheet, view: file ? await internalDrawingView(access, file.id) : null };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={project.code}
        title={`${clash.number} ${clash.title}`}
        description={`${clash.discipline_a ?? '—'} vs ${clash.discipline_b ?? '—'} · ${clash.status}`}
        actions={<Link href={`/projects/${code}/issues`} className="text-sm font-semibold text-brand-700 underline">Back to clashes</Link>}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={clash.priority === 'critical' ? 'error' : 'neutral'}>{clash.priority}</Badge>
        </div>
        {clash.description && <p className="mt-3 whitespace-pre-line text-sm">{clash.description}</p>}
      </Card>
      {cards.length === 0 && <Alert tone="info">No sheets are linked to this clash.</Alert>}
      {cards.map(({ sheet, view }) => (
        <Card key={sheet.id}>
          <h2 className="mb-4 text-lg font-semibold">
            <Link className="underline" href={`/projects/${code}/sheets/${encodeURIComponent(sheet.sheet_number)}`}>{sheet.sheet_number}</Link>
            <span className="ml-2 text-base font-normal text-text-secondary">{sheet.title}</span>
          </h2>
          {view ? <DrawingView view={view} /> : <Alert tone="info">No file uploaded for this sheet's current revision yet.</Alert>}
        </Card>
      ))}
    </div>
  );
}
