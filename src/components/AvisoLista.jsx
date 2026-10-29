import Icon from './Icon.jsx'
import { MODALIDADE, modalidadeDoCanal } from '../lib/modalidades.js'

// Trava ao escolher uma lista de preço que não é do segmento do pedido.
export default function AvisoLista({ canal, escolhida, esperada, listas, onVoltar, onSeguir }) {
  const nome = (c) => listas.find((l) => l.codigo === c)?.nome || c
  const seg = MODALIDADE[modalidadeDoCanal(canal)]?.label || canal
  return (
    <div className="modal-bg aviso-lista-bg" role="alertdialog" aria-modal="true" aria-labelledby="aviso-lista-t">
      <div className="modal aviso-lista">
        <div className="aviso-lista-ic"><Icon name="alerta" size={26} /></div>
        <h2 id="aviso-lista-t">Lista de outro segmento</h2>
        <p>Você está tentando usar a lista <b>{nome(escolhida)}</b> num pedido de <b>{seg}</b>.<br />Essa lista não é deste segmento — o preço pode sair errado.</p>
        <p className="aviso-lista-q">Deseja seguir mesmo assim?</p>
        <div className="aviso-lista-acoes">
          <button className="btn btn-dark" onClick={onVoltar} autoFocus>Voltar para a lista {nome(esperada)}</button>
          <button className="btn btn-perigo" onClick={onSeguir}>Seguir com {nome(escolhida)}</button>
        </div>
      </div>
    </div>
  )
}
