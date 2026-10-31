import { printReportWindow } from '@/features/reports/reportUtils';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const printBookingDocument = (title: string, subtitle: string, headers: string[], rows: unknown[][]) => printReportWindow({
  title: escapeHtml(title), subtitle: escapeHtml(subtitle), headers: headers.map(escapeHtml), rows: rows.map(r => r.map(escapeHtml)),
});
