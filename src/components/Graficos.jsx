import { useEffect, useMemo, useRef, useState } from 'react'

/*
  Gráficos do sistema (SVG puro, sem biblioteca):
  Sparkline · GraficoArea · BarrasEmpilhadas · Rosca
  Cores dos canais em ordem fixa (paleta validada para daltonismo) — a cor segue o canal, nunca a posição.
*/
export const CORES_CANAL = {
  'Atacado': '#2a78d6', 'Shopee': '#eb6834', 'Revenda': '#1baf7a', 'Mercado Livre': '#eda100',
  'Instagram': '#e87ba4', 'Drop': '#008300', 'TikTok Shop': '#6250d6', 'Loja / varejo': '#e34948',
}
export const ORDEM_CANAL = Object.keys(CORES_CANAL)
export const corCanal = (c) => CORES_CANAL[c] || '#9a968f'
export const ordenarCanais = (lista) => [...lista].sort((a, b) => {
  const ia = ORDEM_CANAL.indexOf(a), ib = ORDEM_CANAL.indexOf(b)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
})

function useLargura(padrao = 600) {
  const ref = useRef(null)
  const [w, setW] = useState(padrao)
  useEffect(() => {
    if (!ref.current) return
    const medir = () => setW(Math.max(200, ref.current.clientWidth))
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir); ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// escala "bonita" para o eixo: 0 .. max arredondado, 4 divisões
function escala(max) {
  if (!(max > 0)) return { topo: 1, passos: [0, 0.25, 0.5, 0.75, 1] }
  const bruto = max / 4
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)
  return { topo: passo * 4, passos: [0, 1, 2, 3, 4].map((i) => (passo * i) / (passo * 4)) }
}

export function Sparkline({ valores, cor = 'var(--accent)', altura = 34 }) {
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 8)}`, [])
  if (!valores?.length || valores.every((v) => !v)) return <div className="spark vazio" style={{ height: altura }} />
  const W = 120, H = altura, max = Math.max(...valores, 1)
  const x = (i) => (i / Math.max(1, valores.length - 1)) * W
  const y = (v) => H - 3 - (v / max) * (H - 6)
  const linha = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: altura }} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".28" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
      <path d={`${linha}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={linha} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function GraficoArea({ pontos, cor = '#8A5A32', fmt = String, fmtEixo = fmt, altura = 260, vazio }) {
  const [ref, W] = useLargura()
  const [hover, setHover] = useState(null)
  const id = useMemo(() => `ga${Math.random().toString(36).slice(2, 8)}`, [])
  const H = altura, M = { t: 16, r: 12, b: 28, l: 56 }
  const iw = W - M.l - M.r, ih = H - M.t - M.b
  const max = Math.max(0, ...pontos.map((p) => p.valor))
  const { topo, passos } = escala(max)
  const x = (i) => M.l + (pontos.length === 1 ? iw / 2 : (i / (pontos.length - 1)) * iw)
  const y = (v) => M.t + ih - (v / topo) * ih
  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join('')
  const pular = Math.ceil(pontos.length / Math.max(2, Math.floor(iw / 56)))
  const h = hover != null ? pontos[hover] : null
  return (
    <div className="graf" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label="Gráfico de evolução">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".32" /><stop offset=".9" stopColor={cor} stopOpacity=".02" /></linearGradient></defs>
        {passos.map((s) => (
          <g key={s}>
            <line x1={M.l} x2={W - M.r} y1={y(s * topo)} y2={y(s * topo)} className="graf-grade" />
            <text x={M.l - 10} y={y(s * topo) + 4} textAnchor="end" className="graf-eixo">{fmtEixo(s * topo)}</text>
          </g>
        ))}
        {pontos.map((p, i) => (i % pular === 0 || i === pontos.length - 1) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="graf-eixo">{p.rotulo}</text>
        ))}
        {max > 0 && <>
          <path d={`${linha}L${x(pontos.length - 1)},${M.t + ih}L${x(0)},${M.t + ih}Z`} fill={`url(#${id})`} />
          <path d={linha} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(pontos.length - 1)} cy={y(pontos[pontos.length - 1].valor)} r="4.5" fill={cor} stroke="#fff" strokeWidth="2" />
        </>}
        {h && <>
          <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} className="graf-mira" />
          <circle cx={x(hover)} cy={y(h.valor)} r="6" fill={cor} stroke="#fff" strokeWidth="2.5" />
        </>}
        {pontos.map((p, i) => (
          <rect key={i} x={x(i) - iw / pontos.length / 2} y={M.t} width={iw / Math.max(1, pontos.length)} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {max === 0 && <div className="graf-vazio">{vazio || 'Sem dados no período.'}</div>}
      {h && (
        <div className="graf-tip" style={{ left: Math.min(Math.max(x(hover), 90), W - 90), top: Math.max(0, y(h.valor) - 12) }}>
          <b>{h.titulo || h.rotulo}</b><span className="graf-tip-val">{fmt(h.valor)}</span>{h.detalhe && <small>{h.detalhe}</small>}
        </div>
      )}
    </div>
  )
}

export function BarrasEmpilhadas({ periodos, series, fmt = String, fmtEixo = fmt, altura = 260, vazio }) {
  const [ref, W] = useLargura()
  const [hover, setHover] = useState(null)
  const H = altura, M = { t: 16, r: 8, b: 28, l: 56 }
  const iw = W - M.l - M.r, ih = H - M.t - M.b
  const totais = periodos.map((p) => series.reduce((t, s) => t + (p.partes[s.id] || 0), 0))
  const max = Math.max(0, ...totais)
  const { topo, passos } = escala(max)
  const banda = iw / Math.max(1, periodos.length)
  const bw = Math.min(46, banda * 0.62)
  const y = (v) => M.t + ih - (v / topo) * ih
  const pular = Math.ceil(periodos.length / Math.max(2, Math.floor(iw / 52)))
  const h = hover != null ? periodos[hover] : null
  return (
    <div className="graf" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label="Gráfico de barras empilhadas por canal">
        {passos.map((s) => (
          <g key={s}>
            <line x1={M.l} x2={W - M.r} y1={y(s * topo)} y2={y(s * topo)} className="graf-grade" />
            <text x={M.l - 10} y={y(s * topo) + 4} textAnchor="end" className="graf-eixo">{fmtEixo(s * topo)}</text>
          </g>
        ))}
        {periodos.map((p, i) => {
          const cx = M.l + banda * i + banda / 2
          let acc = 0
          const vis = series.filter((s) => (p.partes[s.id] || 0) > 0)
          return (
            <g key={i} className={hover != null && hover !== i ? 'graf-apaga' : ''}>
              {vis.map((s, k) => {
                const v = p.partes[s.id]
                const y1 = y(acc + v), y0 = y(acc); acc += v
                const alt = Math.max(0, y0 - y1 - (k < vis.length - 1 ? 2 : 0)) // 2px de respiro entre segmentos
                const topoSeg = k === vis.length - 1
                const r = topoSeg ? Math.min(4, alt) : 0
                const x0 = cx - bw / 2
                const d = `M${x0},${y1 + alt}V${y1 + r}${r ? `Q${x0},${y1} ${x0 + r},${y1}` : ''}H${x0 + bw - r}${r ? `Q${x0 + bw},${y1} ${x0 + bw},${y1 + r}` : ''}V${y1 + alt}Z`
                return <path key={s.id} d={d} fill={s.cor} />
              })}
              {(i % pular === 0 || i === periodos.length - 1) && <text x={cx} y={H - 8} textAnchor="middle" className="graf-eixo">{p.rotulo}</text>}
              <rect x={cx - banda / 2} y={M.t} width={banda} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          )
        })}
      </svg>
      {max === 0 && <div className="graf-vazio">{vazio || 'Sem dados no período.'}</div>}
      {h && (
        <div className="graf-tip" style={{ left: Math.min(Math.max(M.l + banda * hover + banda / 2, 110), W - 110), top: Math.max(0, y(totais[hover]) - 12) }}>
          <b>{h.titulo || h.rotulo}</b><span className="graf-tip-val">{fmt(totais[hover])}</span>
          {series.filter((s) => h.partes[s.id]).sort((a, b) => h.partes[b.id] - h.partes[a.id]).map((s) => (
            <span key={s.id} className="graf-tip-linha"><i style={{ background: s.cor }} />{s.nome}<em>{fmt(h.partes[s.id])}</em></span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Rosca({ fatias, fmt = String, rotuloCentro = 'total', tamanho = 190, onClicar, selecionada }) {
  const [hover, setHover] = useState(null)
  const total = fatias.reduce((t, f) => t + f.valor, 0)
  const R = tamanho / 2, r = R * 0.64, c = R
  let ang = -Math.PI / 2
  const arcos = fatias.filter((f) => f.valor > 0).map((f) => {
    const a = (f.valor / total) * Math.PI * 2
    const a0 = ang, a1 = ang + a; ang = a1
    return { ...f, a0, a1 }
  })
  const pt = (rad, a) => [c + rad * Math.cos(a), c + rad * Math.sin(a)]
  const caminho = (a0, a1, ext) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4
    const big = a1 - a0 > Math.PI ? 1 : 0
    const [x0, y0] = pt(ext, a0), [x1, y1] = pt(ext, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0)
    return `M${x0},${y0}A${ext},${ext} 0 ${big} 1 ${x1},${y1}L${x2},${y2}A${r},${r} 0 ${big} 0 ${x3},${y3}Z`
  }
  const foco = hover != null ? arcos.find((a) => a.id === hover) : null
  return (
    <div className="rosca">
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} role="img" aria-label="Participação por canal">
        {total === 0 && <circle cx={c} cy={c} r={(R + r) / 2 - 2} fill="none" stroke="var(--line-soft)" strokeWidth={R - r - 4} />}
        {arcos.map((a) => (
          <path key={a.id} d={caminho(a.a0, a.a1, hover === a.id || selecionada === a.id ? R : R - 4)} fill={a.cor} stroke="var(--surface)" strokeWidth="2"
            className={(hover && hover !== a.id) || (selecionada && selecionada !== a.id && !hover) ? 'graf-apaga' : ''}
            onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} onClick={() => onClicar?.(a.id)} style={{ cursor: onClicar ? 'pointer' : 'default', transition: 'd .15s' }} />
        ))}
        <text x={c} y={c - 4} textAnchor="middle" className="rosca-valor">{fmt(foco ? foco.valor : total)}</text>
        <text x={c} y={c + 16} textAnchor="middle" className="rosca-rotulo">{foco ? `${foco.nome} · ${Math.round((foco.valor / total) * 100)}%` : rotuloCentro}</text>
      </svg>
      <div className="rosca-legenda">
        {fatias.map((f) => (
          <button key={f.id} type="button" className={`rosca-item ${selecionada === f.id ? 'on' : ''}`} onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)} onClick={() => onClicar?.(f.id)}>
            <i style={{ background: f.cor }} /><span>{f.nome}</span>
            <b>{fmt(f.valor)}</b><em>{total ? Math.round((f.valor / total) * 100) : 0}%</em>
          </button>
        ))}
      </div>
    </div>
  )
}
