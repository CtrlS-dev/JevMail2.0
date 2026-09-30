import { google } from 'googleapis';
import readline from 'readline';

console.log('CLIENT_ID cargado:', process.env.GMAIL_CLIENT_ID ? 'SÍ ✅' : 'NO ❌');
console.log('CLIENT_SECRET cargado:', process.env.GMAIL_CLIENT_SECRET ? 'SÍ ✅' : 'NO ❌');

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'http://localhost:3000'
);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.modify'],
});

console.log('\n1. Abre esta URL en tu navegador:\n\n' + url + '\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(
  '2. Pega el código O la URL completa de redirección: ',
  async (respuesta) => {
    try {
      let code = respuesta.trim();

      if (code.startsWith('http')) {
        code = new URL(code).searchParams.get('code') ?? '';
      }

      const { tokens } = await oauth2.getToken(code);

      if (!tokens.refresh_token) {
        console.log('\n⚠️ Google no devolvió refresh_token. Revoca el acceso en');
        console.log('https://myaccount.google.com/permissions y vuelve a intentarlo.');
      } else {
        console.log('\n✅ Tu GMAIL_REFRESH_TOKEN es:\n\n' + tokens.refresh_token + '\n');
        console.log('Guárdalo en .env.local y luego en las env vars de Vercel.');
      }
    } catch (err) {
      console.error('\n❌ Error:', err.message);
    }
    rl.close();
  }
);