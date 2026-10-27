// Consultas públicas e gratuitas: CEP (ViaCEP / BrasilAPI) e CNPJ (BrasilAPI / CNPJ.ws)
import { soDigitos } from './format.js'

async function json(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

export async function buscarCep(cep) {
  const c = soDigitos(cep)
  if (c.length !== 8) throw new Error('CEP precisa ter 8 números.')
  try {
    const d = await json(`https://viacep.com.br/ws/${c}/json/`)
    if (d.erro) throw new Error('nao')
    return { cep: c, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf, complemento: d.complemento }
  } catch {
    try {
      const d = await json(`https://brasilapi.com.br/api/cep/v1/${c}`)
      return { cep: c, logradouro: d.street, bairro: d.neighborhood, cidade: d.city, uf: d.state }
    } catch { throw new Error('CEP não encontrado.') }
  }
}

export function cnpjValido(v) {
  const c = soDigitos(v)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const dv = (base) => {
    let soma = 0, peso = base.length - 7
    for (const n of base) { soma += Number(n) * peso--; if (peso < 2) peso = 9 }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13])
}

const tel = (t) => {
  const d = soDigitos(t)
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return t || ''
}
const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const titulo = (s) => (s || '').toLowerCase().replace(/(^|\s|\/|-)(\p{L}+)/gu, (m, a, w) => a + (a && MINUSC.has(w) ? w : w[0].toUpperCase() + w.slice(1)))

export async function buscarCnpj(cnpj) {
  const c = soDigitos(cnpj)
  if (!cnpjValido(c)) throw new Error('CNPJ inválido — confira os números.')
  try {
    const d = await json(`https://brasilapi.com.br/api/cnpj/v1/${c}`)
    return {
      cnpj: c, razao: d.razao_social, fantasia: d.nome_fantasia, situacao: d.descricao_situacao_cadastral,
      telefone: tel(d.ddd_telefone_1), email: (d.email || '').toLowerCase(), cep: soDigitos(d.cep),
      logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '), numero: d.numero,
      complemento: d.complemento, bairro: d.bairro, cidade: d.municipio, uf: d.uf,
    }
  } catch {
    try {
      const d = await json(`https://publica.cnpj.ws/cnpj/${c}`)
      const e = d.estabelecimento || {}
      return {
        cnpj: c, razao: d.razao_social, fantasia: e.nome_fantasia, situacao: e.situacao_cadastral,
        telefone: tel(`${e.ddd1 || ''}${e.telefone1 || ''}`), email: (e.email || '').toLowerCase(), cep: soDigitos(e.cep),
        logradouro: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' '), numero: e.numero,
        complemento: e.complemento, bairro: e.bairro, cidade: e.cidade?.nome, uf: e.estado?.sigla,
      }
    } catch { throw new Error('Não encontrei esse CNPJ agora. Tente de novo em alguns segundos.') }
  }
}

export const montarEndereco = ({ logradouro, numero, complemento, bairro }) =>
  [titulo(logradouro) + (numero ? `, ${numero}` : ''), titulo(complemento), titulo(bairro)].filter((x) => x && x.trim()).join(' – ')
export { titulo }
