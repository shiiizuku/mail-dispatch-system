import 'server-only';
import { MailService, connect, type MailDb } from '@mds/mail';

// One connection pool per server process, kept on globalThis so dev-mode reloads don't open new
// pools. The service itself is made per call (it is cheap), so a reload picks up new code.
const g = globalThis as unknown as { mailDb?: MailDb };

export function mailService(): MailService {
  g.mailDb ??= connect().db;
  return new MailService(g.mailDb);
}
