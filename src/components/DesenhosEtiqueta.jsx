import { useMemo, useRef, useState } from 'react'
import { FotoProduto } from './FotoProduto.jsx'
import { desenhoDe, subirDesenho } from '../lib/produtos.js'

/*
  DESENHOS DA ETIQUETA (Operações → Etiquetas → Desenhos)
  Um desenho de linha por REFERÊNCIA — vale para todos os SKUs (cores e números) da REF.
  Busca pela REF → Incluir desenho. Se já tiver, pergunta se deseja substituir.
  REF sem desenho sai na etiqueta com o quadro em branco.
*/
export default function DesenhosEtiqueta({ produtos, onMudou }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos') // todos | sem | com
  const [enviando, setEnviando] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const arquivo = useRef(null)
  const alvo = useRef(null)

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos
      .filter((p) => !q || `${p.ref} ${p.nome} ${p.tipo || ''}`.toLowerCase().includes(q))
      .filter((p) => filtro === 'todos' || (filtro === 'sem' ? !desenhoDe(p) : !!desenhoDe(p)))
      .sort((a, b) => String(a.ref).localeCompare(String(b.ref), 'pt-BR', { numeric: true }))
  }, [produtos, busca, filtro])
  const faltam = produtos.filter((p) => !desenhoDe(p)).length

  function escolher(p) {
    setErro(''); setOk('')
    if (p.desenho_url && !window.confirm(`Já existe desenho para a REF ${p.ref}. Deseja substituir?`)) return
    alvo.current = p
    arquivo.current.value = ''
    arquivo.current.click()
  }

  async function enviar(e) {
    const f = e.target.files?.[0]
    const p = alvo.current
    if (!f || !p) return
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return setErro('Envie uma imagem PNG, JPG ou WEBP.')
    if (f.size > 2 * 1024 * 1024) return setErro('Imagem grande demais (máx. 2 MB).')
    setEnviando(p.id)
    try {
      const url = await subirDesenho(p, f)
      onMudou?.(p.id, url)
      setOk(`Desenho da REF ${p.ref} salvo.`)
    } catch (err) { setErro(err.message) }
    setEnviando('')
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Desenhos da etiqueta</h2>
          <div className="card-sub">Um desenho de linha por referência (vale para todas as cores e números). {faltam} referência(s) sem desenho — saem com o quadro em branco.</div>
        </div>
      </div>

      <div className="actions" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} type="search" placeholder="Buscar pela referência (ex.: 500)" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        <div className="segmented" role="tablist">
          {[['todos', 'Todos'], ['sem', `Sem desenho (${faltam})`], ['com', 'Com desenho']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filtro === k} className={filtro === k ? 'on' : ''} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
      </div>

      {erro && <p className="form-error" role="alert">{erro}</p>}
      {ok && <p className="pill ok" role="status" style={{ display: 'inline-block', marginBottom: 12 }}>{ok}</p>}
      <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={enviar} />

      <div className="desenhos-grid">
        {lista.map((p) => {
          const d = desenhoDe(p)
          return (
            <div key={p.id} className="desenho-card">
              <div className="desenho-topo">
                <FotoProduto p={p} className="sm" size={18} />
                <div><b>REF {p.ref}</b><span>{p.tipo || p.nome}</span></div>
              </div>
              <div className={`desenho-quadro ${d ? '' : 'vazio'}`}>
                {d ? <img src={d} alt={`Desenho REF ${p.ref}`} loading="lazy" /> : <span>sem desenho</span>}
              </div>
              {!p.desenho_url && d && <small className="muted">usando o desenho padrão do tipo</small>}
              <button className={`btn btn-sm ${p.desenho_url ? '' : 'btn-dark'}`} disabled={enviando === p.id} onClick={() => escolher(p)}>
                {enviando === p.id ? 'Enviando…' : p.desenho_url ? 'Substituir desenho' : 'Incluir desenho'}
              </button>
            </div>
          )
        })}
        {lista.length === 0 && <p className="card-sub">Nenhuma referência encontrada.</p>}
      </div>
    </section>
  )
}
