import { autorizado } from '@/lib/auth';
import { getGmailClient } from '@/lib/gmail';

export async function GET(request) {
  if (!autorizado(request)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const env = {
    TYPESAFE_API_KEY: !!process.env.TYPESAFE_API_KEY,
    GMAIL_CLIENT_ID: !!process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: !!process.env.GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN: !!process.env.GMAIL_REFRESH_TOKEN,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };

  let gmail;
  let pendientes = null;
  try {
    const { data } = await getGmailClient().users.messages.list({
      userId: 'me',
      q: 'in:inbox category:primary -label:clasificado',
      maxResults: 1,
    });
    gmail = { ok: true };
    pendientes = data.resultSizeEstimate ?? 0;
  } catch (err) {
    gmail = { ok: false, error: err.message };
  }

  return Response.json({ ok: true, env, gmail, pendientes });
}
