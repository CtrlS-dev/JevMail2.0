import {
  getGmailClient,
  getEmailsSinClasificar,
  crearGestorEtiquetas,
  aplicarEtiquetas,
} from './gmail';
import { clasificarEmail, UMBRAL_CONFIANZA } from './jev';
import { esErrorCuota } from './auth';

const LIMITE_MS = 50_000;
const TAMANO_LOTE = 5;

function corto(texto, n = 70) {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length > n ? limpio.slice(0, n) + '…' : limpio;
}

export async function organizarBandeja({ log = () => {} } = {}) {
  const gmail = getGmailClient();

  const etiquetas = await crearGestorEtiquetas(gmail);
  const labelClasificado = await etiquetas.id('clasificado');
  const labelUrgente = await etiquetas.id('⚡ urgente');
  const labelDudoso = await etiquetas.id('dudoso');

  const inicio = Date.now();
  const vistos = new Set();
  const resultados = { clasificados: 0, dudosos: 0, errores: 0 };
  let completo = true;
  let cuota = false;

  log('info', 'bandeja principal → buscando correos sin clasificar');

  while (Date.now() - inicio < LIMITE_MS) {
    let nuevos;
    try {
      nuevos = (await getEmailsSinClasificar(gmail, 20)).filter(
        (e) => !vistos.has(e.id)
      );
    } catch (err) {
      if (esErrorCuota(err)) {
        log('warn', 'cuota de Gmail agotada por este minuto: espera ~60 s y ejecuta de nuevo');
        completo = false;
        cuota = true;
        break;
      }
      throw err;
    }

    if (nuevos.length === 0) break;
    nuevos.forEach((e) => vistos.add(e.id));
    log('info', `${nuevos.length} correo(s) en cola`);

    for (let i = 0; i < nuevos.length; i += TAMANO_LOTE) {
      if (Date.now() - inicio >= LIMITE_MS) {
        completo = false;
        break;
      }
      const lote = nuevos.slice(i, i + TAMANO_LOTE);
      await Promise.all(
        lote.map(async (email) => {
          const quien = corto(email.remitente, 40);
          const que = corto(email.asunto, 60);
          try {
            const r = await clasificarEmail(email);
            const conf = r.confianza.toFixed(2);

            if (r.confianza < UMBRAL_CONFIANZA) {
              await aplicarEtiquetas(gmail, email.id, [labelDudoso, labelClasificado]);
              resultados.dudosos++;
              log('warn', `dudoso (${conf}) ← ${que} · ${quien}`);
              return;
            }

            const labelCategoria = await etiquetas.id(r.categoria);
            const labels = [labelCategoria, labelClasificado];
            let marca = r.categoria;
            if (r.urgente && !r.esAutomatico) {
              labels.push(labelUrgente);
              marca += ' ⚡';
            }

            await aplicarEtiquetas(gmail, email.id, labels);
            resultados.clasificados++;
            log('ok', `${marca} (${conf}) ← ${que} · ${quien}`);
          } catch (err) {
            resultados.errores++;
            log('error', `falló ${que}: ${err.message}`);
          }
        })
      );
    }

    if (!completo) break;
  }

  if (Date.now() - inicio >= LIMITE_MS && !cuota) completo = false;

  if (completo) log('info', 'bandeja principal al día');
  else if (!cuota) log('warn', 'tiempo agotado: quedan correos, ejecuta de nuevo');

  return { ...resultados, completo, cuota };
}
