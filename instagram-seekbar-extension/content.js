(() => {
  'use strict';

  const OVERLAY_CLASS = 'igseek-overlay';
  const RANGE_CLASS = 'igseek-range';
  const attached = new WeakMap();
  const overlays = new Set();

  function isUsableVideo(video) {
    if (!video || !video.isConnected) return false;
    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 70) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return false;
    return Number.isFinite(video.duration) && video.duration > 0;
  }

  function updateBar(video, overlay, range, record) {
    if (!video.isConnected || !overlay.isConnected) {
      overlay.remove();
      if (record) overlays.delete(record);
      return;
    }

    const rect = video.getBoundingClientRect();
    const usable = isUsableVideo(video);
    overlay.style.display = usable ? 'block' : 'none';
    if (!usable) return;

    // Position the bar just inside the lower edge of the actual video element.
    const inset = Math.min(8, Math.max(0, rect.width * 0.015));
    overlay.style.left = `${Math.max(0, rect.left + inset)}px`;
    overlay.style.width = `${Math.max(40, rect.width - inset * 2)}px`;
    overlay.style.top = `${Math.min(window.innerHeight - 14, Math.max(0, rect.bottom - 13))}px`;

    if (!range.matches(':active')) {
      const progress = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1000, Math.max(0, (video.currentTime / video.duration) * 1000))
        : 0;
      range.value = String(progress);
      range.style.setProperty('--igseek-progress', `${progress / 10}%`);
    }
  }

  function attach(video) {
    if (!(video instanceof HTMLVideoElement) || attached.has(video)) return;

    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.setAttribute('aria-label', '動画のシークバー');

    const range = document.createElement('input');
    range.className = RANGE_CLASS;
    range.type = 'range';
    range.min = '0';
    range.max = '1000';
    range.step = '1';
    range.value = '0';
    range.setAttribute('aria-label', '動画の再生位置');
    range.title = 'ドラッグして再生位置を変更';

    // Keep seek interactions from triggering Instagram's surrounding click/drag handlers.
    for (const eventName of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend']) {
      overlay.addEventListener(eventName, event => event.stopPropagation());
    }

    range.addEventListener('input', event => {
      event.stopPropagation();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const targetTime = (Number(range.value) / 1000) * video.duration;
        try { video.currentTime = targetTime; } catch (_) { /* The stream may not be seekable at this moment. */ }
        range.style.setProperty('--igseek-progress', `${Number(range.value) / 10}%`);
      }
    });

    overlay.appendChild(range);
    document.documentElement.appendChild(overlay);
    const record = { video, overlay, range };
    overlays.add(record);
    attached.set(video, record);

    const refresh = () => updateBar(video, overlay, range, record);
    for (const eventName of ['loadedmetadata', 'durationchange', 'timeupdate', 'progress', 'seeking', 'seeked', 'play', 'pause']) {
      video.addEventListener(eventName, refresh, { passive: true });
    }
    refresh();
  }

  function scan() {
    document.querySelectorAll('video').forEach(attach);
  }

  function updateAll() {
    for (const record of Array.from(overlays)) {
      updateBar(record.video, record.overlay, record.range, record);
    }
  }

  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('scroll', updateAll, { passive: true });
  window.addEventListener('resize', updateAll, { passive: true });
  window.addEventListener('orientationchange', updateAll, { passive: true });

  // Keep overlays aligned with videos during scrolling, resizing, and animated layouts.
  let framePending = false;
  function scheduleUpdate() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      updateAll();
    });
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
})();
