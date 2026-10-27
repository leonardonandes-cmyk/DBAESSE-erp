import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { buscarCep, buscarCnpj, titulo } from '../lib/consultas.js'
import { soDigitos } from '../lib/format.js'
import { supabase } from '../lib/supabase.js'

const CAMPOS = ['nome', 'razao_social', 'cnpj', 'ie', 'telefone', 'email', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'uf']
const fmtCep = (c) => (c && c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c)

// Dados da empresa (Configurações): só o administrador altera
export default function DadosEmpresa({ podeEditar, onSalvo }) {
  const [f, setF] = useState(null)
  const [id, setId] = useState(null)
  const [mudou, setMudou] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [buscando, setBuscando] = useState('')
  const campoNumero = useRef(null)

  useEffect(() => {
    supabase.from('empresas').select(`id,${CAMPOS.join(',')}`).single().then(({ data, error }) => {
      if (error) return setErro(error.message)
      setId(data.id); setF(Object.fromEntries(CAMPOS.map((k) => [k, data[k] || ''])))
    })
  }, [])

  if (!f) return <p className="card-sub" style={{ margin: 0 }}>{erro || 'Carregando…'}</p>
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMudou(true) }

  async function porCnpj(v = f.cnpj) {
    if (soDigitos(v).length !== 14) return
    setBuscando('cnpj'); setMsg('')
    try {
      const d = await buscarCnpj(v)
      setF((x) => ({
        ...x, razao_social: titulo(d.razao) || x.razao_social, telefone: x.telefone || d.telefone, email: x.email || d.email,
        cep: fmtCep(d.cep) || x.cep, endereco: titulo(d.logradouro) || x.endereco, numero: d.numero || x.numero,
        complemento: titulo(d.complemento) || x.complemento, bairro: titulo(d.bairro) || x.bairro, cidade: titulo(d.cidade) || x.cidade, uf: d.uf || x.uf,
      }))
      setMudou(true); setMsg(`✓ ${titulo(d.razao)} · ${d.situacao || ''}`)
    } catch (e) { setMsg(e.message) } finally { setBuscando('') }
  }
  async function porCep(v = f.cep) {
    if (soDigitos(v).length !== 8) return
    setBuscando('cep'); setMsg('')
    try {
      const d = await buscarCep(v)
      setF((x) => ({ ...x, cep: fmtCep(d.cep), endereco: titulo(d.logradouro) || x.endereco, bairro: titulo(d.bairro) || x.bairro, cidade: d.cidade || x.cidade, uf: d.uf || x.uf }))
      setMudou(true); setMsg(`✓ ${d.cidade}/${d.uf} — confira o número`); setTimeout(() => campoNumero.current?.focus(), 50)
    } catch (e) { setMsg(e.message) } finally { setBuscando('') }
  }
  async function salvar() {
    setErro('')
    const linha = Object.fromEntries(CAMPOS.map((k) => [k, (f[k] || '').trim() || null]))
    if (!linha.nome) return setErro('Informe o nome da empresa.')
    if (linha.uf) linha.uf = linha.uf.toUpperCase()
    const { error } = await supabase.from('empresas').update(linha).eq('id', id)
    if (error) return setErro(error.message)
    setMudou(false); setMsg('✓ Dados da empresa salvos'); onSalvo?.(linha)
  }

  const dis = !podeEditar
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="form-grid">
        <div className="field">
          <span>CNPJ</span>
          <div className="campo-busca">
            <input value={f.cnpj} disabled={dis} inputMode="numeric" placeholder="00.000.000/0000-00"
              onChange={(e) => { set('cnpj')(e); if (soDigitos(e.target.value).length === 14) porCnpj(e.target.value) }} />
            <button type="button" className="btn icon-btn" disabled={dis || buscando === 'cnpj' || soDigitos(f.cnpj).length !== 14} onClick={() => porCnpj()} aria-label="Buscar dados do CNPJ" title="Buscar dados do CNPJ">{buscando === 'cnpj' ? '…' : <Icon name="busca" size={16} />}</button>
          </div>
        </div>
        <label className="field span-2"><span>Razão social</span><input value={f.razao_social} disabled={dis} onChange={set('razao_social')} /></label>
        <label className="field"><span>Nome (marca)</span><input value={f.nome} disabled={dis} onChange={set('nome')} /></label>
        <label className="field"><span>Inscrição estadual</span><input value={f.ie} disabled={dis} onChange={set('ie')} /></label>
        <label className="field"><span>Telefone / WhatsApp</span><input value={f.telefone} disabled={dis} onChange={set('telefone')} inputMode="tel" /></label>
        <label className="field span-3"><span>E-mail</span><input type="email" value={f.email} disabled={dis} onChange={set('email')} /></label>
        <div className="field">
          <span>CEP</span>
          <div className="campo-busca">
            <input value={f.cep} disabled={dis} inputMode="numeric" placeholder="00000-000"
              onChange={(e) => { set('cep')(e); if (soDigitos(e.target.value).length === 8) porCep(e.target.value) }} />
            <button type="button" className="btn icon-btn" disabled={dis || buscando === 'cep' || soDigitos(f.cep).length !== 8} onClick={() => porCep()} aria-label="Buscar endereço pelo CEP" title="Buscar endereço pelo CEP">{buscando === 'cep' ? '…' : <Icon name="busca" size={16} />}</button>
          </div>
        </div>
        <label className="field span-2"><span>Rua / avenida</span><input value={f.endereco} disabled={dis} onChange={set('endereco')} /></label>
        <label className="field"><span>Número</span><input ref={campoNumero} value={f.numero} disabled={dis} onChange={set('numero')} /></label>
        <label className="field"><span>Complemento</span><input value={f.complemento} disabled={dis} onChange={set('complemento')} /></label>
        <label className="field"><span>Bairro</span><input value={f.bairro} disabled={dis} onChange={set('bairro')} /></label>
        <label className="field span-2"><span>Cidade</span><input value={f.cidade} disabled={dis} onChange={set('cidade')} /></label>
        <label className="field"><span>UF</span><input value={f.uf} disabled={dis} onChange={set('uf')} maxLength={2} /></label>
      </div>
      {erro && <p className="form-error" role="alert">{erro}</p>}
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <small className={msg.startsWith('✓') ? 'busca-ok' : msg ? 'busca-erro' : ''}>{dis ? 'Só o administrador altera estes dados.' : msg}</small>
        {podeEditar && <button className="btn btn-dark" disabled={!mudou} onClick={salvar}>Salvar dados da empresa</button>}
      </div>
    </div>
  )
}
