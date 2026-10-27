import { useEffect, useRef, useState } from 'react'
import { listarListas } from '../lib/precos.js'
import { buscarCep, buscarCnpj, titulo } from '../lib/consultas.js'
import { soDigitos } from '../lib/format.js'
import Icon from './Icon.jsx'
import { CANAIS, TIPOS_PARCEIRO, salvarParceiro } from '../lib/parceiros.js'

export default function ParceiroForm({ parceiro, tipoInicial, onFechar, onSalvo }) {
  const editando = Boolean(parceiro)
  const [f, setF] = useState(() => ({
    nome: parceiro?.nome || '',
    tipos: parceiro?.tipos || [tipoInicial || 'cliente'],
    documento: parceiro?.documento || '',
    telefone: parceiro?.telefone || '',
    email: parceiro?.email || '',
    cep: parceiro?.cep || '',
    endereco: parceiro?.endereco || '',
    numero: parceiro?.numero || '',
    complemento: parceiro?.complemento || '',
    bairro: parceiro?.bairro || '',
    cidade: parceiro?.cidade || '',
    uf: parceiro?.uf || '',
    canal: parceiro?.canal || '',
    lista: parceiro?.lista || '',
    observacoes: parceiro?.observacoes || '',
    ativo: parceiro?.ativo ?? true,
  }))
  const [listas, setListas] = useState([])
  useEffect(() => { listarListas().then(setListas).catch(() => {}) }, [])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const [busca, setBusca] = useState({ cnpj: '', cep: '' }) // mensagem de cada busca
  const [buscando, setBuscando] = useState('')
  const campoNumero = useRef(null)

  const [receita, setReceita] = useState(null) // dados vindos da Receita, para conferir antes de usar

  async function porCnpj(valor = f.documento) {
    if (soDigitos(valor).length !== 14) return
    setBuscando('cnpj'); setBusca((b) => ({ ...b, cnpj: '' })); setReceita(null)
    try {
      const d = await buscarCnpj(valor)
      setReceita({
        razao: titulo(d.razao), fantasia: titulo(d.fantasia), situacao: (d.situacao || '').toUpperCase(),
        telefone: d.telefone, email: d.email, cep: d.cep ? `${d.cep.slice(0, 5)}-${d.cep.slice(5)}` : '',
        endereco: titulo(d.logradouro), numero: d.numero || '', complemento: titulo(d.complemento), bairro: titulo(d.bairro),
        cidade: titulo(d.cidade), uf: d.uf || '',
      })
    } catch (e) { setBusca((b) => ({ ...b, cnpj: e.message })) } finally { setBuscando('') }
  }

  // tudo = substitui o que estiver preenchido; senão, só completa o que está em branco
  function usarReceita(tudo) {
    const r = receita
    const pega = (atual, novo) => (tudo ? novo || atual : atual || novo)
    setF((x) => ({
      ...x,
      nome: pega(x.nome, r.fantasia || r.razao),
      telefone: pega(x.telefone, r.telefone), email: pega(x.email, r.email),
      cep: pega(x.cep, r.cep), endereco: pega(x.endereco, r.endereco), numero: pega(x.numero, r.numero),
      complemento: pega(x.complemento, r.complemento), bairro: pega(x.bairro, r.bairro),
      cidade: pega(x.cidade, r.cidade), uf: pega(x.uf, r.uf),
      observacoes: x.observacoes || (r.fantasia && r.razao ? `Razão social: ${r.razao}` : ''),
    }))
    setBusca((b) => ({ ...b, cnpj: `✓ Dados da Receita aplicados — confira e ajuste o que o cliente passou diferente` }))
    setReceita(null)
  }

  async function porCep(valor = f.cep) {
    if (soDigitos(valor).length !== 8) return
    setBuscando('cep'); setBusca((b) => ({ ...b, cep: '' }))
    try {
      const d = await buscarCep(valor)
      setF((x) => ({ ...x, cep: `${d.cep.slice(0, 5)}-${d.cep.slice(5)}`, endereco: titulo(d.logradouro) || x.endereco, bairro: titulo(d.bairro) || x.bairro, cidade: d.cidade || x.cidade, uf: d.uf || x.uf }))
      setTimeout(() => campoNumero.current?.focus(), 50)
      setBusca((b) => ({ ...b, cep: `✓ ${d.cidade}/${d.uf} — digite o número` }))
    } catch (e) { setBusca((b) => ({ ...b, cep: e.message })) } finally { setBuscando('') }
  }

  function alternarTipo(t) {
    const tem = f.tipos.includes(t)
    if (tem && f.tipos.length === 1) return
    setF({ ...f, tipos: tem ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] })
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (f.uf && !/^[A-Za-z]{2}$/.test(f.uf.trim())) return setErro('UF com 2 letras (ex.: MG).')
    setSalvando(true)
    try {
      const salvo = await salvarParceiro(f, parceiro?.id)
      onSalvo(salvo)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Cadastro</div>
            <h2>{editando ? f.nome || 'Editar cadastro' : 'Novo cadastro'}</h2>
          </div>
          <button type="button" className="btn icon-btn" aria-label="Fechar" onClick={onFechar}>✕</button>
        </div>

        <div className="field">
          <span>Tipo (pode marcar mais de um)</span>
          <div className="chips">
            {TIPOS_PARCEIRO.map((t) => (
              <button type="button" key={t.valor} className={`chip ${f.tipos.includes(t.valor) ? 'on' : ''}`} onClick={() => alternarTipo(t.valor)}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="field span-2">
            <span>CNPJ / CPF</span>
            <div className="campo-busca">
              <input value={f.documento} inputMode="numeric" placeholder="Digite o CNPJ"
                onChange={(e) => { setF({ ...f, documento: e.target.value }); if (soDigitos(e.target.value).length === 14) porCnpj(e.target.value) }} />
              <button type="button" className="btn icon-btn" title="Buscar dados do CNPJ" aria-label="Buscar dados do CNPJ" onClick={() => porCnpj()} disabled={buscando === 'cnpj' || soDigitos(f.documento).length !== 14}>{buscando === 'cnpj' ? '…' : <Icon name="busca" size={16} />}</button>
            </div>
            {busca.cnpj && <small className={busca.cnpj.startsWith('✓') ? 'busca-ok' : 'busca-erro'}>{busca.cnpj}</small>}
          </div>
          {receita && (
            <div className="receita span-3" role="region" aria-label="Dados encontrados na Receita">
              <div className="receita-head">
                <div><b>Dados da Receita Federal</b><span>Confira antes de usar</span></div>
                <span className={`pill ${receita.situacao === 'ATIVA' ? 'ok' : 'bad'}`}>{receita.situacao || 'situação não informada'}</span>
              </div>
              <dl className="receita-dados">
                <dt>Razão social</dt><dd>{receita.razao || '—'}</dd>
                <dt>Nome fantasia</dt><dd>{receita.fantasia || '—'}</dd>
                <dt>Telefone</dt><dd>{receita.telefone || '—'}</dd>
                <dt>E-mail</dt><dd>{receita.email || '—'}</dd>
                <dt>Endereço</dt><dd>{[receita.endereco, receita.numero].filter(Boolean).join(', ') || '—'}{receita.complemento ? ` – ${receita.complemento}` : ''}</dd>
                <dt>Bairro</dt><dd>{receita.bairro || '—'}</dd>
                <dt>Cidade</dt><dd>{receita.cidade ? `${receita.cidade}/${receita.uf}` : '—'}{receita.cep ? ` · CEP ${receita.cep}` : ''}</dd>
              </dl>
              {receita.situacao && receita.situacao !== 'ATIVA' && <p className="busca-erro" style={{ margin: 0 }}>⚠ Este CNPJ não está ATIVO na Receita. Confirme com o cliente antes de vender.</p>}
              <div className="actions" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sm" onClick={() => setReceita(null)}>Ignorar</button>
                <button type="button" className="btn btn-sm" onClick={() => usarReceita(false)}>Completar só o que está em branco</button>
                <button type="button" className="btn btn-sm btn-dark" onClick={() => usarReceita(true)}>Usar estes dados</button>
              </div>
            </div>
          )}
          <label className="field span-2"><span>Nome / razão social *</span><input required value={f.nome} onChange={set('nome')} placeholder="Loja Primavera" /></label>
          <label className="field"><span>Telefone / WhatsApp</span><input value={f.telefone} onChange={set('telefone')} placeholder="(37) 99999-0000" inputMode="tel" /></label>
          <label className="field span-2"><span>E-mail</span><input type="email" value={f.email} onChange={set('email')} /></label>
          <div className="field">
            <span>CEP</span>
            <div className="campo-busca">
              <input value={f.cep} inputMode="numeric" placeholder="00000-000"
                onChange={(e) => { setF({ ...f, cep: e.target.value }); if (soDigitos(e.target.value).length === 8) porCep(e.target.value) }} />
              <button type="button" className="btn icon-btn" title="Buscar endereço pelo CEP" aria-label="Buscar endereço pelo CEP" onClick={() => porCep()} disabled={buscando === 'cep' || soDigitos(f.cep).length !== 8}>{buscando === 'cep' ? '…' : <Icon name="busca" size={16} />}</button>
            </div>
            {busca.cep && <small className={busca.cep.startsWith('✓') ? 'busca-ok' : 'busca-erro'}>{busca.cep}</small>}
          </div>
          <label className="field span-2"><span>Rua / avenida</span><input value={f.endereco} onChange={set('endereco')} placeholder="Rua Para de Minas" /></label>
          <label className="field"><span>Número</span><input ref={campoNumero} value={f.numero} onChange={set('numero')} placeholder="1200 ou S/N" /></label>
          <label className="field"><span>Complemento</span><input value={f.complemento} onChange={set('complemento')} placeholder="Sala 2, galpão B…" /></label>
          <label className="field"><span>Bairro</span><input value={f.bairro} onChange={set('bairro')} /></label>
          <label className="field"><span>Cidade</span><input value={f.cidade} onChange={set('cidade')} /></label>
          <label className="field"><span>UF</span><input value={f.uf} onChange={set('uf')} maxLength={2} placeholder="MG" /></label>
          <label className="field">
            <span>Canal principal</span>
            <select className="input" value={f.canal} onChange={set('canal')}>
              <option value="">—</option>
              {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Lista de preço</span>
            <select className="input" value={f.lista} onChange={set('lista')}>
              <option value="">Pelo canal</option>
              {listas.map((l) => <option key={l.codigo} value={l.codigo}>{l.nome}</option>)}
            </select>
          </label>
          <label className="field span-2"><span>Observações</span><input value={f.observacoes} onChange={set('observacoes')} placeholder="Prazo combinado, preferências, transportadora…" /></label>
        </div>

        {editando && (
          <label className="check">
            <input type="checkbox" checked={!f.ativo} onChange={(e) => setF({ ...f, ativo: !e.target.checked })} />
            Inativo (não aparece na hora de fazer pedido)
          </label>
        )}

        {erro && <p className="form-error" role="alert">{erro}</p>}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn btn-dark" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
