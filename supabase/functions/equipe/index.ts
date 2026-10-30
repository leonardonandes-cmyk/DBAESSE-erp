// Equipe: só o ADMIN cria usuários e troca senha de quem é da equipe.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: quem } = await admin.auth.getUser(token)
    if (!quem?.user) return json({ erro: 'Sessão inválida. Entre de novo.' }, 401)
    const { data: eu } = await admin.from('perfis').select('papel,empresa_id').eq('id', quem.user.id).maybeSingle()
    if (eu?.papel !== 'admin') return json({ erro: 'Só o administrador pode fazer isso.' }, 403)

    const b = await req.json()
    const senhaOk = (s: string) => typeof s === 'string' && s.length >= 6

    if (b.acao === 'criar') {
      const email = String(b.email || '').trim().toLowerCase()
      const nome = String(b.nome || '').trim()
      const papel = ['admin', 'gestor', 'operador'].includes(b.papel) ? b.papel : 'operador'
      if (!email.includes('@') || !nome) return json({ erro: 'Informe nome e login (e-mail).' }, 400)
      if (!senhaOk(b.senha)) return json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, 400)
      const { data, error } = await admin.auth.admin.createUser({ email, password: b.senha, email_confirm: true, user_metadata: { nome } })
      if (error) return json({ erro: /already|registered|exists/i.test(error.message) ? 'Esse login já existe.' : error.message }, 400)
      await admin.from('perfis').upsert({ id: data.user.id, empresa_id: eu.empresa_id, nome, papel })
      return json({ ok: true })
    }

    if (b.acao === 'senha') {
      if (!senhaOk(b.senha)) return json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, 400)
      const { data: alvo } = await admin.from('perfis').select('empresa_id').eq('id', b.id).maybeSingle()
      if (!alvo || alvo.empresa_id !== eu.empresa_id) return json({ erro: 'Usuário não encontrado.' }, 404)
      const { error } = await admin.auth.admin.updateUserById(b.id, { password: b.senha })
      if (error) return json({ erro: error.message }, 400)
      return json({ ok: true })
    }

    if (b.acao === 'logins') {
      const { data: perfis } = await admin.from('perfis').select('id').eq('empresa_id', eu.empresa_id)
      const ids = new Set((perfis || []).map((p) => p.id))
      const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
      const logins: Record<string, string> = {}
      for (const u of data?.users || []) if (ids.has(u.id)) logins[u.id] = u.email || ''
      return json({ logins })
    }

    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500)
  }
})
