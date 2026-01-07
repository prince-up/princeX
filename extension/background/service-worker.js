// Background service worker for PrinceX extension

let activeCaptureSessions = new Map();

// Listen for messages from content script/webpage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Service Worker] Received message:', request);

  if (request.type === 'START_CAPTURE') {
    handleStartCapture(request, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.type === 'STOP_CAPTURE') {
    handleStopCapture(request.sessionId);
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
