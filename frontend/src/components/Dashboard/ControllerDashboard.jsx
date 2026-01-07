import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../../contexts/AuthContext';
import { sessionAPI, trustAPI } from '../../services/api';

const ControllerDashboard = () => {
  const { user, device, logout } = useAuth();
  const [availableDevices, setAvailableDevices] = useState([]);
  const [sessionToken, setSessionToken] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadAvailableDevices();

    // Auto-join if token in URL (from QR scan)
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl && device) {
      setSessionToken(tokenFromUrl);
      joinByTokenDirect(tokenFromUrl);
    }
  }, [device]);

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(handleScan, handleError);

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [isScanning]);

  const joinByTokenDirect = async (token) => {
    try {
      const response = await sessionAPI.join({
        sessionToken: token,
        deviceId: device._id,
      });
      navigate(`/session/${response.data.session.id}`, { state: { role: 'controller' } });
    } catch (error) {
      alert('Failed to join session: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const loadAvailableDevices = async () => {
    try {
      const response = await trustAPI.getAvailableDevices();
      setAvailableDevices(response.data.availableDevices);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const joinByToken = async (e) => {
    e.preventDefault();
    try {
      const response = await sessionAPI.join({
        sessionToken,
        deviceId: device._id,
      });
      navigate(`/session/${response.data.session.id}`, { state: { role: 'controller' } });
    } catch (error) {
      alert('Failed to join session: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const handleScan = (decodedText) => {
    if (decodedText) {
      console.log('Scanned:', decodedText);
      try {
        const url = new URL(decodedText);
        const token = url.searchParams.get('token');
        if (token) {
          setSessionToken(token);
          // Auto-join
          joinByTokenDirect(token);
        } else {
          setSessionToken(decodedText);
        }
      } catch (e) {
        setSessionToken(decodedText);
      }
      setIsScanning(false);
    }
  };

  const handleError = (err) => {
    // console.warn(err); // html5-qrcode scans continuously and errors frequently if no code found, ignore
  };

  const connectToPermanent = async (ownerDeviceId) => {
    try {
      const response = await sessionAPI.connectPermanent({
        ownerDeviceId,
        deviceId: device._id,
      });
      navigate(`/session/${response.data.session.id}`, { state: { role: 'controller' } });
    } catch (error) {
      alert('Failed to connect: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PrinceX Controller</h1>
            <p className="text-sm text-gray-600">Logged in as {user?.email}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/owner')}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Owner View
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

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Join by QR/Token */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Join Session</h2>
            <button
              onClick={() => setIsScanning(!isScanning)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium"
            >
              {isScanning ? 'Close Scanner' : 'Scan QR Code'}
            </button>
          </div>

          {isScanning && (
            <div className="mb-6 bg-white rounded-lg overflow-hidden flex justify-center">
              <div id="reader" style={{ width: '100%', maxWidth: '500px' }}></div>
            </div>
          )}

          <form onSubmit={joinByToken} className="flex gap-2">
            <input
              type="text"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              placeholder="Enter session token or scan QR"
              className="flex-1 px-4 py-2 border rounded-lg"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
            >
              Join
            </button>
          </form>
        </div>

        {/* Available Devices */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Available Devices</h2>
          {availableDevices.length === 0 ? (
            <p className="text-gray-500">No devices available. Ask an owner to trust your email ({user?.email}).</p>
          ) : (
            <div className="space-y-4">
              {availableDevices.map((item) => (
                <div key={item.device._id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{item.device.deviceName}</p>
                    <p className="text-sm text-gray-600">
                      Owner: {item.owner?.fullName || item.owner?.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last active: {new Date(item.device.lastActive).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => connectToPermanent(item.device._id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Connect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControllerDashboard;
