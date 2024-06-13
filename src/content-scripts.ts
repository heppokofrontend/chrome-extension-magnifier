let scale = 100;
let setIntervalId = -1;
let running = false;
let pressed = false;
let zooming = false;
let isCursorScrollEnabled = false;
let wheelReverse = false;
let buttonNumber = 2;
const { container, scrollArea, contentArea, style, scaleField, closeBtn, resetBtn } = (() => {
  const commonCSS = `
    html,body {
      display:block;
      width: 100%;
      height: 100%;
    }
    html,body {
      overflow: hidden;
    }
    heppokofrontend-magnifier[data-id="container"] {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100vh;
    }
    heppokofrontend-magnifier[data-id="scroll-wrapper"] {
      display:block;
      overflow: auto;
    }
    heppokofrontend-magnifier[data-id="scroll-inner"] {
      display:block;
      transform: scale(1);
      transform-origin: left top;
      transition: 200ms transform linear, 200ms transform-origin linear;
    }
  `;
  const toolBarCSS = `
    :host {
      position: sticky!important;
      left: 0!important;
      top: 0!important;
      z-index: 2147483647!important;
      display: block!important;
    }

    * {
      all: unset;
      display: revert;
      font-size: inherit;
    }

    .container {
      --text: #000;
      --background: #dfdfdf;
      --result-text: #333;
      --result-border: #666;
      --result-background: #f1f1f1;

      font-size: 16px;
      padding: 0 8px 4px;
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--text);
      background: var(--background);
      border-bottom: 1px solid #000;
    }

    .wrap {
      display: flex;
      gap: 8px;
      flex-grow: 1;
      align-items: center;
      justify-content: space-between;
    }

    .primary {
      font-size: 14px;
    }

    .secondary {
      padding-top: 4px;
      font-size: 14px;
    }

    h2 {
      font-size: 11px;
      line-height: 1;
      padding: 4px 0;
    }

    #scale {
      padding: 2px 10px;
      color: var(--result-text);
      display: inline-block;
      min-width: 3em;
      text-align: center;
      background: var(--result-background);
      border: 1px solid var(--result-border);
      border-radius: 8px;
    }

    button {
      color: #111;
      border-radius: 6px;
      background: #42ccc0;
      padding: 4px 14px;
      font-size: 12px;
    }

    button:last-child {
      margin-left: 8px;
    }

    :focus-visible {
      outline: 2px solid #42ccc0;
      outline-offset: 2px;
    }

    @media (prefers-color-scheme: dark) {
      .container {
        --text: #999;
        --background: #292a2d;
        --result-text: #ddd;
        --result-background: #515254;
      }
    }
  `;

  const toolBar = (() => {
    const element = document.createElement('heppokofrontend-magnifier');
    element.dataset.id = 'toolBar';
    return element;
  })();
  const toolBarUISet = (() => {
    const inner = document.createElement('div');
    inner.insertAdjacentHTML(
      'afterbegin',
      `
      <div class="container">
        <div class="wrap">
          <div class="primary">
            <h2>${chrome.i18n.getMessage('extName')}</h2>
            <p>
              <span>${chrome.i18n.getMessage('toolbar_scale')}</span>
              <span id="scale" aria-live="assertive">100%</span>
            </p>
          </div>
          <p class="secondary">
            <button type="button" id="reset">
              ${chrome.i18n.getMessage('toolbar_reset')}
            </button><!--

            --><button type="button" id="close">
              ${chrome.i18n.getMessage('toolbar_exit')}
            </button>
          </p>
        </div>
      </div>
    `,
    );

    const root = toolBar.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(toolBarCSS);
    root.adoptedStyleSheets = [sheet];
    root.append(inner);

    return {
      scaleField: inner.querySelector('#scale')!,
      closeBtn: inner.querySelector('#close')!,
      resetBtn: inner.querySelector('#reset')!,
    };
  })();

  const contentArea = (() => {
    const element = document.createElement('heppokofrontend-magnifier');
    element.dataset.id = 'scroll-inner';
    return element;
  })();

  const scrollArea = (() => {
    const element = document.createElement('heppokofrontend-magnifier');
    element.dataset.id = 'scroll-wrapper';
    element.append(contentArea);
    return element;
  })();

  const container = (() => {
    const element = document.createElement('heppokofrontend-magnifier');
    element.dataset.id = 'container';
    element.append(toolBar);
    element.append(scrollArea);
    return element;
  })();

  return {
    ...toolBarUISet,
    container,
    scrollArea,
    contentArea,
    style: (() => {
      const element = document.createElement('style');
      element.dataset.from = 'chrome-extensiton';
      element.textContent = commonCSS;

      return element;
    })(),
  };
})();
const { activateMagnifier, scaleReset, closeMagnifier, contextmenuManager, toggleScrollMethod } =
  (() => {
    const zoom = (plus: number) => {
      if (isNaN(plus)) {
        scale = 100;
      } else {
        if (wheelReverse) {
          scale = 0 < plus ? scale + 10 : scale - 10;
        } else {
          scale = 0 < plus ? scale - 10 : scale + 10;
        }
      }

      scaleField.textContent = `${scale}%`;
      contentArea.style.transform = `scale(${scale / 100})`;

      if (scale < 100) {
        contentArea.style.transformOrigin = 'center top';
      } else {
        contentArea.style.transformOrigin = 'left top';
      }
    };
    const onMouseMove = ({ clientX, clientY }: MouseEvent) => {
      if (isCursorScrollEnabled) {
        return;
      }

      clearInterval(setIntervalId);
      const thresholdBlock30 = window.innerHeight * 0.3;
      const thresholdInline30 = window.innerWidth * 0.3;
      const thresholdBlock20 = window.innerHeight * 0.2;
      const thresholdInline20 = window.innerWidth * 0.2;
      const thresholdBlock10 = window.innerHeight * 0.1;
      const thresholdInline10 = window.innerWidth * 0.1;
      const thresholdBlock05 = window.innerHeight * 0.05;
      const thresholdInline05 = window.innerWidth * 0.05;
      const { innerWidth, innerHeight } = window;
      const scrollSpeedLv1 = 5;
      const scrollSpeedLv2 = 15;
      const scrollSpeedLv3 = 40;
      const scrollSpeedLv4 = 100;
      const scroll = () => {
        const scrollX = (() => {
          if (clientX < thresholdInline05) {
            return -scrollSpeedLv4;
          } else if (clientX > innerWidth - thresholdInline05) {
            return scrollSpeedLv4;
          } else {
            if (clientX < thresholdInline10) {
              return -scrollSpeedLv3;
            } else if (clientX > innerWidth - thresholdInline10) {
              return scrollSpeedLv3;
            } else {
              if (clientX < thresholdInline20) {
                return -scrollSpeedLv2;
              } else if (clientX > innerWidth - thresholdInline20) {
                return scrollSpeedLv2;
              } else {
                if (clientX < thresholdInline30) {
                  return -scrollSpeedLv1;
                } else if (clientX > innerWidth - thresholdInline30) {
                  return scrollSpeedLv1;
                }
              }
            }
          }

          return 0;
        })();
        const scrollY = (() => {
          if (clientY < thresholdBlock05) {
            return -scrollSpeedLv4;
          } else if (clientY > innerHeight - thresholdBlock05) {
            return scrollSpeedLv4;
          } else {
            if (clientY < thresholdBlock10) {
              return -scrollSpeedLv3;
            } else if (clientY > innerHeight - thresholdBlock10) {
              return scrollSpeedLv3;
            } else {
              if (clientY < thresholdBlock20) {
                return -scrollSpeedLv2;
              } else if (clientY > innerHeight - thresholdBlock20) {
                return scrollSpeedLv2;
              } else {
                if (clientY < thresholdBlock30) {
                  return -scrollSpeedLv1;
                } else if (clientY > innerHeight - thresholdBlock30) {
                  return scrollSpeedLv1;
                }
              }
            }
          }

          return 0;
        })();

        scrollArea.scrollBy(scrollX, scrollY);
      };

      scroll();
      setIntervalId = setInterval(scroll, 10);
    };
    const onMouseLeave = () => {
      clearInterval(setIntervalId);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === buttonNumber) {
        pressed = true;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === buttonNumber) {
        if (zooming) {
          e.preventDefault();
        }

        pressed = false;
        zooming = false;
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (pressed) {
        e.preventDefault();
        if (!zooming) {
          window.addEventListener('contextmenu', (e) => e.preventDefault(), { once: true });
        }

        zooming = true;
        zoom(e.deltaY);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '0') {
        if (e.metaKey || e.ctrlKey) {
          scaleReset();
        }
      }
    };

    return {
      activateMagnifier: () => {
        [...document.body.childNodes].forEach((node) => {
          contentArea.append(node);
        });

        document.head.append(style);
        document.body.append(container);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseleave', onMouseLeave);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('wheel', onWheel, {
          passive: false,
        });
        window.addEventListener('keydown', onKeyDown);

        running = true;
        chrome.runtime.sendMessage({ taskId: 'activate', isCursorScrollEnabled });
      },
      scaleReset: () => zoom(NaN),
      closeMagnifier: () => {
        const fragment = document.createDocumentFragment();

        [...contentArea.childNodes].forEach((node) => {
          fragment.append(node);
        });

        style.remove();
        container.replaceWith(fragment);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKeyDown);
        pressed = false;
        zooming = false;
        isCursorScrollEnabled = false;
        running = false;
        chrome.runtime.sendMessage({ taskId: 'close', isCursorScrollEnabled });
      },
      contextmenuManager: () => {
        chrome.runtime.sendMessage({ taskId: 'close', isCursorScrollEnabled });

        window.addEventListener('focus', () => {
          if (running) {
            chrome.runtime.sendMessage({ taskId: 'activate', isCursorScrollEnabled });
          } else {
            chrome.runtime.sendMessage({ taskId: 'close', isCursorScrollEnabled });
          }
        });
      },
      toggleScrollMethod: () => {
        isCursorScrollEnabled = !isCursorScrollEnabled;
        clearInterval(setIntervalId);
      },
    };
  })();

const init = () => {
  contextmenuManager();
  resetBtn.addEventListener('click', scaleReset);
  closeBtn.addEventListener('click', closeMagnifier);

  chrome.storage.local.get(['saveData'], ({ saveData }) => {
    if (typeof saveData === 'object') {
      wheelReverse = Boolean(saveData.wheelReverse);
      buttonNumber = Number(saveData.mouseButtonNumber);

      if (isNaN(buttonNumber)) {
        buttonNumber = 2;
      }
    }
  });

  chrome.runtime.onMessage.addListener(({ taskId }: { taskId: string }) => {
    switch (taskId) {
      case 'activate':
        activateMagnifier();
        break;
      case 'close':
        closeMagnifier();
        break;
      case 'toggleCursorScroll':
        toggleScrollMethod();
        break;
    }
  });
};

init();

window.addEventListener('focus', () => {
  chrome.storage.local.get(['saveData'], ({ saveData }) => {
    if (typeof saveData === 'object') {
      wheelReverse = Boolean(saveData.wheelReverse);
      buttonNumber = Number(saveData.mouseButtonNumber);

      if (isNaN(buttonNumber)) {
        buttonNumber = 2;
      }
    }
  });
});
