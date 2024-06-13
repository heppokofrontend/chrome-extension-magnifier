const defaultSaveData = {
  mouseButtonNumber: '2',
  wheelReverse: false,
};

const STATE = {
  saveData: defaultSaveData,
};

const getMessage = (key: string) => chrome.i18n.getMessage(key) || key;
const isValidOptionType = (value: unknown): value is keyof SaveDataType => {
  if (typeof value !== 'string') {
    return false;
  }

  return value in defaultSaveData;
};

const checkboxes = document.querySelectorAll<HTMLInputElement>('[type="checkbox"]');
const editMouseButtonNumberField = document.getElementById('field')!;
const save = (newSaveData: SaveDataType) => {
  const value = {
    ...STATE.saveData,
    ...newSaveData,
  };

  STATE.saveData = value;

  for (const checkbox of checkboxes) {
    if (isValidOptionType(checkbox.dataset.optionType)) {
      const currentValue = value[checkbox.dataset.optionType];

      if (typeof currentValue === 'string') {
        checkbox.value = currentValue;
      } else {
        checkbox.checked = currentValue ?? false;
      }
    }
  }

  chrome.storage.local.set({
    saveData: value,
  });

  return value;
};

const setLanguage = () => {
  const targets = document.querySelectorAll<HTMLElement>('[data-i18n]');

  for (const elm of targets) {
    const { i18n } = elm.dataset;

    if (!i18n) {
      continue;
    }

    const textContent = getMessage(i18n);

    if (elm.tagName.toLocaleLowerCase() === 'h1') {
      elm.textContent = textContent.split('※').slice(0, 1).join(''); // JPタイトルに注釈テキストを表示しない
    } else {
      elm.textContent = textContent;
    }
  }
};

const loadSaveData = async () => {
  const getValue = <T>(key: string, callback: (items: Record<string, T | undefined>) => void) =>
    new Promise<void>((resolve) => {
      chrome.storage.local.get(key, (items) => {
        callback(items);
        resolve();
      });
    });

  return Promise.all([
    getValue<typeof defaultSaveData>('saveData', ({ saveData }) => {
      for (const [key, value] of Object.entries<boolean | string>(saveData ?? defaultSaveData)) {
        const checkbox = document.querySelector<HTMLInputElement>(`[data-option-type=${key}]`);

        if (typeof value === 'boolean' && checkbox) {
          checkbox.checked = value;
        }
      }

      STATE.saveData = saveData ?? defaultSaveData;
    }),
  ]);
};

const writeCustomMouseButton = (state: SaveDataType) => {
  const key = (() => {
    switch (state.mouseButtonNumber) {
      case '2':
        return chrome.i18n.getMessage('right_button');
      case '1':
        return chrome.i18n.getMessage('wheel_button');
      case '0':
        return chrome.i18n.getMessage('left_button');

      default:
        return `${chrome.i18n.getMessage('unknown_button_before')}${
          state.mouseButtonNumber
        }${chrome.i18n.getMessage('unknown_button_after')}`;
    }
  })();

  editMouseButtonNumberField.textContent = `${key}${chrome.i18n.getMessage('button_after')}`;
};
const addEvent = () => {
  for (const checkbox of checkboxes) {
    checkbox.addEventListener('change', () => {
      if (isValidOptionType(checkbox.dataset.optionType)) {
        const result = save({
          [checkbox.dataset.optionType]: checkbox.checked,
        });

        writeCustomMouseButton(result);
      }
    });
  }

  let isEditing = false;
  const update = (buttonNo: number) => {
    const state = save({
      mouseButtonNumber: String(buttonNo),
    });
    writeCustomMouseButton(state);
    setTimeout(() => {
      isEditing = false;
      editMouseButtonNumberField.removeEventListener('contextmenu', onContextmenu);
    }, 30);
  };
  const onContextmenu = (e: MouseEvent) => {
    e.preventDefault();
    update(e.button);
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();

    if (isEditing) {
      return;
    }

    isEditing = true;
    editMouseButtonNumberField.textContent = chrome.i18n.getMessage('editing');
    editMouseButtonNumberField.addEventListener('contextmenu', onContextmenu);
  };
  const onMouseUp = (e: MouseEvent) => {
    if (isEditing) {
      update(e.button);
    }
  };

  editMouseButtonNumberField.addEventListener('blur', () => {
    writeCustomMouseButton(STATE.saveData);
    isEditing = false;
    editMouseButtonNumberField.removeEventListener('contextmenu', onContextmenu);
  });
  editMouseButtonNumberField?.addEventListener('click', onClick);
  editMouseButtonNumberField?.addEventListener('mouseup', onMouseUp);
  editMouseButtonNumberField?.addEventListener('keydown', (e) => {
    if (isEditing && /\d/.test(e.key)) {
      update(Number(e.key));
    } else if (e.key === 'Enter') {
      editMouseButtonNumberField.click();
    }
  });
};

setLanguage();
loadSaveData().then(() => {
  writeCustomMouseButton(STATE.saveData);
  addEvent();
});

// CSS Transitionの有効化
setTimeout(() => {
  document.body.dataset.state = 'loaded';
}, 300);
