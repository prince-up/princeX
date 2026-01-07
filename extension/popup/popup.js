document.addEventListener('DOMContentLoaded', async () => {
  const statusText = document.getElementById('statusText');
  const openAppBtn = document.getElementById('openApp');

  // Check extension status
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    if (response.activeSessions.length > 0) {
      statusText.textContent = `Active (${response.activeSessions.length} session${response.activeSessions.length > 1 ? 's' : ''})`;
    } else {
      statusText.textContent = 'Ready';
    }
  } catch (error) {
    statusText.textContent = 'Error';
    console.error('Status check failed:', error);
  }

  // Open PrinceX web app
  openAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  });
});
