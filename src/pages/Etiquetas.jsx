import { useEffect, useMemo, useState } from 'react'
import SeletorGrade from '../components/SeletorGrade.jsx'
import RomaneioAvulso from '../components/RomaneioAvulso.jsx'
import { FotoProduto } from '../components/FotoProduto.jsx'
import { desenhoDe, listarCores, listarProdutos } from '../lib/produtos.js'
import DesenhosEtiqueta from '../components/DesenhosEtiqueta.jsx'
import {
  baixarZpl, codigoCaixa, enviarParaZebra, listarTamanhos, salvarServidor, servidorEtiquetas, zplColetivas, zplUnitarias, refsSemDesenho,
} from '../lib/etiquetas.js'

/*
  ETIQUETAS — reposição: reimprimir quando for preciso (perdeu, rasgou, faltou).
  As etiquetas normais saem pelo fluxo da produção. Aqui: escolhe modelo + cor + grade → fila → imprime.
  Unitária = uma etiqueta por par (caixa do par). Coletiva = uma etiqueta por caixa master (grade fechada / Bulk).
*/
export default function Etiquetas() {
  const [aba, setAba] = useState('unitaria')
  const [produtos, setProdutos] = useState([])
  const [cores, setCores] = useState([])
  const [tamanhos, setTamanhos] = useState({})
  const [fila, setFila] = useState([])
  const [caixas, setCaixas] = useState(1)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [config, setConfig] = useState(false)
  const [serv, setServ] = useState(servidorEtiquetas())

  useEffect(() => {
    Promise.all([listarProdutos(), listarCores(), listarTamanhos()])
      .then(([p, c, t]) => { setProdutos(p.filter((x) => x.status !== 'inativo')); setCores(c); setTamanhos(t) })
      .catch((e) => setErro(e.message))
  }, [])

  const corPorId = useMemo(() => Object.fromEntries(cores.map((c) => [c.id, c])), [cores])

  function trocarAba(a) { setAba(a); setFila([]); setMsg(''); setErro('') }

  // Unitária: cada número vira uma linha da fila com a quantidade de etiquetas
  function addUnitarias(linhas) {
    const novas = linhas.map((l) => ({
      chave: `${l.sku_id}-${Date.now()}`, tipo: 'unitaria', produto: l.produto, corId: l.cor?.id,
      ref: l.produto.ref, tipoProd: l.produto.tipo, cor: l.cor?.nome, numero: l.numero, sku: l.sku,
      usa: tamanhos[l.numero]?.usa, eur: tamanhos[l.numero]?.eur, quantidade: l.quantidade, desenhoUrl: desenhoDe(l.produto),
    }))
    setFila((f) => [...f, ...novas])
    setMsg('')
  }

  // Coletiva: a grade digitada é o conteúdo de UMA caixa; "caixas" = quantas etiquetas iguais
  function addColetiva(linhas) {
    const p = linhas[0].produto
    const cor = linhas[0].cor
    const grade = linhas.map((l) => ({ numero: l.numero, pares: l.quantidade })).sort((a, b) => a.numero - b.numero)
    const total = grade.reduce((s, g) => s + g.pares, 0)
    setFila((f) => [...f, {
      chave: `cx-${p.id}-${cor?.id}-${Date.now()}`, tipo: 'coletiva', produto: p, corId: cor?.id,
      ref: p.ref, tipoProd: p.tipo, cor: cor?.nome, grade, total,
      codigo: codigoCaixa(p.ref, cor?.sigla || '', total), quantidade: Math.max(1, Number(caixas) || 1), desenhoUrl: desenhoDe(p),
    }])
    setMsg('')
  }

  const totalEtq = fila.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
  async function zpl() {
    const un = fila.filter((i) => i.tipo === 'unitaria').map((i) => ({ ...i, tipo: i.tipoProd }))
    const co = fila.filter((i) => i.tipo === 'coletiva').map((i) => ({ ...i, tipo: i.tipoProd }))
    return [un.length ? await zplUnitarias(un) : '', co.length ? await zplColetivas(co) : ''].filter(Boolean).join('\n')
  }

  async function imprimir() {
    setErro(''); setMsg(''); setEnviando(true)
    try {
      await enviarParaZebra(await zpl())
      setMsg(`${totalEtq} etiqueta(s) enviada(s) para a Zebra.`)
      setFila([])
    } catch (e) { setErro(e.message) }
    setEnviando(false)
  }

  const mudarQtd = (chave, v) => setFila((f) => f.map((i) => (i.chave === chave ? { ...i, quantidade: v } : i)))
  const tirar = (chave) => setFila((f) => f.filter((i) => i.chave !== chave))
  const previa = fila[fila.length - 1]
  const semDesenho = refsSemDesenho(fila.map((i) => i.produto))

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Reposição · reimprimir quando for preciso</div>
          <h1>Etiquetas</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setConfig((v) => !v)}>Impressora</button>
        </div>
      </header>

      {config && (
        <section className="card">
          <div className="card-head"><div><h2>Impressora</h2><div className="card-sub">Endereço do ETIQUETAS-V2 no PC da Zebra. No próprio PC da fábrica: http://localhost:9192</div></div></div>
          <div className="actions">
            <input className="input" style={{ flex: 1 }} value={serv} onChange={(e) => setServ(e.target.value)} />
            <button className="btn btn-dark" onClick={() => { salvarServidor(serv); setConfig(false) }}>Salvar</button>
          </div>
        </section>
      )}

      <div className="segmented" role="tablist" style={{ marginBottom: 16 }}>
        {[['unitaria', 'Unitária · por par'], ['coletiva', 'Coletiva · por caixa'], ['romaneio', 'Romaneio de envio'], ['desenhos', 'Desenhos']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={aba === k} className={aba === k ? 'on' : ''} onClick={() => trocarAba(k)}>{l}</button>
        ))}
      </div>

      {erro && <p className="form-error" role="alert">{erro}</p>}
      {msg && <p className="pill ok" role="status" style={{ display: 'inline-block', marginBottom: 12 }}>{msg}</p>}

      {aba === 'romaneio' ? <RomaneioAvulso /> : aba === 'desenhos' ? <DesenhosEtiqueta produtos={produtos} onMudou={(id, url) => setProdutos((ps) => ps.map((p) => (p.id === id ? { ...p, desenho_url: url } : p)))} /> : (
      <>
      <section className="etq-grid">
        <div className="card">
          <div className="card-head"><div>
            <h2>{aba === 'unitaria' ? 'O que reimprimir' : 'Conteúdo da caixa'}</h2>
            <div className="card-sub">{aba === 'unitaria'
              ? 'Escolha modelo e cor e digite quantas etiquetas de cada número.'
              : 'Digite os pares de cada número dentro de UMA caixa. Depois diga quantas caixas iguais.'}</div>
          </div></div>
          {aba === 'coletiva' && (
            <label className="field" style={{ maxWidth: 200, marginBottom: 12 }}>
              <span>Caixas iguais</span>
              <input className="input" type="number" min={1} value={caixas} onChange={(e) => setCaixas(e.target.value)} />
            </label>
          )}
          <SeletorGrade key={aba} produtos={produtos} cores={cores}
            onAdicionar={aba === 'unitaria' ? addUnitarias : addColetiva}
            rotulo={aba === 'unitaria' ? 'Adicionar à fila' : 'Adicionar caixa'} />
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Prévia</h2><div className="card-sub">100×60 mm · Zebra ZD230</div></div></div>
          {previa
            ? (previa.tipo === 'unitaria' ? <PreviaUnitaria i={previa} /> : <PreviaColetiva i={previa} />)
            : <div className={`etq etq-vazia `}>A prévia aparece aqui</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div><h2>Fila de impressão</h2><div className="card-sub">{totalEtq} etiqueta(s)</div>
            {semDesenho.length > 0 && <p className="aviso-desenho">Sem desenho: REF {semDesenho.join(', ')} — sai com o quadro em branco. <button className="link-btn" onClick={() => trocarAba('desenhos')}>Incluir desenho</button></p>}
          </div>
          <div className="actions">
            <button className="btn" disabled={!fila.length} onClick={async () => baixarZpl(await zpl(), `etiquetas-${aba}.zpl`)}>Baixar .zpl</button>
            <button className="btn btn-dark" disabled={!fila.length || enviando} onClick={imprimir}>{enviando ? 'Enviando…' : `Imprimir ${totalEtq || ''}`}</button>
          </div>
        </div>
        {fila.length === 0 ? <p className="card-sub" style={{ margin: 0 }}>Nada na fila.</p> : (
          <table>
            <thead><tr><th>Modelo</th><th>{aba === 'unitaria' ? 'Número' : 'Grade'}</th><th>Código</th><th className="r">{aba === 'unitaria' ? 'Etiquetas' : 'Caixas'}</th><th></th></tr></thead>
            <tbody>
              {fila.map((i) => (
                <tr key={i.chave}>
                  <td><div className="prod-cell"><FotoProduto p={i.produto} corId={i.corId} className="sm" size={18} /><div><b>{i.ref} · {i.produto.nome}</b><span>{i.cor}</span></div></div></td>
                  <td>{i.tipo === 'unitaria' ? <b>{i.numero}</b> : (
                    <div className="grade-mini">{i.grade.map((g) => <span key={g.numero}>{g.numero}<small>{g.pares}</small></span>)}</div>
                  )}</td>
                  <td className="muted">{i.tipo === 'unitaria' ? i.sku : i.codigo}</td>
                  <td className="r"><input className="input input-sm" type="number" min={1} value={i.quantidade} onChange={(e) => mudarQtd(i.chave, e.target.value)} style={{ width: 80 }} /></td>
                  <td className="r"><button className="link-btn" onClick={() => tirar(i.chave)}>tirar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      </>
      )}
    </>
  )
}

function Barras({ texto }) {
  return <div className="etq-barras"><div className="etq-listras" /><span>{texto}</span></div>
}

function PreviaUnitaria({ i }) {
  const desenho = desenhoDe(i.produto)
  return (
    <div className="etq etq-v2">
      <div className="v2-topo">
        <div className="v2-esq">
          <div className="v2-quadro">{desenho && <img src={desenho} alt="" />}</div>
          <div className="v2-ref">REF {i.ref}</div>
          <div className="v2-cor">COR: {String(i.cor || '').toUpperCase().replace(/\s*\/\s*/g, ' / ')}</div>
        </div>
        <div className="v2-dir">
          <div className="v2-num">{i.numero}</div>
          <div className="v2-intl">{(i.usa || i.eur) ? `USA ${i.usa}  |  EUR ${i.eur}` : ''}</div>
          <div className="v2-tipo">{i.tipoProd}</div>
        </div>
      </div>
      <Barras texto={`SKU: ${i.sku}`} />
    </div>
  )
}

function PreviaColetiva({ i }) {
  const desenho = desenhoDe(i.produto)
  return (
    <div className="etq etq-v2 col-v2">
      <div className="v2-topo">
        <div className="v2-esq">
          <div className="v2-quadro">{desenho && <img src={desenho} alt="" />}</div>
          <div className="v2-ref">REF {i.ref}</div>
          <div className="v2-cor">COR: {String(i.cor || '').toUpperCase().replace(/\s*\/\s*/g, ' / ')}</div>
        </div>
        <div className="v2-dir">
          <div className="v2-num">{i.total}</div>
          <div className="v2-intl">PARES</div>
          <div className="v2-tipo">{i.tipoProd}</div>
          <div className="etq-barras" style={{ marginTop: 'auto' }}><div className="etq-listras" style={{ width: '80%' }} /><span>{i.codigo}</span></div>
        </div>
      </div>
      <div className="etq-grade">
        {i.grade.map((g) => <div key={g.numero}><b>{g.numero}</b><span>{g.pares}</span></div>)}
      </div>
    </div>
  )
}
