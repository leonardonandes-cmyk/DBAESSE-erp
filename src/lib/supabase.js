import { createClient } from '@supabase/supabase-js'

// A chave "publishable" é pública por natureza (fica no navegador).
// Quem protege os dados são as regras de acesso (RLS) do banco.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://etjdygbelgjqeodefjuw.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PVhhIo8ugXUuJWF7B-LdzQ_7KzcYL3x'

export const supabase = createClient(URL, KEY)

// O banco devolve no máximo 1.000 linhas por consulta.
// todas(() => supabase.from(...).select(...).order(...)) busca página por página até acabar.
export async function todas(montar, pagina = 1000) {
  const out = []
  for (let de = 0; ; de += pagina) {
    const { data, error } = await montar().range(de, de + pagina - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < pagina) return out
  }
}
