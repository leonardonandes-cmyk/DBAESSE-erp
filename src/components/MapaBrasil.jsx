import { useMemo } from 'react'
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

export default function MapaBrasil({ geo, reg = 'BR', visao = 'cidades', pontos = [], porUf = {}, cor = '#1f6fd6', sel, onSel, fmt = String, altura = 620 }) {
  const naReg = (uf) => reg === 'BR' || REGIOES[reg]?.includes(uf)
  const off = (uf) => (reg === 'BR' ? SEP[regiaoDe(uf)] || [0, 0] : [0, 0])

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
  const alt = (uf) => (!naReg(uf) ? 0 : porUf[uf] ? H_BASE + (H_MAX - H_BASE) * Math.sqrt(porUf[uf] / maxUf) : H_BASE)
  const ordem = useMemo(() => Object.keys(geo.estados).sort((a, b) => geo.caixa[a].cy - geo.caixa[b].cy), [geo])

  const visiveis = pontos.filter((p) => naReg(p.uf) && p.valor > 0)
  const maxP = Math.max(1, ...visiveis.map((p) => p.valor))
  const raio = (v) => (6 + 22 * Math.sqrt(v / maxP)) * (0.45 + 0.55 * zm)
  const esfera = ESFERAS[cor] || ESFERAS['#1f6fd6']

  // rótulos de cidade sem sobrepor (as maiores primeiro)
  const rotulos = []
  if (visao === 'cidades') {
    ;[...visiveis].sort((a, b) => b.valor - a.valor).slice(0, 12).forEach((p) => {
      const o = off(p.uf), x = p.x + o[0], y = p.y + o[1] - alt(p.uf)
      if (rotulos.length < (reg === 'BR' ? 6 : 9) && !rotulos.some((r) => Math.abs(r.x - x) < 120 * zm && Math.abs(r.y - y) < 26 * zm)) rotulos.push({ ...p, x, y })
    })
  }

  const rotRegiao = reg !== 'BR' ? [] : Object.keys(REGIOES).map((k) => {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9
    REGIOES[k].forEach((s) => { const q = geo.caixa[s]; a = Math.min(a, q.x0); b = Math.max(b, q.x1); c = Math.min(c, q.y0); d = Math.max(d, q.y1) })
    const o = SEP[k]
    const P = { N: [a + 10, c - 6, 'start'], NE: [b + o[0], c + o[1] - 16, 'end'], CO: [a + o[0] - 10, d + o[1] - 30, 'end'], SE: [b + o[0] + 12, (c + d) / 2 + o[1], 'start'], S: [a + o[0] - 12, (c + d) / 2 + o[1] + 20, 'end'] }[k]
    return { k, x: P[0], y: P[1], anc: P[2] }
  })

  return (
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
              onClick={(ev) => { ev.stopPropagation(); if (clicavel) onSel?.(on ? null : { tipo: 'estado', id: uf }) }}>
              {camadas}
              <path d={e.d} transform={`translate(${o[0]},${o[1] - h})`} fill="#fff" stroke={on ? '#151515' : '#c4bdb2'} strokeWidth={on ? 2.2 * zm : 0.8 * zm} strokeLinejoin="round" />
              <title>{e.nome}{porUf[uf] ? ` · ${fmt(porUf[uf])}` : ''}</title>
            </g>
          )
        })}
      </g>

      {rotRegiao.map((r) => (
        <text key={r.k} x={r.x} y={r.y} textAnchor={r.anc} className="mapa-regiao" style={{ fontSize: 17 * zm }}>{NOME_REGIAO[r.k].toUpperCase()}</text>
      ))}

      {visao === 'estados' && Object.keys(porUf).filter((u) => naReg(u) && porUf[u] > 0).sort((a, b) => porUf[b] - porUf[a]).slice(0, reg === 'BR' ? 10 : 14).map((uf) => {
        const b = geo.caixa[uf], o = off(uf)
        return <text key={uf} x={b.cx + o[0]} y={b.cy + o[1] - alt(uf) + 7 * zm} textAnchor="middle" className="mapa-uf-rotulo" style={{ fontSize: 22 * zm, strokeWidth: 5 * zm }}>{uf}</text>
      })}

      {visao === 'cidades' && [...visiveis].sort((a, b) => a.y - b.y).map((p) => {
        const o = off(p.uf), r = raio(p.valor), x = p.x + o[0], z = p.y + o[1] - alt(p.uf)
        const on = sel?.tipo === 'cidade' && sel.id === p.id
        return (
          <g key={p.id} className="mapa-esfera" onClick={(ev) => { ev.stopPropagation(); onSel?.(on ? null : { tipo: 'cidade', id: p.id }) }}>
            <ellipse cx={x + r * 0.25} cy={z + r * 0.15} rx={r * 1.15} ry={r * 0.42} fill="url(#mapaChao)" />
            <circle cx={x} cy={z - r * 0.85} r={r} fill="url(#mapaEsfera)" stroke={on ? '#151515' : 'none'} strokeWidth={2.5 * zm} />
            <ellipse cx={x - r * 0.32} cy={z - r * 1.22} rx={r * 0.28} ry={r * 0.17} fill="#fff" fillOpacity=".55" />
            <title>{p.nome}/{p.uf} · {fmt(p.valor)}</title>
          </g>
        )
      })}

      {rotulos.map((p) => {
        const r = raio(p.valor)
        return <text key={`r${p.id}`} x={p.x + r + 6 * zm} y={p.y - r * 0.85 + 5 * zm} className="mapa-cidade-rotulo" style={{ fontSize: 21 * zm, strokeWidth: 5 * zm }}>{p.nome}</text>
      })}
    </svg>
  )
}
