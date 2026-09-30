import { TypeSafeClient } from '@typesafe-ai/sdk';

let jev;
function getJevClient() {
  if (!jev) jev = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
  return jev;
}

const CATEGORIAS = {
  trabajo: 'Emails de clientes, colegas, jefes o proyectos profesionales y otros asuntos laborales',
  finanzas: 'Facturas, recibos, bancos, pagos, nóminas e impuestos y otros asuntos financieros',
  personal: 'Familia, amigos y asuntos personales y privados',
  promociones: 'Marketing, ofertas, newsletters y publicidad y otros contenidos de marketing',
  notificaciones: 'Avisos automáticos: redes sociales, apps, confirmaciones de cuenta y otros servicios en línea',
  seguridad: 'Códigos de verificación de dos factores (2FA), códigos de recuperación, alertas de seguridad, contraseñas de un solo uso, notificaciones de inicio de sesión, alertas de actividad sospechosa, y otros mensajes relacionados con la seguridad de cuentas y servicios en línea',
  otro: 'Todo lo que no encaje claramente en las categorías anteriores',
};

const UMBRAL_CONFIANZA = 0.6;

export async function clasificarEmail({ remitente, asunto, cuerpo }) {
  const { answers } = await getJevClient().systemOne({
    model: 'jev-latest',
    state: { remitente, asunto, cuerpo },
    questions: {
      categoria: {
        type: 'choice',
        instructions:
          'Clasifica el correo según la intención principal de quien lo envía. ' +
          'Reglas de desempate: si es publicidad o newsletter aunque el tono parezca personal, es "promociones". ' +
          'Si es un aviso automático de un servicio (confirmaciones, actividad, recibos), es "notificaciones" o "finanzas" según si hay dinero de por medio. ' +
          'Si contiene códigos 2FA, contraseñas de un solo uso o alertas de acceso, es "seguridad" siempre. ' +
          'Si dudas entre varias categorías, elige "otro" en lugar de adivinar.',
        criteria: CATEGORIAS,
      },
      esUrgente: {
        type: 'noul',
        instructions:
          '¿Una persona real necesita actuar o responder hoy mismo por este correo? ' +
          'NUNCA son urgentes: newsletters, promociones, recibos, confirmaciones y avisos automáticos, aunque usen lenguaje alarmista ("última oportunidad", "tu cuenta será suspendida" en marketing). ' +
          'SÍ son urgentes: mensajes personales que piden algo con fecha límite, problemas de pago reales, alertas de seguridad que requieren una acción del usuario.',
      },
      esAutomatico: {
        type: 'noul',
        instructions:
          '¿Lo generó un sistema sin intervención humana directa (notificaciones, newsletters, recibos, robots, no-reply)? ' +
          'Un correo escrito por una persona no es automático aunque venga de una empresa.',
      },
    },
  });

  return {
    categoria: answers.categoria.choice,
    confianza: answers.categoria.confidence ?? 0,
    urgente: (answers.esUrgente.noul ?? 0) >= 0.8,
    esAutomatico: (answers.esAutomatico.noul ?? 0) >= 0.8,
  };
}

export { UMBRAL_CONFIANZA };