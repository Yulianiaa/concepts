// Intercom call screen.
// createIntercomScreen(mount, options) renders one phone screen.
//   options.state       'idle' | 'loading' | 'done'   — starting state
//   options.interactive true  — tapping «Открыть» plays idle → loading → done
//   options.lockOpen    true  — static «done» frame with the lock already open
//   options.entrance    title text, e.g. «Вход со двора»
//   options.photo       background image url
//   options.intro       true  — play the «incoming call» entrance when the screen appears

const TIMING = {
  loadingMs: 1800, // how long the orange circle shows the loader before success
};

const ICONS = {
  mic: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16.0006 4C16.7347 4 17.4616 4.14109 18.1398 4.4152C18.818 4.68932 19.4342 5.0911 19.9533 5.5976C20.4724 6.1041 20.8841 6.70541 21.1651 7.36718C21.446 8.02896 21.5906 8.73824 21.5906 9.45455V13.8182C21.5906 15.2648 21.0016 16.6522 19.9533 17.6751C18.905 18.6981 17.4831 19.2727 16.0006 19.2727C14.518 19.2727 13.0961 18.6981 12.0478 17.6751C10.9995 16.6522 10.4105 15.2648 10.4105 13.8182V9.45455C10.4105 8.00791 10.9995 6.62053 12.0478 5.5976C13.0961 4.57467 14.518 4 16.0006 4ZM6 14.9091H8.25278C8.52367 16.7252 9.45561 18.3855 10.8781 19.5861C12.3006 20.7868 14.1186 21.4475 15.9994 21.4475C17.8803 21.4475 19.6983 20.7868 21.1208 19.5861C22.5433 18.3855 23.4752 16.7252 23.7461 14.9091H26C25.7458 17.1222 24.7284 19.1854 23.1147 20.7602C21.5009 22.335 19.3866 23.328 17.1186 23.5764V28H14.8826V23.5764C12.6143 23.3283 10.4997 22.3354 8.88577 20.7605C7.27181 19.1857 6.25425 17.1224 6 14.9091Z" fill="currentColor"/></svg>',
  close: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.2094 16.0947L6.66675 8.55201L8.55208 6.66667L16.0947 14.2093L23.6374 6.66667L25.5227 8.55201L17.9801 16.0947L25.5227 23.6373L23.6374 25.5227L16.0947 17.98L8.55208 25.5227L6.66675 23.6373L14.2094 16.0947Z" fill="currentColor"/></svg>',
  // Same geometry as assets/icons/loading.svg; circles are separate so each can animate.
  loading: '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle class="loader-dot" cx="8" cy="18.67" r="1.33" fill="#fff" stroke="#fff" stroke-width="2.5"/><circle class="loader-dot" cx="16" cy="16" r="1.33" fill="#fff" stroke="#fff" stroke-width="2.5"/><circle class="loader-dot" cx="24" cy="13.33" r="1.33" fill="#fff" stroke="#fff" stroke-width="2.5"/></svg>',
  // Lock built from parts (body, keyhole, shackle) so the shackle can swing open.
  lock: '<svg class="lock" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" style="overflow:visible"><path class="lock__shackle" d="M12 13.3V9.33a4 4 0 0 1 8 0V13.3" fill="none" stroke="currentColor" stroke-width="2.67"/><rect x="6.67" y="13.33" width="18.67" height="14.67" rx="2.67" fill="currentColor"/><rect x="14.67" y="17.33" width="2.67" height="6.67" rx="1.33" fill="var(--color-success-bg)"/></svg>',
};

