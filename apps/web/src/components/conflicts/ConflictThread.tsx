import { ActionForm } from '@/components/ActionForm';
import { Badge, Card, FormField, textareaClass } from '@/components/ds';
import { formatIst } from '@/lib/format';
import { replyConflict, closeConflict } from '@/app/actions/conflicts';

export interface ThreadMessage {
  id: string;
  body: string;
  created_at: string;
  authorName: string;
  authorIsClient: boolean;
}

/** Back-and-forth thread (CFL-02). The same view serves the client and the firm. */
export function ConflictThread({ conflictId, messages, closed, canClose }: { conflictId: string; messages: ThreadMessage[]; closed: boolean; canClose: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <ol aria-label="Conversation" className="flex flex-col gap-4">
          {messages.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-md border px-4 py-3 ${m.authorIsClient ? 'border-border bg-surface' : 'ml-auto border-brand-200 bg-brand-50'}`}>
              <p className="text-xs font-semibold text-text-muted">{m.authorName} · {formatIst(m.created_at)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
            </li>
          ))}
        </ol>
      </Card>
      {!closed ? (
        <Card>
          <h2 className="mb-4 text-base font-semibold">Reply</h2>
          <ActionForm action={replyConflict} submitLabel="Send reply">
            <input type="hidden" name="conflictId" value={conflictId} />
            <FormField label="Message" htmlFor="body" required>
              <textarea id="body" name="body" required rows={4} maxLength={10000} className={textareaClass} />
            </FormField>
          </ActionForm>
        </Card>
      ) : (
        <Badge tone="neutral">This conflict is closed.</Badge>
      )}
      {canClose && !closed && (
        <ActionForm action={closeConflict} submitLabel="Close conflict" variant="secondary">
          <input type="hidden" name="conflictId" value={conflictId} />
        </ActionForm>
      )}
    </div>
  );
}
