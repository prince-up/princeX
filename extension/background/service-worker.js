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

    // Handle different event types
    switch (eventType) {
      case 'mousemove':
        await handleMouseMove(target, data);
        break;
      
      case 'mouseclick':
      case 'mousedown':
      case 'mouseup':
        await handleMouseEvent(target, eventType, data);
        break;
      
      case 'wheel':
        await handleWheelEvent(target, data);
        break;
      
      case 'keydown':
      case 'keyup':
        await handleKeyboardEvent(target, eventType, data);
        break;
    }

  } catch (error) {
    console.error('[Service Worker] Debugger error:', error);
    if (error.message.includes("Already attached")) {
      attachedTargets.add(sender.tab.id);
    }
  }
}

/**
 * Handle mouse movement
 */
async function handleMouseMove(target, data) {
  const x = Math.floor(data.x * data.width);
  const y = Math.floor(data.y * data.height);

  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: x,
    y: y,
  });
}

/**
 * Handle mouse click/down/up events
 */
async function handleMouseEvent(target, eventType, data) {
  const x = Math.floor(data.x * data.width);
  const y = Math.floor(data.y * data.height);
  const button = data.button === 'left' ? 'left' : data.button === 'right' ? 'right' : 'middle';

  if (eventType === 'mouseclick') {
    // Press and release
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: x,
      y: y,
      button: button,
      clickCount: 1
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: x,
      y: y,
      button: button,
      clickCount: 1
    });
  } else if (eventType === 'mousedown') {
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: x,
      y: y,
      button: button,
      clickCount: 1
    });
  } else if (eventType === 'mouseup') {
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: x,
      y: y,
      button: button,
      clickCount: 1
    });
  }
}

/**
 * Handle wheel/scroll events
 */
async function handleWheelEvent(target, data) {
  const x = Math.floor(data.x * data.width);
  const y = Math.floor(data.y * data.height);

  await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: x,
    y: y,
    deltaX: data.deltaX,
    deltaY: data.deltaY,
  });
}

/**
 * Handle keyboard events
 */
async function handleKeyboardEvent(target, eventType, data) {
  const type = eventType === 'keydown' ? 'keyDown' : 'keyUp';
  
  // Build modifiers
  let modifiers = 0;
  if (data.altKey) modifiers |= 1;
  if (data.ctrlKey) modifiers |= 2;
  if (data.metaKey) modifiers |= 4;
  if (data.shiftKey) modifiers |= 8;

  // Map common keys to their codes
  const keyMap = {
    'Enter': 13,
    'Backspace': 8,
    'Tab': 9,
    'Escape': 27,
    'ArrowUp': 38,
    'ArrowDown': 40,
    'ArrowLeft': 37,
    'ArrowRight': 39,
    'Delete': 46,
    'Home': 36,
    'End': 35,
    'PageUp': 33,
    'PageDown': 34,
  };

  const windowsVirtualKeyCode = keyMap[data.key] || data.keyCode;

  await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
    type: type,
    modifiers: modifiers,
    windowsVirtualKeyCode: windowsVirtualKeyCode,
    code: data.code,
    key: data.key,
    text: eventType === 'keydown' && data.key.length === 1 ? data.key : undefined,
  });
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
