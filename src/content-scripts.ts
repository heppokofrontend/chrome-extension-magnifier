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

    heppokofrontend-magnifier[data-id="scroll-inner"][data-zooming="true"]::before{
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      z-index: 99999;
      background: red;
      opacity: 0;
      /* opacity: 0.1; */
      position: absolute;
      inset: 0;
      margin: auto;
    }

    heppokofrontend-magnifier[data-id="scroll-inner"] {
      display:block;
      transform: scale(1);
      transform-origin: left top;
    }

    #heppokofrontend-magnifier [data-sticky="true"] {
      position: relative!important;
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
      --result-border2: #ccc;
      --result-background: #f1f1f1;

      font-size: 16px;
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--text);
      background: var(--background);
      border-bottom: 1px solid var(--result-border);
    }

    .wrap {
      display: flex;
      padding: 0 8px 4px;
      gap: 8px;
      flex-grow: 1;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--result-border2);
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
      font-weight: bold;
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
        --result-border2: #000;
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
    element.id = 'heppokofrontend-magnifier';
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
    let locked = false;
    const zoom = (plus: number) => {
      if (locked) {
        return;
      }

      const diff = scale <= 90 ? 2 : 10;
      const cacheScale = scale;
      const zoomIn = () => {
        scale = scale + diff;

        if (scale === 92) {
          scale = 100;
        }
      };
      const zoomOut = () => {
        scale = scale - diff;
      };
      const inOrOut = 0 < plus ? 'in' : 'out';

      if (isNaN(plus)) {
        scale = 100;
      } else {
        switch (inOrOut) {
          case 'in':
            if (wheelReverse) {
              zoomIn();
            } else {
              zoomOut();
            }
            break;
          case 'out':
            if (wheelReverse) {
              zoomOut();
            } else {
              zoomIn();
            }
        }
      }

      [...scrollArea.querySelectorAll<HTMLElement>('*')]
        .filter((element) => {
          const computedStyle = window.getComputedStyle(element);
          return computedStyle.position === 'sticky';
        })
        .forEach((element) => {
          element.dataset.sticky = 'true';
        });

      if (scale < 100) {
        contentArea.style.transformOrigin = 'center top';
        contentArea.style.transform = `scale(${scale / 100})`;
        scrollArea.scrollBy({
          top: (scrollArea.offsetHeight * diff) / 100 / 2,
        });
      } else {
        const plusMinus = wheelReverse ? (inOrOut === 'in' ? 1 : -1) : inOrOut === 'in' ? -1 : 1;
        const top = ((scrollArea.offsetHeight * diff) / 100 / 2) * plusMinus;
        const left = ((scrollArea.offsetWidth * diff) / 100 / 2) * plusMinus;

        contentArea.style.transformOrigin = 'left top';
        contentArea.style.transform = `scale(${scale / 100})`;
        scrollArea.scrollBy({ top, left });
      }

      scaleField.textContent = `${scale}%`;

      if (scale === 100) {
        locked = true;
        setTimeout(() => {
          locked = false;
        }, 500);
      }
    };
    const { onMouseMove, onMouseLeave, onMouseDown, onMouseUp, onWheel, onKeyDown } = (() => {
      return {
        onMouseMove: ({ clientX, clientY }: MouseEvent) => {
          if (isCursorScrollEnabled || pressed) {
            return;
          }

          clearInterval(setIntervalId);
          const thresholdBlock30 = window.innerHeight * 0.2;
          const thresholdInline30 = window.innerWidth * 0.2;
          const thresholdBlock20 = window.innerHeight * 0.15;
          const thresholdInline20 = window.innerWidth * 0.15;
          const thresholdBlock10 = window.innerHeight * 0.1;
          const thresholdInline10 = window.innerWidth * 0.1;
          const thresholdBlock05 = window.innerHeight * 0.05;
          const thresholdInline05 = window.innerWidth * 0.05;
          const { innerWidth, innerHeight } = window;
          const scrollSpeedLv1 = 2;
          const scrollSpeedLv2 = 10;
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
        },
        onMouseLeave: () => {
          clearInterval(setIntervalId);
        },
        onMouseDown: (e: MouseEvent) => {
          if (e.button === buttonNumber) {
            pressed = true;
            contentArea.dataset.zooming = 'true';
            clearInterval(setIntervalId);
          }
        },
        onMouseUp: (e: MouseEvent) => {
          if (e.button === buttonNumber) {
            if (zooming) {
              e.preventDefault();
            }

            pressed = false;
            zooming = false;
            contentArea.dataset.zooming = 'false';
          }
        },
        onWheel: (e: WheelEvent) => {
          if (pressed) {
            e.preventDefault();
            if (!zooming) {
              window.addEventListener('contextmenu', (e) => e.preventDefault(), { once: true });
            }

            zooming = true;
            zoom(e.deltaY);
          }
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === '0') {
            if (e.metaKey || e.ctrlKey) {
              scaleReset();
            }
          }
        },
      };
    })();

    return {
      activateMagnifier: () => {
        const scrollTop =
          (document.scrollingElement?.scrollTop ?? 0) * (scale / 100) ||
          (window.innerHeight * (scale / 100)) / 2 - window.innerHeight / 2;
        const scrollLeft =
          (document.scrollingElement?.scrollLeft ?? 0) * (scale / 100) ||
          (window.innerWidth * (scale / 100)) / 2 - window.innerWidth / 2;

        [...document.body.childNodes].forEach((node) => {
          contentArea.append(node);
        });

        document.head.append(style);
        document.body.append(container);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseleave', onMouseLeave);
        document.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('wheel', onWheel, {
          passive: false,
        });
        window.addEventListener('keydown', onKeyDown);
        scrollArea.scroll({
          top: scrollTop,
          left: scrollLeft,
        });

        running = true;
        chrome.runtime.sendMessage({ taskId: 'activate', isCursorScrollEnabled });
      },
      scaleReset: () => zoom(NaN),
      closeMagnifier: () => {
        const scrollTop = scrollArea.scrollTop / (scale / 100);
        const scrollLeft = scrollArea.scrollLeft / (scale / 100);
        const fragment = document.createDocumentFragment();

        [...contentArea.childNodes].forEach((node) => {
          fragment.append(node);
        });

        style.remove();
        container.replaceWith(fragment);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onMouseLeave);
        document.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKeyDown);
        window.scroll({
          top: scrollTop,
          left: scrollLeft,
        });
        pressed = false;
        zooming = false;
        isCursorScrollEnabled = false;
        running = false;
        contentArea.dataset.zooming = 'false';
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
      case 'reset':
        scaleReset();
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
