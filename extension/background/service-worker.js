// Background service worker for PrinceX extension

let activeCaptureSessions = new Map();
let attachedTargets = new Set();

// Listen for messages from content script/webpage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // console.log('[Service Worker] Received message:', request);

  if (request.type === 'START_CAPTURE') {
    handleStartCapture(request, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.type === 'STOP_CAPTURE') {
    handleStopCapture(request.sessionId);
    sendResponse({ success: true });
  }

  if (request.type === 'SIMULATE_INPUT') {
    handleSimulateInput(request, sender);
    sendResponse({ success: true });
  }

  if (request.type === 'GET_STATUS') {
    sendResponse({
      isInstalled: true,
      activeSessions: Array.from(activeCaptureSessions.keys()),
    });
  }
});

/**
 * Handle input simulation via Debugger API
 */
async function handleSimulateInput(request, sender) {
  const target = { tabId: sender.tab.id };
  const { eventType, data } = request.data;

  try {
    // Ensure debugger is attached
    if (!attachedTargets.has(sender.tab.id)) {
      await chrome.debugger.attach(target, "1.3");
      attachedTargets.add(sender.tab.id);

      // Detach when tab closes
      chrome.tabs.onRemoved.addListener((tabId) => {
        if (tabId === sender.tab.id) {
          attachedTargets.delete(tabId);
        }
      });
    }

    if (eventType === 'mousemove') {
      // Convert normalized coordinates to integer coordinates
      // Note: This requires knowing the viewport size, which creates complexity.
      // For now, simpler approach: we might not support mousemove via debugger efficiently due to missing layout metrics here.
      // Focusing on Click which is more critical.
    }

    if (eventType === 'mouseclick') {
      const x = Math.floor(data.x * data.width);
      const y = Math.floor(data.y * data.height);

      await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: x,
        y: y,
        button: "left",
        clickCount: 1
      });

      setTimeout(async () => {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: x,
          y: y,
          button: "left",
          clickCount: 1
        });
      }, 50);
    }

    if (eventType === 'keypress') {
      // Basic character entry
      await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
        type: "char",
        text: data.key
      });
    }

  } catch (error) {
    console.error('[Service Worker] Debugger error:', error);
    // If attach failed (e.g. already attached), try to proceed or detach/reattach logic could go here
    if (error.message.includes("Already attached")) {
      attachedTargets.add(sender.tab.id); // Sync state just in case
    }
  }
}

/**
 * Handle screen capture request
 */
async function handleStartCapture(request, sender, sendResponse) {
  try {
    const { sessionId } = request;

    // Request screen capture
    chrome.desktopCapture.chooseDesktopMedia(
      ['screen', 'window', 'tab'],
      sender.tab,
      (streamId) => {
        if (!streamId) {
          sendResponse({ error: 'User cancelled screen sharing' });
          return;
        }

        // Store session
        activeCaptureSessions.set(sessionId, {
          streamId,
          tabId: sender.tab.id,
          startTime: Date.now(),
        });

        // Send stream ID back to webpage
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'CAPTURE_STARTED',
          streamId,
          sessionId,
        });

        sendResponse({ success: true, streamId });
      }
    );
  } catch (error) {
    console.error('[Service Worker] Capture error:', error);
    sendResponse({ error: error.message });
  }
}

/**
 * Stop screen capture
 */
function handleStopCapture(sessionId) {
  if (activeCaptureSessions.has(sessionId)) {
    const session = activeCaptureSessions.get(sessionId);

    // Detach debugger if attached
    if (attachedTargets.has(session.tabId)) {
      chrome.debugger.detach({ tabId: session.tabId }).catch(() => { });
      attachedTargets.delete(session.tabId);
    }

    // Notify content script to clean up
    chrome.tabs.sendMessage(session.tabId, {
      type: 'CAPTURE_STOPPED',
      sessionId,
    });

    activeCaptureSessions.delete(sessionId);
  }
}

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  activeCaptureSessions.forEach((session, sessionId) => {
    handleStopCapture(sessionId);
  });
});

console.log('[Service Worker] PrinceX extension loaded');
