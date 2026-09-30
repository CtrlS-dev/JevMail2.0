import { autorizado } from '@/lib/auth';
import { organizarBandeja } from '@/lib/organizar';

export const maxDuration = 60;

export async function POST(request) {
  if (!autorizado(request)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const log = (nivel, msg) => send({ t: Date.now(), nivel, msg });
      try {
        const resumen = await organizarBandeja({ log });
        send({ t: Date.now(), nivel: 'fin', resumen });
      } catch (err) {
        send({ t: Date.now(), nivel: 'error', msg: `fallo fatal: ${err.message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
