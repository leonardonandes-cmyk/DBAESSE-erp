import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/*
  Leitor de código de barras para qualquer celular:
  - Câmera: biblioteca html5-qrcode (Android e iPhone), carregada só quando abre a câmera.
  - Campo de texto: digitar o código ou usar leitor Bluetooth/USB (ele "digita" e dá Enter).
  onCodigo(texto) é chamado a cada leitura. Leituras repetidas do mesmo código em 1,5 s são ignoradas.
*/
const LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
let carregando
function carregarLib() {
  if (window.Html5Qrcode) return Promise.resolve()
  carregando ||= new Promise((ok, falha) => {
    const s = document.createElement('script')
    s.src = LIB; s.async = true
    s.onload = ok
    s.onerror = () => { carregando = null; falha(new Error('Não consegui carregar o leitor. Confira a internet.')) }
    document.head.appendChild(s)
  })
  return carregando
}

export default function Leitor({ onCodigo, rotulo = 'Bipar produto' }) {
  const [camera, setCamera] = useState(false)
  const [erro, setErro] = useState('')
  const [texto, setTexto] = useState('')
  const leitor = useRef(null)
  const ultimo = useRef({ c: '', t: 0 })
  const cb = useRef(onCodigo)
  cb.current = onCodigo
  const campo = useRef(null)

  function receber(c) {
    const agora = Date.now()
    if (c === ultimo.current.c && agora - ultimo.current.t < 1500) return
    ultimo.current = { c, t: agora }
    cb.current(c)
  }

  useEffect(() => {
    if (!camera) return
    let vivo = true
    setErro('')
    carregarLib().then(async () => {
      if (!vivo) return
      const H = window.Html5Qrcode
      const F = window.Html5QrcodeSupportedFormats
      const l = new H('leitor-camera', {
        verbose: false,
        formatsToSupport: [F.CODE_128, F.EAN_13, F.EAN_8, F.CODE_39, F.UPC_A, F.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      })
      leitor.current = l
      await l.start({ facingMode: 'environment' },
        { fps: 12, qrbox: (w, h) => ({ width: Math.min(w * 0.85, 340), height: Math.min(h * 0.45, 150) }), aspectRatio: 1.333 },
        (txt) => receber(txt), () => {})
    }).catch((e) => {
      if (!vivo) return
      setErro(/permission|NotAllowed/i.test(String(e)) ? 'Libere o uso da câmera para este site nas configurações do navegador.' : (e.message || String(e)))
      setCamera(false)
    })
    return () => {
      vivo = false
      const l = leitor.current
      leitor.current = null
      if (l) l.stop().then(() => l.clear()).catch(() => {})
    }
  }, [camera])

  function enviar(e) {
    e.preventDefault()
    const c = texto.trim()
    if (c) receber(c)
    setTexto('')
    campo.current?.focus()
  }

  return (
    <div className="leitor">
      {camera && <div id="leitor-camera" className="leitor-camera" />}
      <div className="leitor-barra">
        <button type="button" className={`btn ${camera ? '' : 'btn-dark'} leitor-btn`} onClick={() => setCamera(!camera)}>
          <Icon name="leitor" size={20} />{camera ? 'Fechar câmera' : rotulo}
        </button>
        <form onSubmit={enviar} className="leitor-form">
          <input ref={campo} className="input" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="ou digite / leitor Bluetooth" autoCapitalize="characters" autoComplete="off" enterKeyHint="go" aria-label="Código do produto" />
        </form>
      </div>
      {erro && <p className="form-error" role="alert" style={{ margin: 0 }}>{erro}</p>}
    </div>
  )
}
