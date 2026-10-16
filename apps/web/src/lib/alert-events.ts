/** Event types an admin can switch on for WhatsApp alerts (WA-02). Mirrors the worker's list. */
export const ALERT_EVENT_TYPES_LIST: readonly string[] = [
  'file.uploaded',
  'approval.requested',
  'approval.escalated',
  'conflict.raised',
  'conflict.overdue',
  'clash.opened',
  'rfi.overdue',
  'sheet.stale_revision',
  'approval.approved',
  'approval.rejected',
  'conflict.responded',
  'transmittal.sent',
  'revision.issued',
];

export const EVENT_LABELS: Record<string, string> = {
  'file.uploaded': 'Drawing uploaded',
  'approval.requested': 'Approval requested',
  'approval.escalated': 'Approval escalated to owner',
  'conflict.raised': 'Client conflict raised (notice only)',
  'conflict.overdue': 'Client conflict overdue',
  'clash.opened': 'Critical clash opened',
  'rfi.overdue': 'RFI overdue',
  'sheet.stale_revision': 'Stale revision flag',
  'approval.approved': 'Decision: approved',
  'approval.rejected': 'Decision: rejected',
  'conflict.responded': 'Decision: conflict answered',
  'transmittal.sent': 'Decision: transmittal sent',
  'revision.issued': 'Decision: revision issued',
};