// iOS status bar (from the Figma iOS kit), time set to 13:00.
const STATUS_BAR = '<svg class="screen__statusbar" width="402" height="62" viewBox="0 0 402 62" fill="none" aria-hidden="true"><text x="74" y="38.7" text-anchor="middle" fill="white" style="font-family:-apple-system,\'SF Pro Text\',system-ui,sans-serif;font-size:17px;font-weight:600;letter-spacing:-0.4px">13:00</text><path fill-rule="evenodd" clip-rule="evenodd" d="M307.865 27.533C307.865 26.9 307.387 26.3868 306.798 26.3868H305.732C305.143 26.3868 304.665 26.9 304.665 27.533V37.467C304.665 38.1 305.143 38.6132 305.732 38.6132H306.798C307.387 38.6132 307.865 38.1 307.865 37.467V27.533ZM300.431 28.8321H301.498C302.087 28.8321 302.564 29.3576 302.564 30.0058V37.4395C302.564 38.0877 302.087 38.6132 301.498 38.6132H300.431C299.842 38.6132 299.364 38.0877 299.364 37.4395V30.0058C299.364 29.3576 299.842 28.8321 300.431 28.8321ZM296.099 31.4811H295.032C294.443 31.4811 293.966 32.0133 293.966 32.6698V37.4245C293.966 38.081 294.443 38.6132 295.032 38.6132H296.099C296.688 38.6132 297.166 38.081 297.166 37.4245V32.6698C297.166 32.0133 296.688 31.4811 296.099 31.4811ZM290.798 33.9264H289.732C289.143 33.9264 288.665 34.451 288.665 35.0981V37.4415C288.665 38.0886 289.143 38.6132 289.732 38.6132H290.798C291.387 38.6132 291.865 38.0886 291.865 37.4415V35.0981C291.865 34.451 291.387 33.9264 290.798 33.9264Z" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M323.437 28.8022C325.924 28.8023 328.316 29.7243 330.118 31.3778C330.254 31.5055 330.471 31.5039 330.605 31.3742L331.902 30.1107C331.97 30.045 332.007 29.9559 332.007 29.8632C332.006 29.7705 331.968 29.6819 331.899 29.6169C327.168 25.2422 319.704 25.2422 314.973 29.6169C314.905 29.6819 314.866 29.7705 314.865 29.8632C314.865 29.9558 314.902 30.0449 314.97 30.1107L316.268 31.3742C316.401 31.5041 316.619 31.5057 316.754 31.3778C318.557 29.7242 320.949 28.8022 323.437 28.8022ZM323.433 33.0224C324.791 33.0223 326.099 33.5341 327.106 34.4582C327.242 34.5894 327.456 34.5865 327.589 34.4518L328.876 33.1325C328.944 33.0633 328.981 32.9694 328.98 32.8719C328.979 32.7743 328.94 32.6812 328.871 32.6134C325.807 29.7226 321.062 29.7226 317.998 32.6134C317.929 32.6812 317.89 32.7744 317.889 32.8719C317.888 32.9695 317.926 33.0634 317.993 33.1325L319.28 34.4518C319.413 34.5865 319.627 34.5894 319.763 34.4582C320.769 33.5347 322.077 33.023 323.433 33.0224ZM325.958 35.816C325.96 35.9213 325.922 36.0229 325.855 36.0967L323.679 38.5514C323.615 38.6236 323.528 38.6642 323.437 38.6642C323.346 38.6642 323.259 38.6236 323.195 38.5514L321.018 36.0967C320.951 36.0229 320.914 35.9212 320.916 35.8159C320.918 35.7105 320.959 35.6108 321.029 35.5402C322.419 34.2263 324.455 34.2263 325.845 35.5402C325.915 35.6108 325.956 35.7106 325.958 35.816Z" fill="white"/><rect opacity="0.35" x="339.507" y="26.5" width="24" height="12" rx="3.8" stroke="white"/><path opacity="0.4" d="M365.007 30.5V34.5755C365.812 34.2303 366.335 33.4273 366.335 32.5377C366.335 31.6481 365.812 30.8452 365.007 30.5Z" fill="white"/><rect x="341.007" y="28" width="21" height="9" rx="2.5" fill="white"/></svg>';

const STATUS_TEXT = {
  idle: 'Звонок на домофон',
  loading: 'Звонок завершен',
  done: 'Звонок завершен',
};

// Plain script (not an ES module) so index.html also opens straight from disk.
window.createIntercomScreen = function createIntercomScreen(mount, options = {}) {
  const {
    state: initialState = 'idle',
    interactive = false,
    lockOpen = false,
    entrance = 'Вход со двора',
    photo = 'assets/bg-yard.jpg',
    intro = false,
  } = options;

  const root = document.createElement('div');
  root.className = 'screen' + (interactive ? '' : ' is-static') + (lockOpen ? ' lock-open' : '') + (intro ? ' has-intro' : '');
  root.innerHTML = `
    <img class="screen__photo" src="${photo}" alt="Кадр с камеры домофона">
    <div class="screen__gradient"></div>
    ${STATUS_BAR}
    <div class="header">
      <div class="header__status">
        <span class="header__dot" aria-hidden="true"></span>
        <span class="header__status-text"></span>
      </div>
      <h1 class="header__title"></h1>
    </div>
    <div class="controls">
      <button class="glass-btn glass-btn--left" type="button" aria-label="Ответить">${ICONS.mic}</button>
      <button class="open-btn" type="button" aria-label="Открыть дверь">
        <span class="open-btn__layer open-btn__layer--label">Открыть</span>
        <span class="open-btn__layer open-btn__layer--loading" aria-hidden="true">${ICONS.loading}</span>
        <span class="open-btn__layer open-btn__layer--done">${ICONS.lock}<span>Дверь открыта</span></span>
      </button>
      <button class="glass-btn glass-btn--right" type="button" aria-label="Отклонить">${ICONS.close}</button>
    </div>`;
  root.querySelector('.header__title').textContent = entrance;

  const controls = root.querySelector('.controls');
  const dot = root.querySelector('.header__dot');
  const statusText = root.querySelector('.header__status-text');
  const openBtn = root.querySelector('.open-btn');
  let state = initialState;
  let timer = null;

  function render() {
    controls.classList.remove('is-idle', 'is-loading', 'is-done');
    controls.classList.add('is-' + state);
    root.classList.toggle('is-done', state === 'done');
    const prevStatus = statusText.textContent;
    statusText.textContent = STATUS_TEXT[state];
    if (prevStatus && prevStatus !== STATUS_TEXT[state]) {
      // Restart the fade-in so the new status text appears smoothly.
      statusText.classList.remove('is-swapping');
      void statusText.offsetWidth;
      statusText.classList.add('is-swapping');
    }
    dot.hidden = state !== 'idle';
    openBtn.setAttribute('aria-label', state === 'done' ? 'Дверь открыта' : 'Открыть дверь');
  }

  if (interactive) {
    openBtn.addEventListener('click', () => {
      if (state === 'idle') {
        state = 'loading';
        render();
        timer = setTimeout(() => { state = 'done'; render(); }, TIMING.loadingMs);
      } else if (state === 'done') {
        // Demo only: tap the final pill to replay.
        clearTimeout(timer);
        state = 'idle';
        render();
      }
    });
  }

  render();
  mount.appendChild(root);
  return root;
};
