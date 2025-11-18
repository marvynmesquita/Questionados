/* eslint-disable no-restricted-globals */

// Este service worker pode ser personalizado!
// Veja https://developers.google.com/web/tools/workbox/modules
// para a lista de módulos disponíveis.

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

clientsClaim()

// Precache de todos os assets gerados pelo processo de build.
// As URLs são injetadas na variável self.__WB_MANIFEST.
precacheAndRoute(self.__WB_MANIFEST)

// Configuração de Roteamento App Shell
// Satisfaz qualquer pedido de navegação (ex: /dashboard) com o index.html
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$')
registerRoute(
  // Retorna false para isenção de pedidos que não sejam de navegação.
  ({ request, url }) => {
    if (request.mode !== 'navigate') {
      return false
    } // Se for uma URL que começa com /_, ignora.
    if (url.pathname.startsWith('/_')) {
      return false
    } // Se parecer uma URL de recurso (tem extensão), ignora.
    if (url.pathname.match(fileExtensionRegexp)) {
      return false
    } // Retorna true para navegar.
    return true
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
)

// Exemplo de cache em tempo de execução para imagens (png/jpg)
// Mantém imagens em cache para performance offline
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && url.pathname.endsWith('.png'),
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })]
  })
)

// Isso permite que a web app acione skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
