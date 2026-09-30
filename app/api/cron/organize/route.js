import { autorizado } from '@/lib/auth';
import { organizarBandeja } from '@/lib/organizar';

export const maxDuration = 60;

export async function GET(request) {
  if (!autorizado(request)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const resumen = await organizarBandeja({
      log: (nivel, msg) =>
        nivel === 'error' ? console.error(msg) : console.log(msg),
    });
    console.log('Resumen:', resumen);
    return Response.json({ ok: true, ...resumen });
  } catch (err) {
    console.error('Error leyendo Gmail:', err);
    return Response.json(
      { ok: false, error: 'Error leyendo correos de Gmail' },
      { status: 502 }
    );
  }
}
