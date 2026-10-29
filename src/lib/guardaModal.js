/*
  Proteção de cadastros abertos (vale para TODAS as janelas .modal do sistema):
  1. Clicar fora da janela (no fundo escuro) NÃO fecha mais nada.
  2. Se algo foi digitado/alterado, fechar pelo ✕ ou "Cancelar" pergunta antes:
     "Deseja salvar as alterações?" → Salvar · Sair sem salvar · Continuar editando.
  3. Recarregar/fechar a aba com um cadastro alterado também pede confirmação do navegador.
  Funciona por escuta global (capture), sem precisar mexer em cada formulário.
*/
const ROTULOS_FECHAR = /^(cancelar|fechar|voltar|✕|×|x)$/i
const ROTULOS_SALVAR = /salvar|criar|gravar|lançar|confirmar|registrar|cadastrar|gerar|concluir/i

const alterado = (modal) => modal?.dataset.alterado === '1'

function botaoSalvar(modal) {
  const form = modal.querySelector('form')
  const enviar = form?.querySelector('button[type="submit"]:not(:disabled), button:not([type]):not(:disabled)')
  if (form && enviar) return () => (form.requestSubmit ? form.requestSubmit(enviar) : enviar.click())
  const b = [...modal.querySelectorAll('button.btn-dark:not(:disabled)')].reverse().find((x) => ROTULOS_SALVAR.test(x.textContent || ''))
  return b ? () => b.click() : null
}

function perguntar(modal, fechar) {
  const salvar = botaoSalvar(modal)
  const fundo = document.createElement('div')
  fundo.className = 'modal-bg guarda-bg'
  fundo.setAttribute('role', 'alertdialog')
  fundo.setAttribute('aria-modal', 'true')
  fundo.innerHTML = `
    <div class="modal guarda">
      <div class="guarda-ic">!</div>
      <h2>Deseja salvar as alterações?</h2>
      <p>Você alterou este cadastro e ainda não salvou. Se sair agora, o que foi preenchido será perdido.</p>
      <div class="guarda-acoes">
        ${salvar ? '<button class="btn btn-dark" data-acao="salvar">Salvar</button>' : ''}
        <button class="btn ${salvar ? '' : 'btn-dark'}" data-acao="continuar">Continuar editando</button>
        <button class="btn btn-perigo" data-acao="sair">Sair sem salvar</button>
      </div>
    </div>`
  const tirar = () => { fundo.remove(); document.removeEventListener('keydown', tecla, true) }
  const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); tirar() } }
  fundo.addEventListener('click', (e) => {
    const acao = e.target.closest('[data-acao]')?.dataset.acao
    if (!acao) return
    tirar()
    if (acao === 'salvar') salvar()
    if (acao === 'sair') { delete modal.dataset.alterado; fechar() }
  })
  document.addEventListener('keydown', tecla, true)
  document.body.appendChild(fundo)
  fundo.querySelector('[data-acao="continuar"]')?.focus()
}

export function instalarGuardaModal() {
  if (window.__guardaModal) return
  window.__guardaModal = true

  // 1) fundo escuro não fecha
  const bloquearFundo = (e) => {
    const t = e.target
    if (t instanceof HTMLElement && t.classList.contains('modal-bg') && !t.classList.contains('guarda-bg')) {
      e.stopPropagation()
      e.preventDefault()
    }
  }
  document.addEventListener('click', bloquearFundo, true)

  // 2) marca a janela como alterada quando digitam/escolhem algo
  const marcar = (e) => {
    const modal = e.target instanceof Element ? e.target.closest('.modal') : null
    if (modal && !modal.classList.contains('guarda')) modal.dataset.alterado = '1'
  }
  document.addEventListener('input', marcar, true)
  document.addEventListener('change', marcar, true)

  // 3) ✕ / Cancelar com alteração → pergunta antes
  document.addEventListener('click', (e) => {
    const botao = e.target instanceof Element ? e.target.closest('button') : null
    if (!botao || botao.dataset.guardaOk === '1') return
    const modal = botao.closest('.modal')
    if (!modal || modal.classList.contains('guarda') || !alterado(modal)) return
    const rotulo = (botao.getAttribute('aria-label') || botao.textContent || '').trim()
    if (!ROTULOS_FECHAR.test(rotulo)) return
    e.stopPropagation()
    e.preventDefault()
    perguntar(modal, () => { botao.dataset.guardaOk = '1'; botao.click(); delete botao.dataset.guardaOk })
  }, true)

  // 4) recarregar/fechar a aba com cadastro alterado
  window.addEventListener('beforeunload', (e) => {
    if (document.querySelector('.modal[data-alterado="1"]')) { e.preventDefault(); e.returnValue = '' }
  })
}
