import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import OwnerDashboard from './components/Dashboard/OwnerDashboard';
import ControllerDashboard from './components/Dashboard/ControllerDashboard';
import SessionView from './components/Session/SessionView';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/owner" element={
              <PrivateRoute>
                <OwnerDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/controller" element={
              <PrivateRoute>
                <ControllerDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/session/:sessionId" element={
              <PrivateRoute>
                <SessionView />
              </PrivateRoute>
            } />
            
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
