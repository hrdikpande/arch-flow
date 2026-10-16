import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/access';
import { portalDrawingView } from '@/lib/drawing-view';
import { DrawingView } from '@/components/viewer/DrawingView';
import { PageHeader } from '@/components/ds';

/** Client view of one issued drawing (CLI-05). Same viewer as the firm's users; rules in lib/drawing-view.ts. */
export default async function PortalFilePage({ params }: { params: Promise<{ fileId: string }> }) {
  const access = await requireClient();
  const { fileId } = await params;
  const view = await portalDrawingView(access, fileId);
  if (!view) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={view.file.original_name}
        description="Issued drawing. Viewing is read-only."
        actions={<Link href="/portal" className="text-sm font-semibold text-brand-700 underline">Back to drawings</Link>}
      />
      <DrawingView view={view} />
    </div>
  );
}
