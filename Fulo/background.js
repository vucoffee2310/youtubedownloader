chrome.action.onClicked.addListener(function(tab) {
  chrome.tabs.create({ url: "https://gemini.google.com/app" }, function(newTab) {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === newTab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          files: ["inject.js"]
        });
        chrome.scripting.insertCSS({
          target: { tabId: newTab.id },
          files: ["inject.css"]
        });
      }
    });
  });
});