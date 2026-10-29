import { useMemo, useRef, useState } from 'react'
import { NOME_REGIAO, REGIOES, regiaoDe } from '../lib/geo.js'

/*
  Mapa do Brasil em alto relevo (sem cor) + esferas 3D por cidade.
  - Relevo: cada estado sobe conforme o volume (porUf[uf] / máximo).
  - Regiões separadas por um leve afastamento entre os blocos (só na visão Brasil).
  - Zoom por região: os estados de fora ficam apagados ao fundo.
  props: geo, reg ('BR'|'N'...), visao ('cidades'|'estados'), pontos [{ id, uf, x, y, valor, nome }],
         porUf { UF: valor }, cor (hex), sel { tipo:'cidade'|'estado', id }, onSel(sel|null), fmt(v)
*/
const SEP = { N: [-22, -26], NE: [30, -14], CO: [-14, 6], SE: [24, 22], S: [2, 44] }
const ESFERAS = {
  '#1f6fd6': ['#8fc0ff', '#1f6fd6', '#0a3270'],
  '#6250d6': ['#ad9ff0', '#6250d6', '#2c2077'],
  '#d4537e': ['#f0a3c0', '#d4537e', '#7a2244'],
  '#1baf7a': ['#6fdcb2', '#1baf7a', '#0b5e40'],
  '#eb6834': ['#f7b08f', '#eb6834', '#7d2f0f'],
  '#e8a10c': ['#f7d27e', '#e8a10c', '#7a5000'],
}
const H_BASE = 5, H_MAX = 34

