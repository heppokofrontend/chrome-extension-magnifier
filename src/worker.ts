const contextMenuId = 'heppokofrontend-magnifier';
const contextMenuIdClose = `${contextMenuId}-close`;
const contextMenuIdCursorScroll = `${contextMenuId}-cursor-scroll`;
const parentId = chrome.contextMenus.create({
  id: contextMenuId,
  title: chrome.i18n.getMessage('extName'),
  contexts: ['all'],
});

const remove = () => {
  chrome.contextMenus.remove(contextMenuIdClose, () => chrome.runtime.lastError);
  chrome.contextMenus.remove(contextMenuIdCursorScroll, () => chrome.runtime.lastError);
};

{
  let isCursorScrollEnabled = true;
  const scrollTitle = (isEnabled: boolean) =>
    [
      chrome.i18n.getMessage('context_scroll'),
      chrome.i18n.getMessage(isEnabled ? 'context_scroll_disabled' : 'context_scroll_enabled'),
    ].join('');

  chrome.runtime.onMessage.addListener((message, sender) => {
    isCursorScrollEnabled = !(message?.isCursorScrollEnabled === false);

    if (sender?.tab) {
      remove();

      if (message.taskId === 'activate') {
        chrome.contextMenus.create(
          {
            id: contextMenuIdCursorScroll,
            title: scrollTitle(isCursorScrollEnabled),
            contexts: ['all'],
            parentId,
          },
          () => chrome.runtime.lastError,
        );

        chrome.contextMenus.create(
          {
            id: contextMenuIdClose,
            title: chrome.i18n.getMessage('context_exit'),
            contexts: ['all'],
            parentId,
          },
          () => chrome.runtime.lastError,
        );
      }
    }
  });

  chrome.contextMenus.onClicked.addListener(
    ({ menuItemId }: chrome.contextMenus.OnClickData, tab) => {
      if (tab?.url?.startsWith('http') && typeof tab.id === 'number') {
        switch (menuItemId) {
          case contextMenuIdCursorScroll:
            isCursorScrollEnabled = !isCursorScrollEnabled;
            chrome.tabs.sendMessage(tab.id, { taskId: 'toggleCursorScroll' }).catch(console.log);

            break;

          case contextMenuIdClose:
            chrome.tabs.sendMessage(tab.id, { taskId: 'close' }).catch(console.log);
            remove();
            break;

          default:
            chrome.tabs.sendMessage(tab.id, { taskId: 'activate' }).catch(console.log);
        }

        chrome.contextMenus.update(
          contextMenuIdCursorScroll,
          {
            title: scrollTitle(isCursorScrollEnabled),
          },
          () => chrome.runtime.lastError,
        );
      }
    },
  );
}
