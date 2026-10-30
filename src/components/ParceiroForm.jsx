import { useEffect, useRef, useState } from 'react'
import { listarListas } from '../lib/precos.js'
import { supabase } from '../lib/supabase.js'
import { buscarCep, buscarCnpj, conferirEndereco, fmtCepBR, titulo } from '../lib/consultas.js'
import { soDigitos } from '../lib/format.js'
import Icon from './Icon.jsx'
import { CANAIS, TIPOS_PARCEIRO, salvarParceiro } from '../lib/parceiros.js'

export default function ParceiroForm({ parceiro, tipoInicial, consumidorInicial = false, onFechar, onSalvo }) {
  const editando = Boolean(parceiro)
  const [f, setF] = useState(() => ({
    nome: parceiro?.nome || '',
    tipos: parceiro?.tipos || [tipoInicial || 'cliente'],
    documento: parceiro?.documento || '',
    razao_social: parceiro?.razao_social || '',
    inscricao_estadual: parceiro?.inscricao_estadual || '',
    contato: parceiro?.contato || '',
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
    grupo: parceiro?.grupo || '',
    condicao_especial: Boolean(parceiro?.condicao_especial),
    desconto_par: parceiro?.desconto_par ? String(parceiro.desconto_par).replace('.', ',') : '',
    observacoes: parceiro?.observacoes || '',
    ativo: parceiro?.ativo ?? true,
    consumidor_final: parceiro ? Boolean(parceiro.consumidor_final) : consumidorInicial,
  }))
  const [listas, setListas] = useState([])
  useEffect(() => { listarListas().then(setListas).catch(() => {}) }, [])
  // condição especial: só o administrador vê e altera
  const [souAdmin, setSouAdmin] = useState(false)
  useEffect(() => { supabase.rpc('sou_admin').then(({ data }) => setSouAdmin(Boolean(data))) }, [])
  const condCarregada = !parceiro || 'condicao_especial' in parceiro
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
      razao_social: pega(x.razao_social, r.razao),
      telefone: pega(x.telefone, r.telefone), email: pega(x.email, r.email),
      cep: pega(x.cep, r.cep), endereco: pega(x.endereco, r.endereco), numero: pega(x.numero, r.numero),
      complemento: pega(x.complemento, r.complemento), bairro: pega(x.bairro, r.bairro),
      cidade: pega(x.cidade, r.cidade), uf: pega(x.uf, r.uf),
    }))
    setBusca((b) => ({ ...b, cnpj: `✓ Dados da Receita aplicados — confira e ajuste o que o cliente passou diferente` }))
    setReceita(null)
  }

  async function porCep(valor = f.cep) {
    if (soDigitos(valor).length !== 8) return
    setBuscando('cep'); setBusca((b) => ({ ...b, cep: '' }))
    try {
      const d = await buscarCep(valor)
      setF((x) => ({ ...x, numero: soDigitos(x.numero) === d.cep ? '' : x.numero, cep: `${d.cep.slice(0, 5)}-${d.cep.slice(5)}`, endereco: titulo(d.logradouro) || x.endereco, bairro: titulo(d.bairro) || x.bairro, cidade: d.cidade || x.cidade, uf: d.uf || x.uf }))
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
    if (f.consumidor_final && !f.telefone.trim()) return setErro('Informe o telefone / WhatsApp da sacoleira.')
    const errEnd = f.consumidor_final ? null : conferirEndereco(f)
    if (errEnd) return setErro(errEnd)
    setSalvando(true)
    try {
      const dados = { ...f, cep: fmtCepBR(f.cep) }
      if (!(souAdmin && condCarregada)) { delete dados.condicao_especial; delete dados.desconto_par; dados.lista = parceiro?.lista || f.lista }
      else if (dados.condicao_especial && !dados.lista) dados.lista = 'atacado'
      const salvo = await salvarParceiro(dados, parceiro?.id)
      onSalvo(salvo)
    } catch (e) {
      setErro(e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onFechar}>
      <form className="modal" autoComplete="off" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
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

        {f.tipos.includes('cliente') && (
          <div className="segmented" role="tablist" aria-label="Tipo de cliente">
            <button type="button" role="tab" aria-selected={!f.consumidor_final} className={!f.consumidor_final ? 'on' : ''} onClick={() => setF({ ...f, consumidor_final: false })}>Empresa · NF-e</button>
            <button type="button" role="tab" aria-selected={f.consumidor_final} className={f.consumidor_final ? 'on' : ''} onClick={() => setF({ ...f, consumidor_final: true })}>Sacoleira · consumidor final</button>
          </div>
        )}

        {f.consumidor_final ? (
          <div className="form-grid">
            <label className="field span-2"><span>Nome *</span><input required value={f.nome} onChange={set('nome')} placeholder="Nome da sacoleira" autoFocus /></label>
            <label className="field"><span>Telefone / WhatsApp *</span><input value={f.telefone} onChange={set('telefone')} placeholder="(37) 99999-0000" inputMode="tel" /></label>
            <label className="field"><span>CPF (opcional)</span><input value={f.documento} onChange={set('documento')} inputMode="numeric" placeholder="000.000.000-00" /></label>
            <label className="field"><span>Cidade (opcional)</span><input name="erp-cidade" autoComplete="off" value={f.cidade} onChange={set('cidade')} /></label>
            <label className="field"><span>UF</span><input value={f.uf} onChange={set('uf')} maxLength={2} placeholder="MG" /></label>
            <label className="field">
              <span>Polo / grupo</span>
              <input value={f.grupo} onChange={set('grupo')} placeholder="Ex.: Fartura" list="grupos-parceiro" />
              <datalist id="grupos-parceiro"><option value="Fartura" /></datalist>
            </label>
            <label className="field span-2"><span>Observações</span><input value={f.observacoes} onChange={set('observacoes')} placeholder="Preferências, como prefere receber…" /></label>
            <p className="footnote span-3" style={{ margin: 0 }}>Cadastro rápido de consumidor final (pessoa física): só nome e telefone são obrigatórios.</p>
          </div>
        ) : (
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
          <label className="field span-2"><span>Nome (fantasia) *</span><input required value={f.nome} onChange={set('nome')} placeholder="Loja Primavera" /></label>
          <label className="field"><span>Inscrição estadual</span><input value={f.inscricao_estadual} onChange={set('inscricao_estadual')} placeholder="Isento ou número" /></label>
          <label className="field span-2"><span>Razão social</span><input value={f.razao_social} onChange={set('razao_social')} placeholder="Primavera Calçados Ltda" /></label>
          <label className="field"><span>Contato / responsável</span><input value={f.contato} onChange={set('contato')} placeholder="Nome de quem compra" /></label>
          <label className="field"><span>Telefone / WhatsApp</span><input value={f.telefone} onChange={set('telefone')} placeholder="(37) 99999-0000" inputMode="tel" /></label>
          <label className="field span-2"><span>E-mail</span><input type="email" value={f.email} onChange={set('email')} /></label>
          <div className="field">
            <span>CEP</span>
            <div className="campo-busca">
              <input name="erp-cep" autoComplete="off" value={f.cep} inputMode="numeric" placeholder="00000-000"
                onChange={(e) => { setF({ ...f, cep: e.target.value }); if (soDigitos(e.target.value).length === 8) porCep(e.target.value) }} />
              <button type="button" className="btn icon-btn" title="Buscar endereço pelo CEP" aria-label="Buscar endereço pelo CEP" onClick={() => porCep()} disabled={buscando === 'cep' || soDigitos(f.cep).length !== 8}>{buscando === 'cep' ? '…' : <Icon name="busca" size={16} />}</button>
            </div>
            {busca.cep && <small className={busca.cep.startsWith('✓') ? 'busca-ok' : 'busca-erro'}>{busca.cep}</small>}
          </div>
          <label className="field span-2"><span>Rua / avenida</span><input name="erp-rua" autoComplete="off" value={f.endereco} onChange={set('endereco')} placeholder="Rua Para de Minas" /></label>
          <label className="field"><span>Número</span><input name="erp-numero" autoComplete="off" ref={campoNumero} value={f.numero} onChange={set('numero')} placeholder="1200 ou S/N" /></label>
          <label className="field"><span>Complemento</span><input name="erp-compl" autoComplete="off" value={f.complemento} onChange={set('complemento')} placeholder="Sala 2, galpão B…" /></label>
          <label className="field"><span>Bairro</span><input name="erp-bairro" autoComplete="off" value={f.bairro} onChange={set('bairro')} /></label>
          <label className="field"><span>Cidade</span><input name="erp-cidade" autoComplete="off" value={f.cidade} onChange={set('cidade')} /></label>
          <label className="field"><span>UF</span><input value={f.uf} onChange={set('uf')} maxLength={2} placeholder="MG" /></label>
          <label className="field">
            <span>Canal principal</span>
            <select className="input" value={f.canal} onChange={set('canal')}>
              <option value="">—</option>
              {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Polo / grupo</span>
            <input value={f.grupo} onChange={set('grupo')} placeholder="Ex.: Fartura" list="grupos-parceiro" />
            <datalist id="grupos-parceiro"><option value="Fartura" /></datalist>
          </label>
          <label className="field span-2"><span>Observações</span><input value={f.observacoes} onChange={set('observacoes')} placeholder="Prazo combinado, preferências, transportadora…" /></label>
        </div>
        )}

        {souAdmin && condCarregada && (
          <div className="condicao-especial">
            <label className="check">
              <input type="checkbox" checked={f.condicao_especial} onChange={(e) => setF({ ...f, condicao_especial: e.target.checked, lista: f.lista || 'atacado' })} />
              <b>Condição especial</b><small> · cliente fundador — vale em qualquer segmento (atacado, variado, drop)</small>
            </label>
            {f.condicao_especial && (
              <div className="grid-2">
                <label className="field">
                  <span>Preço base</span>
                  <select className="input" value={f.lista || 'atacado'} onChange={set('lista')}>
                    {listas.map((l) => <option key={l.codigo} value={l.codigo}>{l.nome}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Desconto por par (R$)</span>
                  <input inputMode="decimal" value={f.desconto_par} onChange={set('desconto_par')} placeholder="1,00" />
                </label>
              </div>
            )}
            <small className="muted">Só o administrador vê este campo. A vendedora e o segmento do pedido não mudam.</small>
          </div>
        )}

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