export default function MapaBrasil({ geo, reg = 'BR', visao = 'cidades', pontos = [], porUf = {}, detalheUf = {}, cor = '#1f6fd6', sel, onSel, fmt = String, altura = 620 }) {
  const caixaRef = useRef(null)
  const [dica, setDica] = useState(null)
  const mostrar = (ev, d) => { const b = caixaRef.current?.getBoundingClientRect(); if (b) setDica({ ...d, x: ev.clientX - b.left, y: ev.clientY - b.top, w: b.width }) }
  const naReg = (uf) => reg === 'BR' || REGIOES[reg]?.includes(uf)
  const calor = visao === 'calor'
  const off = (uf) => (reg === 'BR' && !calor ? SEP[regiaoDe(uf)] || [0, 0] : [0, 0])

  const { viewBox, zm } = useMemo(() => {
    const ufs = reg === 'BR' ? Object.keys(geo.caixa) : REGIOES[reg]
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9
    ufs.forEach((s) => { const k = geo.caixa[s]; a = Math.min(a, k.x0); b = Math.max(b, k.x1); c = Math.min(c, k.y0); d = Math.max(d, k.y1) })
    const m = reg === 'BR' ? 70 : 50
    const w = b - a + 2 * m, h = d - c + 2 * m + 40
    const W = Math.max(w, h * 1.05), H = Math.max(h, w / 1.05)
    return { viewBox: `${(a + b) / 2 - W / 2} ${(c + d) / 2 - H / 2 - 14} ${W} ${H}`, zm: W / 1060 }
  }, [geo, reg])

  const maxUf = Math.max(1, ...Object.entries(porUf).filter(([u]) => naReg(u)).map(([, v]) => v))
  const alt = (uf) => (!naReg(uf) ? 0 : calor ? 6 : porUf[uf] ? H_BASE + (H_MAX - H_BASE) * Math.sqrt(porUf[uf] / maxUf) : H_BASE)
  const ordem = useMemo(() => Object.keys(geo.estados).sort((a, b) => geo.caixa[a].cy - geo.caixa[b].cy), [geo])

  const visiveis = pontos.filter((p) => naReg(p.uf) && p.valor > 0)
  const maxP = Math.max(1, ...visiveis.map((p) => p.valor))
  const raio = (v) => (6 + 22 * Math.sqrt(v / maxP)) * (0.45 + 0.55 * zm)
  const esfera = ESFERAS[cor] || ESFERAS['#1f6fd6']

  // rótulos de cidade sem sobrepor (as maiores primeiro)
  // rótulo em TODAS as esferas: tenta direita, esquerda, cima, baixo (e mais longe) até achar espaço livre
  const rotulos = []
  if (visao === 'cidades' || calor) {
    const caixas = visiveis.map((p) => { const o = off(p.uf), r = calor ? 7 * zm : raio(p.valor), x = p.x + o[0], cy = p.y + o[1] - alt(p.uf) - (calor ? 0 : r * 0.85); return { x0: x - r, x1: x + r, y0: cy - r, y1: cy + r } })
    const bate = (c) => caixas.some((k) => c.x0 < k.x1 && c.x1 > k.x0 && c.y0 < k.y1 && c.y1 > k.y0)
    ;[...visiveis].sort((a, b) => b.valor - a.valor).forEach((p, i) => {
      const o = off(p.uf), r = calor ? 7 * zm : raio(p.valor), x = p.x + o[0], cy = p.y + o[1] - alt(p.uf) - (calor ? 0 : r * 0.85)
      const fs = (i < 6 ? 19 : 15) * zm, w = p.nome.length * fs * 0.56, h = fs * 1.1, g = 5 * zm
      const tentativas = [1, 2.2].flatMap((m) => [
        { x: x + r + g * m, y: cy, anc: 'start' }, { x: x - r - g * m, y: cy, anc: 'end' },
        { x, y: cy - r - h * 0.55 * m, anc: 'middle' }, { x, y: cy + r + h * 0.6 * m, anc: 'middle' },
        { x: x + r * 0.7 + g * m, y: cy - r - h * 0.3 * m, anc: 'start' }, { x: x - r * 0.7 - g * m, y: cy + r + h * 0.4 * m, anc: 'end' },
      ])
      const caixa = (t) => { const x0 = t.anc === 'start' ? t.x : t.anc === 'end' ? t.x - w : t.x - w / 2; return { x0, x1: x0 + w, y0: t.y - h / 2, y1: t.y + h / 2 } }
      const ok = tentativas.find((t) => !bate(caixa(t))) || tentativas[0]
      caixas.push(caixa(ok))
      if (!calor) rotulos.push({ id: p.id, nome: p.nome, x: ok.x, y: ok.y, anc: ok.anc, fs, forte: i < 6 })
    })
  }

  const rotRegiao = reg !== 'BR' || calor ? [] : Object.keys(REGIOES).map((k) => {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9
    REGIOES[k].forEach((s) => { const q = geo.caixa[s]; a = Math.min(a, q.x0); b = Math.max(b, q.x1); c = Math.min(c, q.y0); d = Math.max(d, q.y1) })
    const o = SEP[k]
    const P = { N: [a + 10, c - 6, 'start'], NE: [b + o[0], c + o[1] - 16, 'end'], CO: [a + o[0] - 10, d + o[1] - 30, 'end'], SE: [b + o[0] + 12, (c + d) / 2 + o[1], 'start'], S: [a + o[0] - 12, (c + d) / 2 + o[1] + 20, 'end'] }[k]
    return { k, x: P[0], y: P[1], anc: P[2] }
  })

  return (
    <div className="mapa-caixa" ref={caixaRef} onMouseLeave={() => setDica(null)}>
    <svg className="mapa-br" viewBox={viewBox} style={{ height: altura }} role="img" aria-label={`Mapa de clientes — ${NOME_REGIAO[reg]}`}
      onClick={(e) => { if (e.target === e.currentTarget) onSel?.(null) }}>
      <defs>
        <filter id="mapaSombra" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy={10 * zm} stdDeviation={9 * zm} floodColor="#1a2638" floodOpacity=".2" />
        </filter>
        <radialGradient id="mapaEsfera" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".22" stopColor={esfera[0]} />
          <stop offset=".75" stopColor={esfera[1]} />
          <stop offset="1" stopColor={esfera[2]} />
        </radialGradient>
        <radialGradient id="calorBolha"><stop offset="0" stopColor="#000" stopOpacity="1" /><stop offset=".45" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <filter id="calorCores" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues="0.55 0.20 0.10 0.98 1.00 0.86" />
            <feFuncG type="table" tableValues="0.80 0.62 0.75 0.85 0.45 0.13" />
            <feFuncB type="table" tableValues="1.00 0.95 0.55 0.20 0.12 0.18" />
            <feFuncA type="table" tableValues="0 0.45 0.62 0.74 0.82 0.88" />
          </feComponentTransfer>
        </filter>
        <clipPath id="calorBrasil">{Object.keys(geo.estados).filter((u) => naReg(u)).map((uf) => <path key={uf} d={geo.estados[uf].d} transform={`translate(0,${-alt(uf)})`} />)}</clipPath>
        <radialGradient id="mapaChao"><stop offset="0" stopColor="#1a1a1a" stopOpacity=".32" /><stop offset="1" stopColor="#1a1a1a" stopOpacity="0" /></radialGradient>
      </defs>

      <g filter="url(#mapaSombra)">
        {ordem.map((uf) => {
          const e = geo.estados[uf], h = alt(uf), o = off(uf), dentro = naReg(uf)
          const on = sel?.tipo === 'estado' && sel.id === uf
          const clicavel = dentro && porUf[uf] > 0
          const camadas = []
          for (let k = 0; k < h; k += 1.5) camadas.push(<path key={k} d={e.d} transform={`translate(${o[0]},${o[1] - k})`} fill="#c9c3ba" fillOpacity={(0.75 + 0.25 * k / h).toFixed(2)} />)
          return (
            <g key={uf} className={`mapa-uf ${clicavel ? 'clicavel' : ''}`} style={{ opacity: dentro ? 1 : 0.28 }}
              onMouseMove={(ev) => dentro && mostrar(ev, { titulo: e.nome, sub: `${uf} · ${NOME_REGIAO[regiaoDe(uf)]}`, valor: porUf[uf] ? fmt(porUf[uf]) : 'sem vendas', detalhe: detalheUf[uf] })}
              onClick={(ev) => { ev.stopPropagation(); if (clicavel) onSel?.(on ? null : { tipo: 'estado', id: uf }) }}>
              {camadas}
              <path d={e.d} transform={`translate(${o[0]},${o[1] - h})`} fill="#fff" stroke={on ? '#151515' : '#c4bdb2'} strokeWidth={on ? 2.2 * zm : 0.8 * zm} strokeLinejoin="round" />
            </g>
          )
        })}
      </g>

      {rotRegiao.map((r) => (
        <text key={r.k} x={r.x} y={r.y} textAnchor={r.anc} className="mapa-regiao" style={{ fontSize: 17 * zm }}>{NOME_REGIAO[r.k].toUpperCase()}</text>
      ))}

      {calor && (
        <g clipPath="url(#calorBrasil)" style={{ pointerEvents: 'none' }}>
          <g filter="url(#calorCores)">
            {visiveis.map((p) => {
              const rr = (38 + 120 * Math.sqrt(p.valor / maxP)) * zm // mesma escala de tela no Brasil e no zoom
              return <circle key={p.id} cx={p.x} cy={p.y - alt(p.uf)} r={rr} fill="url(#calorBolha)" opacity={0.35 + 0.65 * Math.sqrt(p.valor / maxP)} />
            })}
          </g>
        </g>
      )}
      {calor && visiveis.map((p) => (
        <circle key={`h${p.id}`} cx={p.x} cy={p.y - alt(p.uf)} r={10 * zm} fill="transparent" style={{ cursor: 'pointer' }}
          onMouseMove={(ev) => { ev.stopPropagation(); mostrar(ev, { titulo: `${p.nome}/${p.uf}`, sub: `${geo.estados[p.uf]?.nome || p.uf} · ${NOME_REGIAO[regiaoDe(p.uf)]}`, valor: fmt(p.valor), detalhe: p.detalhe }) }}
          onClick={(ev) => { ev.stopPropagation(); onSel?.({ tipo: 'cidade', id: p.id }) }} />
      ))}

      {Object.keys(geo.estados).filter((u) => naReg(u)).map((uf) => {
        const b = geo.caixa[uf], o = off(uf), forte = visao === 'estados' && porUf[uf] > 0
        const pequeno = (b.x1 - b.x0) < 40 * zm // DF, SE, AL…: sigla menor
        return <text key={`uf${uf}`} x={b.cx + o[0] + (uf === 'DF' ? 14 * zm : 0)} y={b.cy + o[1] - alt(uf) + (uf === 'DF' ? -10 * zm : 6 * zm)} textAnchor="middle"
          className={`mapa-uf-rotulo ${forte ? '' : calor ? 'calor' : 'leve'}`} style={{ fontSize: (forte ? 20 : pequeno ? 10 : 13) * zm, strokeWidth: calor ? 0 : 4 * zm }}>{uf}</text>
      })}

      {visao === 'cidades' && [...visiveis].sort((a, b) => a.y - b.y).map((p) => {
        const o = off(p.uf), r = raio(p.valor), x = p.x + o[0], z = p.y + o[1] - alt(p.uf)
        const on = sel?.tipo === 'cidade' && sel.id === p.id
        return (
          <g key={p.id} className="mapa-esfera" onMouseMove={(ev) => { ev.stopPropagation(); mostrar(ev, { titulo: `${p.nome}/${p.uf}`, sub: `${geo.estados[p.uf]?.nome || p.uf} · ${NOME_REGIAO[regiaoDe(p.uf)]}`, valor: fmt(p.valor), detalhe: p.detalhe }) }} onClick={(ev) => { ev.stopPropagation(); onSel?.(on ? null : { tipo: 'cidade', id: p.id }) }}>
            <ellipse cx={x + r * 0.25} cy={z + r * 0.15} rx={r * 1.15} ry={r * 0.42} fill="url(#mapaChao)" />
            <circle cx={x} cy={z - r * 0.85} r={r} fill="url(#mapaEsfera)" stroke={on ? '#151515' : 'none'} strokeWidth={2.5 * zm} />
            <ellipse cx={x - r * 0.32} cy={z - r * 1.22} rx={r * 0.28} ry={r * 0.17} fill="#fff" fillOpacity=".55" />
          </g>
        )
      })}

      {rotulos.map((p) => (
        <text key={`r${p.id}`} x={p.x} y={p.y} dy=".35em" textAnchor={p.anc} className={`mapa-cidade-rotulo ${p.forte ? '' : 'leve'}`} style={{ fontSize: p.fs, strokeWidth: 4.5 * zm }}>{p.nome}</text>
      ))}
    </svg>
    {dica && (
      <div className="mapa-dica" style={{ left: Math.min(dica.x + 14, dica.w - 230), top: dica.y + 14 }}>
        <b>{dica.titulo}</b>
        <span>{dica.sub}</span>
        {dica.valor != null && <strong style={{ color: cor }}>{dica.valor}</strong>}
        {dica.detalhe && <em>{dica.detalhe}</em>}
      </div>
    )}
    </div>
  )
}
