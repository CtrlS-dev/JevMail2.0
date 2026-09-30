import { timingSafeEqual } from 'node:crypto';

export function autorizado(request) {
  if (!process.env.CRON_SECRET) return false;
  const auth = request.headers.get('authorization');
  const esperado = `Bearer ${process.env.CRON_SECRET}`;
  if (!auth || auth.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(esperado));
}

export function esErrorCuota(err) {
  return (
    err?.code === 429 ||
    (err?.code === 403 && /quota|rateLimit/i.test(err?.message ?? ''))
  );
}
