import { createClient } from '@supabase/supabase-js'

// A chave "publishable" é pública por natureza (fica no navegador).
// Quem protege os dados são as regras de acesso (RLS) do banco.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://etjdygbelgjqeodefjuw.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PVhhIo8ugXUuJWF7B-LdzQ_7KzcYL3x'

export const supabase = createClient(URL, KEY)
