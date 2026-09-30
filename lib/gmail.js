import { google } from 'googleapis';

export function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3000'
  );
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

export async function getEmailsSinClasificar(gmail, maxResults = 50) {
  const { data } = await conReintento(() =>
    gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox category:primary -label:clasificado',
      maxResults,
    })
  );
  if (!data.messages) return [];

  const emails = [];
  for (const msg of data.messages) {
    const { data: full } = await conReintento(() =>
      gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      })
    );
    emails.push({
      id: msg.id,
      remitente: getHeader(full, 'From'),
      asunto: getHeader(full, 'Subject'),
      cuerpo: extractBody(full.payload).slice(0, 2000),
    });
  }
  return emails;
}

function getHeader(message, name) {
  return (
    message.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ''
  );
}

function decodeBase64Url(data) {
  return Buffer.from(
    data.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf8');
}

function extractBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractBody(part);
    if (text) return text;
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]*>/g, ' ');
  }
  return '';
}

async function conReintento(fn, intentos = 4) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const esCuota =
        err.code === 429 ||
        (err.code === 403 && /quota|rateLimit/i.test(err.message ?? ''));
      if (!esCuota || i >= intentos) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

export async function crearGestorEtiquetas(gmail) {
  const { data } = await conReintento(() =>
    gmail.users.labels.list({ userId: 'me' })
  );
  const porNombre = new Map(
    data.labels.map((l) => [l.name.toLowerCase(), l.id])
  );
  const creandose = new Map();

  return {
    async id(nombre) {
      const clave = nombre.toLowerCase();
      if (porNombre.has(clave)) return porNombre.get(clave);
      if (!creandose.has(clave)) {
        creandose.set(
          clave,
          conReintento(() =>
            gmail.users.labels.create({
              userId: 'me',
              requestBody: {
                name: nombre,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show',
              },
            })
          ).then(({ data: nueva }) => {
            porNombre.set(clave, nueva.id);
            return nueva.id;
          })
        );
      }
      return creandose.get(clave);
    },
  };
}

export async function aplicarEtiquetas(gmail, messageId, labelIds) {
  await conReintento(() =>
    gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: labelIds, removeLabelIds: ['INBOX'] },
    })
  );
}
