// 과목내비 발표 화면. 1920×1080 무대를 창 크기에 맞춰 줄이고 늘린다.
// 보기: 기본(청중) · ?view=presenter(발표자 화면: 지금 장·다음 장·노트·시간) · ?view=script(발표 대본, 인쇄용)
// 청중 화면과 발표자 화면은 BroadcastChannel로 같은 장을 따라간다. ?static은 전환 없이 보여 준다(캡처·인쇄 확인용).
;(() => {
  const W = 1920
  const H = 1080
  const params = new URLSearchParams(location.search)
  const view = ['presenter', 'script'].includes(params.get('view')) ? params.get('view') : 'deck'
  const root = document.documentElement
  root.classList.add(`view-${view}`)
  if (params.has('static')) root.classList.add('no-anim')

  const deck = document.getElementById('deck')
  const slides = [...deck.querySelectorAll(':scope > .slide')]
  const total = slides.length

  // 장마다 사이트 머리글과 쪽 번호를 붙인다
  const chrome = document.getElementById('chrome').content
  slides.forEach((slide, i) => {
    const top = chrome.querySelector('.top').cloneNode(true)
    const foot = chrome.querySelector('.foot').cloneNode(true)
    for (const b of top.querySelectorAll('[data-to]')) b.classList.toggle('is-on', b.dataset.to === slide.dataset.section)
    foot.querySelector('.page-no').textContent = `${i + 1} / ${total}`
    slide.prepend(top)
    slide.append(foot)
    slide.setAttribute('role', 'group')
    slide.setAttribute('aria-roledescription', '슬라이드')
  })

  const titleOf = (i) => slides[i].getAttribute('aria-label')
  const notesOf = (i) => slides[i].querySelector('.notes')
  const secOf = (i) => Number(notesOf(i)?.dataset.sec || 0)
  const upTo = (i) => slides.slice(0, i + 1).reduce((sum, _, j) => sum + secOf(j), 0)
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
  const fromHash = () => {
    const n = parseInt(location.hash.slice(1), 10)
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), total) - 1 : 0
  }

  // 쪽 크기: 발표 화면은 1920×1080 한 장씩, 대본은 A4
  const page = document.createElement('style')
  page.textContent = view === 'script' ? '@page { size: A4; margin: 14mm }' : '@page { size: 1920px 1080px; margin: 0 }'
  document.head.append(page)

  // 작은 미리보기: 장을 복사해 1920×1080 그대로 그리고 칸 너비에 맞춰 줄인다
  const sizer = new ResizeObserver((entries) => {
    for (const e of entries) e.target.style.setProperty('--k', e.contentRect.width / W)
  })
  function thumb(i) {
    const box = document.createElement('div')
    box.className = 'thumb'
    if (i >= total) {
      box.classList.add('thumb-end')
      box.textContent = '마지막 장이에요'
      return box
    }
    const stage = document.createElement('div')
    stage.className = 'thumb-stage'
    const copy = slides[i].cloneNode(true)
    copy.classList.add('is-on', 'static')
    copy.classList.remove('is-leaving')
    copy.inert = true
    copy.setAttribute('aria-hidden', 'true')
    stage.append(copy)
    box.append(stage)
    sizer.observe(box)
    return box
  }

  // ---- 같은 장 따라가기 ----
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('gwamok-navi-deck') : null
  let index = -1
  let render = () => {}
  function go(i, { remote = false, animate = true } = {}) {
    const next = Math.min(Math.max(i, 0), total - 1)
    if (next === index) return
    const prev = index
    index = next
    history.replaceState(null, '', `${location.pathname}${location.search}#${index + 1}`)
    render(index, prev, animate)
    if (!remote) channel?.postMessage({ type: 'go', index })
  }
  if (channel) {
    channel.onmessage = (e) => {
      const msg = e.data || {}
      if (msg.type === 'go') go(msg.index, { remote: true })
      else if (msg.type === 'hello' && view === 'deck') channel.postMessage({ type: 'go', index })
    }
  }
  addEventListener('hashchange', () => go(fromHash()))

  // ---- 키보드·터치 ----
  const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' '])
  const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])
  let digits = ''
  let digitTimer = 0
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
    const k = e.key
    if (/^[0-9]$/.test(k)) {
      digits = (digits + k).slice(-2)
      clearTimeout(digitTimer)
      digitTimer = setTimeout(() => (digits = ''), 1500)
      return
    }
    if (k === 'Enter' && digits) {
      e.preventDefault()
      go(Number(digits) - 1)
      digits = ''
      return
    }
    if (k === ' ' && e.shiftKey) {
      e.preventDefault()
      go(index - 1)
    } else if (NEXT.has(k)) {
      e.preventDefault()
      go(index + 1)
    } else if (PREV.has(k)) {
      e.preventDefault()
      go(index - 1)
    } else if (k === 'Home') go(0)
    else if (k === 'End') go(total - 1)
    else if (view === 'deck' && (k === 'f' || k === 'F')) toggleFull()
    else if (view === 'deck' && (k === 's' || k === 'S')) openPresenter()
    else if (view === 'deck' && (k === 'b' || k === 'B' || k === '.')) root.classList.toggle('black')
  }
  if (view !== 'script') addEventListener('keydown', onKey)

  let touch = null
  addEventListener('touchstart', (e) => (touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null), { passive: true })
  addEventListener('touchend', (e) => {
    if (!touch || view !== 'deck') return
    const dx = e.changedTouches[0].clientX - touch.x
    const dy = e.changedTouches[0].clientY - touch.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1))
    touch = null
  })

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen()
    else root.requestFullscreen?.()?.catch(() => {})
  }
  function openPresenter() {
    window.open(`${location.pathname}?view=presenter#${index + 1}`, 'gwamok-presenter', 'popup=yes,width=1280,height=800')
  }

  // ---- 청중 화면 ----
  function startDeck() {
    const count = document.querySelector('.ctl-count')
    const leaving = new Map()
    const fit = () => {
      const k = Math.min(innerWidth / W, innerHeight / H)
      deck.style.transform = `translate(${(innerWidth - W * k) / 2}px, ${(innerHeight - H * k) / 2}px) scale(${k})`
    }
    fit()
    addEventListener('resize', fit)

    render = (i, prev, animate) => {
      slides.forEach((s, j) => {
        const on = j === i
        s.classList.toggle('is-on', on)
        s.inert = !on
        s.setAttribute('aria-hidden', String(!on))
        clearTimeout(leaving.get(s))
        s.classList.toggle('is-leaving', j === prev && animate && !root.classList.contains('no-anim'))
      })
      const old = slides[prev]
      if (old?.classList.contains('is-leaving')) leaving.set(old, setTimeout(() => old.classList.remove('is-leaving'), 420))
      count.textContent = `${i + 1} / ${total}`
    }

    // 처음 그릴 때는 전환 없이
    const first = root.classList.contains('no-anim')
    root.classList.add('no-anim')
    go(fromHash(), { remote: true, animate: false })
    if (!first) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')))

    deck.addEventListener('click', (e) => {
      const b = e.target.closest('[data-to]')
      if (b) go(slides.findIndex((s) => s.dataset.section === b.dataset.to))
    })
    document.querySelector('.controls').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]')
      if (!b) return
      if (e.detail > 0) b.blur()
      const act = b.dataset.act
      if (act === 'prev') go(index - 1)
      else if (act === 'next') go(index + 1)
      else if (act === 'presenter') openPresenter()
      else if (act === 'full') toggleFull()
    })

    // 마우스를 움직이면 조작 단추를 보이고, 가만히 두면 단추와 커서를 숨긴다
    let idle = 0
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return
      root.classList.add('pointer')
      root.classList.remove('idle')
      clearTimeout(idle)
      idle = setTimeout(() => {
        root.classList.remove('pointer')
        if (document.fullscreenElement) root.classList.add('idle')
      }, 2500)
    })
  }

  // ---- 발표자 화면 ----
  function startPresenter() {
    document.title = `발표자 화면 · ${document.title}`
    const pv = document.createElement('div')
    pv.className = 'pv'
    pv.innerHTML = `
      <header class="pv-top">
        <span class="pv-brand">과목내비 발표자 화면</span>
        <span class="pv-count num"></span>
        <span class="pv-pace"></span>
        <span class="pv-timer num">0:00</span>
        <button type="button" class="btn btn-primary" data-act="timer">시작</button>
        <button type="button" class="btn" data-act="reset">처음부터</button>
        <a class="btn" href="?view=script" target="_blank" rel="noopener">대본</a>
      </header>
      <div class="pv-main">
        <div class="pv-notes note-body"></div>
        <div class="pv-side">
          <p class="pv-label">지금 장</p>
          <div data-slot="now"></div>
          <p class="pv-label">다음 장 <span class="pv-next-title"></span></p>
          <div class="pv-next" data-slot="next"></div>
          <div class="pv-nav">
            <button type="button" class="btn" data-act="prev">이전</button>
            <button type="button" class="btn btn-primary" data-act="next">다음</button>
          </div>
          <p class="pv-keys">← → 넘기기 · Home·End 처음·끝 · 숫자 + Enter 그 장으로<br />청중 화면(이 창을 연 창)도 같이 넘어가요.</p>
        </div>
      </div>`
    document.body.append(pv)
    const $ = (sel) => pv.querySelector(sel)
    const timerBtn = $('[data-act="timer"]')

    // 시간: 처음 넘길 때 저절로 시작한다
    let acc = 0
    let since = 0
    const elapsed = () => (acc + (since ? Date.now() - since : 0)) / 1000
    const start = () => {
      if (!since) since = Date.now()
    }
    const tick = () => {
      const t = elapsed()
      $('.pv-timer').textContent = clock(t)
      const due = upTo(index)
      const pace = $('.pv-pace')
      pace.textContent = `이 장 ${secOf(index)}초 · 여기까지 ${clock(due)} / 전체 ${clock(upTo(total - 1))}`
      pace.classList.toggle('is-late', !!(since || acc) && t > due + 10)
      timerBtn.textContent = since ? '멈춤' : acc ? '이어서' : '시작'
    }
    setInterval(tick, 500)

    const slot = (name, box) => {
      const el = $(`[data-slot="${name}"]`)
      for (const old of el.children) sizer.unobserve(old)
      el.replaceChildren(box)
    }
    render = (i, prev) => {
      $('.pv-count').textContent = `${i + 1} / ${total} · ${titleOf(i)}`
      slot('now', thumb(i))
      slot('next', thumb(i + 1))
      $('.pv-next-title').textContent = i + 1 < total ? `· ${i + 2}. ${titleOf(i + 1)}` : ''
      const notes = notesOf(i)
      const head = document.createElement('p')
      head.className = 'pv-notes-head'
      head.textContent = `${i + 1}. ${titleOf(i)} · 약 ${secOf(i)}초`
      $('.pv-notes').replaceChildren(head, ...[...(notes?.children || [])].map((n) => n.cloneNode(true)))
      $('.pv-notes').scrollTop = 0
      if (prev >= 0 && i > prev) start()
      tick()
    }
    pv.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]')
      if (!b) return
      if (e.detail > 0) b.blur()
      const act = b.dataset.act
      if (act === 'prev') go(index - 1)
      else if (act === 'next') go(index + 1)
      else if (act === 'timer') {
        if (since) {
          acc += Date.now() - since
          since = 0
        } else start()
        tick()
      } else if (act === 'reset') {
        acc = 0
        since = 0
        go(0)
        tick()
      }
    })
    go(fromHash(), { remote: true, animate: false })
    channel?.postMessage({ type: 'hello' })
  }

  // ---- 발표 대본 ----
  function startScript() {
    document.title = `발표 대본 · ${document.title}`
    const sv = document.createElement('div')
    sv.className = 'sv'
    sv.innerHTML = `
      <header class="sv-head">
        <p class="eyebrow">발표 대본</p>
        <h1></h1>
        <p class="sv-meta"></p>
        <div class="sv-actions">
          <a class="btn btn-primary" href="./">발표 화면</a>
          <a class="btn" href="?view=presenter">발표자 화면</a>
          <button type="button" class="btn" data-act="print">인쇄</button>
        </div>
      </header>
      <ol class="sv-list"></ol>`
    sv.querySelector('h1').textContent = document.querySelector('title').textContent.replace(/^발표 대본 · /, '')
    sv.querySelector('.sv-meta').textContent = `진로 독서 탐구 · 구현민 · ${total}장 · 예상 ${clock(upTo(total - 1))} (생략 가능 문장은 뺀 시간이에요. 다 읽으면 5분이 넘어요)`
    sv.querySelector('.sv-head').after(document.getElementById('script-before').content.cloneNode(true))
    const list = sv.querySelector('.sv-list')
    slides.forEach((_, i) => {
      const li = document.createElement('li')
      li.className = 'sv-item'
      const text = document.createElement('div')
      const h = document.createElement('h2')
      h.textContent = `${i + 1}. ${titleOf(i)}`
      const time = document.createElement('p')
      time.className = 'sv-time'
      time.textContent = `약 ${secOf(i)}초 · 여기까지 ${clock(upTo(i))}`
      const body = document.createElement('div')
      body.className = 'note-body'
      body.append(...[...(notesOf(i)?.children || [])].map((n) => n.cloneNode(true)))
      text.append(h, time, body)
      li.append(thumb(i), text)
      list.append(li)
    })
    list.after(document.getElementById('script-after').content.cloneNode(true))
    document.body.append(sv)
    sv.querySelector('[data-act="print"]').addEventListener('click', () => print())
  }

  if (view === 'presenter') startPresenter()
  else if (view === 'script') startScript()
  else startDeck()
})()
