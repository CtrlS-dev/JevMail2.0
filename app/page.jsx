'use client';

import { useEffect, useRef, useState } from 'react';

function hora(t) {
  return new Date(t).toLocaleTimeString('es-ES', { hour12: false });
}

export default function Terminal() {
  const [token, setToken] = useState('');
  const [logueado, setLogueado] = useState(false);
  const [lineas, setLineas] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState(null);
  const logRef = useRef(null);
  const idRef = useRef(0);

  useEffect(() => {
    const guardado = localStorage.getItem('jevmail_token');
    if (guardado) {
      setToken(guardado);
      setLogueado(true);
    }
  }, []);

  useEffect(() => {
    if (logueado) cargarEstado();
  }, [logueado]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [lineas]);

  function imprimir(nivel, msg, t = Date.now()) {
    idRef.current += 1;
    setLineas((prev) => [...prev, { id: idRef.current, t, nivel, msg }]);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
    });
    if (res.status === 401) {
      imprimir('error', '401 no autorizado: token incorrecto o caducado');
      throw new Error('401');
    }
    return res;
  }

  async function cargarEstado() {
    imprimir('info', 'conectando con gmail…');
    try {
      const res = await api('/api/status');
      const s = await res.json();
      setEstado(s);
      if (s.gmail.ok) {
        imprimir('ok', `gmail conectado · pendientes en principal: ${s.pendientes}`);
      } else {
        imprimir('error', `gmail: ${s.gmail.error}`);
      }
      const faltan = Object.entries(s.env)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (faltan.length) imprimir('warn', `variables sin definir: ${faltan.join(', ')}`);
    } catch (err) {
      if (err.message !== '401') imprimir('error', `estado: ${err.message}`);
    }
  }

  async function ejecutar() {
    if (ocupado) return;
    setOcupado(true);
    imprimir('gris', '$ organize --archivar --solo-principal');
    try {
      const res = await api('/api/run', { method: 'POST' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const partes = buf.split('\n');
        buf = partes.pop();
        for (const p of partes) {
          if (!p.trim()) continue;
          const ev = JSON.parse(p);
          if (ev.nivel === 'fin') {
            const r = ev.resumen;
            imprimir(
              'fin',
              `── resumen: ${r.clasificados} clasificados · ${r.dudosos} dudosos · ${r.errores} errores · ` +
                (r.completo
                  ? 'bandeja al día ✔'
                  : r.cuota
                    ? 'cuota de gmail agotada: espera ~60 s y ejecuta de nuevo'
                    : 'quedan pendientes: ejecuta de nuevo'),
              ev.t
            );
          } else {
            imprimir(ev.nivel, ev.msg, ev.t);
          }
        }
      }
    } catch (err) {
      if (err.message !== '401') imprimir('error', `conexión: ${err.message}`);
    } finally {
      setOcupado(false);
      cargarEstado();
    }
  }

  function salir() {
    localStorage.removeItem('jevmail_token');
    setToken('');
    setLogueado(false);
    setLineas([]);
    setEstado(null);
  }

  function entrar(e) {
    e.preventDefault();
    const valor = new FormData(e.target).get('token').trim();
    if (!valor) return;
    localStorage.setItem('jevmail_token', valor);
    setToken(valor);
    setLogueado(true);
  }

  return (
    <main className="terminal">
      <div className="ventana">
        <div className="barra">
          <span className="punto r" />
          <span className="punto a" />
          <span className="punto v" />
          <span className="titulo">jevmail — organizador de bandeja</span>
        </div>

        {!logueado ? (
          <div className="login">
            <div className="linea c-warn">acceso restringido</div>
            <div className="linea c-gris">introduce tu CRON_SECRET para continuar</div>
            <form onSubmit={entrar}>
              <input
                name="token"
                type="password"
                placeholder="••••••••••••••••"
                autoFocus
              />
              <button className="btn primario" type="submit">
                [ entrar ]
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="acciones">
              <button className="btn primario" onClick={ejecutar} disabled={ocupado}>
                {ocupado ? '[ ejecutando… ]' : '[ ejecutar ]'}
              </button>
              <button className="btn" onClick={cargarEstado} disabled={ocupado}>
                [ estado ]
              </button>
              <button className="btn" onClick={() => setLineas([])} disabled={ocupado}>
                [ limpiar ]
              </button>
              <button className="btn peligro" onClick={salir} disabled={ocupado}>
                [ salir ]
              </button>
            </div>

            <div className="log" ref={logRef}>
              {lineas.map((l) => (
                <div key={l.id} className={`linea c-${l.nivel}`}>
                  <span className="ts">[{hora(l.t)}]</span>
                  {l.msg}
                </div>
              ))}
              <div className="linea cursor" />
            </div>

            <div className="statusbar">
              <span>
                gmail:{' '}
                {estado ? (
                  estado.gmail.ok ? (
                    <b className="ok">conectado</b>
                  ) : (
                    <b className="mal">error</b>
                  )
                ) : (
                  '…'
                )}
              </span>
              <span>
                pendientes: <b>{estado?.pendientes ?? '…'}</b>
              </span>
              <span>cron: 07:00 utc</span>
              <span>scope: bandeja principal</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
