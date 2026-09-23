/**
 * Auth guard for vendas.liganer.com.br static SPAs.
 * Include before the app bundle: <script src="/auth/guard.js"></script>
 *
 * - Redirects unauthenticated users to /login.html
 * - Shows a single session chip (name + email + Voltar + Sair) fixed top-right
 * - Hides native .session-chip duplicates from sibling SPA headers
 */
(function () {
  var host = String(location.hostname || '')
  if (host !== 'vendas.liganer.com.br') return

  var path = String(location.pathname || '/')
  if (path === '/login.html' || path.indexOf('/auth/') === 0) return

  /** Paths that use this shared session chip. */
  var SESSION_CHIP_PREFIXES = [
    '/prospeccao',
    '/orcamento/blanks-slitters',
    '/orcamento/ace',
    '/orcamento/chapas-bobinas',
    '/comparador-preco',
    '/usuarios.html',
  ]

  function normalizedPath() {
    var p = String(location.pathname || '/')
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1)
    return p || '/'
  }

  function wantsSessionChip() {
    var p = normalizedPath()
    for (var i = 0; i < SESSION_CHIP_PREFIXES.length; i += 1) {
      var prefix = SESSION_CHIP_PREFIXES[i]
      if (prefix.indexOf('.html') !== -1) {
        if (p === prefix) return true
        continue
      }
      if (p === prefix || p.indexOf(prefix + '/') === 0) return true
    }
    return false
  }

  function hideUntilAuth() {
    if (document.getElementById('vendas-auth-pending-style')) return
    var style = document.createElement('style')
    style.id = 'vendas-auth-pending-style'
    style.textContent =
      'html.vendas-auth-pending,html.vendas-auth-pending body{visibility:hidden!important}'
    ;(document.head || document.documentElement).appendChild(style)
    document.documentElement.classList.add('vendas-auth-pending')
  }

  function revealApp() {
    document.documentElement.classList.remove('vendas-auth-pending')
    var style = document.getElementById('vendas-auth-pending-style')
    if (style && style.parentNode) style.parentNode.removeChild(style)
  }

  function goLogin() {
    var next = location.pathname + location.search + location.hash
    location.replace('/login.html?next=' + encodeURIComponent(next || '/'))
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function mountSessionChip(user) {
    if (!wantsSessionChip()) return
    if (document.getElementById('vendas-session-chip')) return

    var style = document.createElement('style')
    style.id = 'vendas-session-chip-style'
    style.textContent = [
      /* Hide native SPA chips so only this one remains. */
      '.session-chip,#root .session-chip,.brand-row .session-chip{display:none!important}',
      '#vendas-session-chip{',
      'position:fixed;top:12px;right:12px;z-index:2147483000;',
      'display:grid;gap:2px;justify-items:end;text-align:right;',
      'padding:10px 12px;border-radius:8px;',
      'background:#fff;border:1px solid #d8dfd9;',
      'box-shadow:0 10px 28px rgba(20,37,31,0.12);',
      'color:#17211d;font:500 0.9rem/1.25 system-ui,-apple-system,sans-serif;',
      '}',
      '#vendas-session-chip strong{font-size:0.9rem;font-weight:700}',
      '#vendas-session-chip span{color:#56635d;font-size:0.78rem}',
      '#vendas-session-chip .vendas-session-actions{',
      'display:grid;gap:6px;justify-items:stretch;margin-top:6px;width:100%;min-width:7.5rem',
      '}',
      '#vendas-session-chip .vendas-session-actions a,',
      '#vendas-session-chip .vendas-session-actions button{',
      'display:block;width:100%;box-sizing:border-box;text-align:center;',
      'border:1px solid #d8dfd9;border-radius:8px;',
      'background:#fff;color:#17211d;font:inherit;font-size:0.82rem;font-weight:700;',
      'padding:6px 10px;cursor:pointer;text-decoration:none',
      '}',
      '#vendas-session-chip .vendas-session-actions a:hover,',
      '#vendas-session-chip .vendas-session-actions button:hover{border-color:rgba(198,0,0,0.35)}',
      '@media (max-width:640px){',
      '#vendas-session-chip{top:8px;right:8px;left:8px;justify-items:start;text-align:left}',
      '}',
    ].join('')

    var chip = document.createElement('div')
    chip.id = 'vendas-session-chip'
    chip.setAttribute('data-vendas-session', '1')
    chip.innerHTML =
      '<strong>' +
      escapeHtml(user.name || user.email) +
      '</strong><span>' +
      escapeHtml(user.email) +
      '</span><div class="vendas-session-actions">' +
      '<a id="vendas-session-home" href="/">Voltar</a>' +
      '<button type="button" id="vendas-session-logout">Sair</button>' +
      '</div>'

    function attach() {
      if (!document.getElementById('vendas-session-chip-style')) {
        ;(document.head || document.documentElement).appendChild(style)
      }
      ;(document.body || document.documentElement).appendChild(chip)
      var logoutBtn = document.getElementById('vendas-session-logout')
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          fetch('/auth/logout.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
            .catch(function () {})
            .finally(function () {
              location.replace('/login.html')
            })
        })
      }
    }

    if (document.body) attach()
    else document.addEventListener('DOMContentLoaded', attach)
  }

  hideUntilAuth()

  fetch('/auth/me.php', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then(function (res) {
      if (!res.ok) throw new Error('unauthenticated')
      return res.json()
    })
    .then(function (data) {
      if (!data || !data.authenticated || !data.user || !data.user.email) {
        throw new Error('unauthenticated')
      }
      mountSessionChip({
        name: data.user.name || data.user.email,
        email: data.user.email,
      })
      revealApp()
    })
    .catch(function () {
      goLogin()
    })
})()
