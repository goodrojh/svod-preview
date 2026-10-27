/* Невидимая Yandex SmartCaptcha для форм заявок СВОДЪ.
   window.__svodCaptchaToken() → Promise<string>: одноразовый токен или '' (капча
   не загрузилась, домен не разрешён, человек закрыл задание, долго нет ответа).
   Заявка уходит в любом случае — проверяет токен и решает скрипт Google. */
(function () {
  var SITEKEY = 'ysc1_Ac2GbbgwlJoYX2dVtQ5tCCbLxD9Rz97Kp8rAgYuz4059f90b'
  var WAIT = 8000            // сколько ждём токен, если задание не показано
  var WAIT_CHALLENGE = 180000 // если Яндекс показал задание — даём время его решить
  var widgetId = null, pending = null, loading = null
  // Капча разрешена в Яндекс Облаке только для svodmsk.ru. На других адресах
  // (предпросмотр на GitHub, локальная копия) не грузим её и не ждём — заявка
  // уйдёт без токена, и скрипт пометит её «без проверки капчи».
  var ENABLED = /(^|\.)svodmsk\.ru$/.test(location.hostname)

  function load() {
    if (!ENABLED) return Promise.resolve(false)
    if (loading) return loading
    loading = new Promise(function (resolve) {
      if (window.smartCaptcha) return resolve(true)
      window.__svodCaptchaOnload = function () { resolve(true) }
      var s = document.createElement('script')
      s.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=__svodCaptchaOnload'
      s.async = true
      s.onerror = function () { resolve(false) }
      document.head.appendChild(s)
    }).then(function (ok) { if (ok) ensureWidget(); return ok })
    return loading
  }

  function finish(token) {
    if (!pending) return
    var p = pending; pending = null
    clearTimeout(p.timer)
    p.resolve(token || '')
  }

  function wait(ms) {
    if (!pending) return
    clearTimeout(pending.timer)
    pending.timer = setTimeout(function () { finish('') }, ms)
  }

  function ensureWidget() {
    if (widgetId !== null) return true
    try {
      var box = document.createElement('div')
      box.id = 'svod-captcha'
      document.body.appendChild(box)
      widgetId = window.smartCaptcha.render(box, {
        sitekey: SITEKEY,
        invisible: true,
        shieldPosition: 'center-left', // значок «Yandex SmartCaptcha» слева, не закрывает кнопки мессенджеров
        hl: 'ru',
        callback: function (token) { finish(token) },
      })
      var sc = window.smartCaptcha
      sc.subscribe(widgetId, 'challenge-visible', function () { wait(WAIT_CHALLENGE) })
      sc.subscribe(widgetId, 'challenge-hidden', function () { finish('') })
      sc.subscribe(widgetId, 'network-error', function () { finish('') })
      sc.subscribe(widgetId, 'javascript-error', function () { finish('') })
      return true
    } catch (e) {
      widgetId = null
      return false
    }
  }

  window.__svodCaptchaToken = function () {
    return load().then(function (ok) {
      if (!ok || !window.smartCaptcha || !ensureWidget()) return ''
      return new Promise(function (resolve) {
        finish('') // на случай двойного нажатия
        pending = { resolve: resolve, timer: null }
        wait(WAIT)
        try {
          window.smartCaptcha.reset(widgetId) // токен одноразовый — для каждой заявки новый
          window.smartCaptcha.execute(widgetId)
        } catch (e) { finish('') }
      })
    }).catch(function () { return '' })
  }

  // Загружаем заранее, чтобы при отправке формы не ждать
  if (document.readyState === 'complete') load()
  else window.addEventListener('load', function () { load() })
})()
