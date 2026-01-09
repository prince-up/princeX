import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { sessionAPI, trustAPI } from '../../services/api';
import socketService from '../../services/socket';
import { QRCodeSVG } from 'qrcode.react';

const OwnerDashboard = () => {
  const { user, device, logout } = useAuth();
  const [activeSessions, setActiveSessions] = useState([]);
  const [trustedEmails, setTrustedEmails] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQRData] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, trustRes] = await Promise.all([
        sessionAPI.getActive(),
        trustAPI.list(),
      ]);
      setActiveSessions(sessionsRes.data.sessions);
      setTrustedEmails(trustRes.data.trustedList);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const createInstantSession = async () => {
    try {
      console.log('Creating session with device:', device);
      const response = await sessionAPI.createInstant({
        deviceId: device._id,
        permissions: {
          viewOnly: false,
          mouseControl: true,
          keyboardControl: true,
        },
      });
      console.log('Session created:', response.data);

      const session = response.data.session;
      const sessionId = session._id || session.id;
      
      console.log('Session ID:', sessionId);

      // Show QR code first
      setQRData(session);
      setShowQR(true);

      // Connect to socket and join room
      socketService.connect();
      socketService.joinRoom(sessionId, 'owner');

      // Navigate immediately so owner can start sharing
      setTimeout(() => {
        navigate(`/session/${sessionId}`, { state: { autoStart: false, role: 'owner' } });
      }, 2000); // Give time to see QR code

    } catch (error) {
      console.error('Session creation error:', error);
      alert('Failed to create session: ' + (error.response?.data?.message || error.message));
    }
  };

  const addTrustedEmail = async (e) => {
    e.preventDefault();
    try {
      await trustAPI.add({
        controllerEmail: newEmail,
        deviceId: device._id,
      });
      setNewEmail('');
      loadData();
    } catch (error) {
      alert('Failed to add trusted email');
    }
  };

  const revokeTrust = async (trustId) => {
    if (confirm('Revoke access for this email?')) {
      try {
        await trustAPI.revoke(trustId);
        loadData();
      } catch (error) {
        alert('Failed to revoke access');
      }
    }
  };

  const endSession = async (sessionId) => {
    try {
      await sessionAPI.end(sessionId);
      loadData();
    } catch (error) {
      alert('Failed to end session');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PrinceX</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.fullName || user?.email}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/controller')}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Controller View
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Quick Action */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-4">Share Your Screen</h2>
          <button
            onClick={createInstantSession}
            className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100"
          >
            Generate QR Code
          </button>
        </div>

        {/* QR Modal */}
        {showQR && qrData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg max-w-md w-full">
              <h3 className="text-2xl font-bold mb-2 text-center">Scan to Control This PC</h3>
              <p className="text-sm text-gray-500 mb-4 text-center">Redirecting to session in 2 seconds...</p>
              <div className="flex justify-center mb-4 p-4 bg-gray-50 rounded-lg">
                <QRCodeSVG
                  value={`${window.location.origin}/controller?token=${qrData.sessionToken}`}
                  size={256}
                />
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg mb-4">
                <p className="text-xs text-gray-600 mb-1 font-semibold">Session Token:</p>
                <code className="bg-white px-3 py-2 rounded block text-center font-mono text-sm break-all">
                  {qrData.sessionToken}
                </code>
              </div>
              <p className="text-xs text-gray-500 mb-4 text-center">
                ⏱️ Expires: {new Date(qrData.expiresAt).toLocaleTimeString()}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const sessionId = qrData._id || qrData.id;
                    navigate(`/session/${sessionId}`, { state: { role: 'owner' } });
                  }}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  Go to Session Now
                </button>
                <button
                  onClick={() => setShowQR(false)}
                  className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Sessions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Active Sessions</h2>
            {activeSessions.length === 0 ? (
              <p className="text-gray-500">No active sessions</p>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <div key={session._id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{session.sessionType}</p>
                        <p className="text-sm text-gray-600">
                          {session.controllerId?.email || 'Waiting for controller'}
                        </p>
                      </div>
                      <button
                        onClick={() => endSession(session._id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        End
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Started: {new Date(session.startedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trusted Emails */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Trusted Access</h2>

            <form onSubmit={addTrustedEmail} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-2 border rounded-lg"
                  required
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            </form>

            {trustedEmails.length === 0 ? (
              <p className="text-gray-500">No trusted emails yet</p>
            ) : (
              <div className="space-y-3">
                {trustedEmails.map((trust) => (
                  <div key={trust._id} className="border rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{trust.controllerEmail}</p>
                      <p className="text-xs text-gray-500">
                        {trust.lastUsedAt ? `Last used: ${new Date(trust.lastUsedAt).toLocaleDateString()}` : 'Never used'}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeTrust(trust._id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
