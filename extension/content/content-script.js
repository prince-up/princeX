// Content script for PrinceX - bridges webpage and extension

console.log('[PrinceX] Content script loaded');

// Listen for messages from webpage
window.addEventListener('message', async (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;

  const { type, sessionId } = event.data;

  if (type === 'PRINCEX_CHECK') {
    // Respond that extension is installed
    window.postMessage({ type: 'PRINCEX_INSTALLED', installed: true }, '*');
  }

  if (type === 'PRINCEX_START_CAPTURE') {
    try {
      // Forward to background script
      const response = await chrome.runtime.sendMessage({
        type: 'START_CAPTURE',
        sessionId,
      });

      if (response.error) {
        window.postMessage({
          type: 'PRINCEX_ERROR',
          error: response.error,
        }, '*');
      }
    } catch (error) {
      console.error('[PrinceX] Capture request failed:', error);
      window.postMessage({
        type: 'PRINCEX_ERROR',
        error: error.message,
      }, '*');
    }
  }

  if (type === 'PRINCEX_STOP_CAPTURE') {
    chrome.runtime.sendMessage({
      type: 'STOP_CAPTURE',
      sessionId,
    });
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CAPTURE_STARTED') {
    // Forward stream ID to webpage
    window.postMessage({
      type: 'PRINCEX_STREAM_ID',
      streamId: request.streamId,
      sessionId: request.sessionId,
    }, '*');
  }

  if (request.type === 'CAPTURE_STOPPED') {
    window.postMessage({
      type: 'PRINCEX_CAPTURE_STOPPED',
      sessionId: request.sessionId,
    }, '*');
  }

  sendResponse({ received: true });
});

// Handle control events (mouse/keyboard) - Limited browser scope
// Handle control events (mouse/keyboard)
window.addEventListener('message', (event) => {
  if (event.data.type === 'PRINCEX_CONTROL_EVENT') {
    const { eventType, data } = event.data;

    // Forward to background for Debugger API execution
    chrome.runtime.sendMessage({
      type: 'SIMULATE_INPUT',
      data: {
        eventType,
        data
      }
    });
  }
});

console.log('[PrinceX] Content script ready');
