// Este código opcional é usado para registar um service worker.
// register() não é chamado por defeito.

// Isto permite que a app carregue mais rápido em visitas subsequentes em produção
// e tenha capacidades offline. No entanto, também significa que os programadores
// (e utilizadores) só verão as atualizações implementadas na visita "N+1" a uma página,
// uma vez que os recursos previamente armazenados em cache são atualizados em segundo plano.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] é o endereço IPv6 localhost.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 são considerados localhost para IPv4.
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
)

export function register (config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // O construtor de URL está disponível em todos os navegadores que suportam SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href)
    if (publicUrl.origin !== window.location.origin) {
      // O nosso service worker não funcionará se PUBLIC_URL estiver numa origem diferente
      return
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`

      if (isLocalhost) {
        // Isto está a correr no localhost. Vamos verificar se um service worker ainda existe ou não.
        checkValidServiceWorker(swUrl, config)

        // Adicionar algum log extra para localhost
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'Esta aplicação está a ser servida em cache-first por um service worker. ' +
              'Para mais detalhes, visite https://cra.link/PWA'
          )
        })
      } else {
        // Não é localhost. Apenas registar o service worker.
        registerValidSW(swUrl, config)
      }
    })
  }
}

function registerValidSW (swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Neste ponto, o conteúdo pré-carregado atualizado foi obtido,
              // mas o service worker anterior ainda servirá o conteúdo antigo
              // até que todas as abas do cliente sejam fechadas.
              console.log(
                'Novo conteúdo está disponível e será usado quando todas ' +
                  'as abas desta página forem fechadas. Veja https://cra.link/PWA.'
              )

              if (config && config.onUpdate) {
                config.onUpdate(registration)
              }
            } else {
              // Neste ponto, tudo foi pré-carregado.
              // É o momento perfeito para exibir uma mensagem "O conteúdo está em cache para uso offline".
              console.log('O conteúdo está em cache para uso offline.')

              if (config && config.onSuccess) {
                config.onSuccess(registration)
              }
            }
          }
        }
      }
    })
    .catch(error => {
      console.error('Erro durante o registo do service worker:', error)
    })
}

function checkValidServiceWorker (swUrl, config) {
  // Verificar se o service worker pode ser encontrado. Se não puder, recarregar a página.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' }
  })
    .then(response => {
      // Garantir que o service worker existe e que estamos a receber um ficheiro JS.
      const contentType = response.headers.get('content-type')
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // Service worker não encontrado. Provavelmente uma app diferente. Recarregar a página.
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload()
          })
        })
      } else {
        // Service worker encontrado. Proceder normalmente.
        registerValidSW(swUrl, config)
      }
    })
    .catch(() => {
      console.log(
        'Sem ligação à internet. A aplicação está a correr em modo offline.'
      )
    })
}

export function unregister () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister()
      })
      .catch(error => {
        console.error(error.message)
      })
  }
}
