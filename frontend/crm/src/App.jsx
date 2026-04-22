import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import ClientDetail from './ClientDetail'; // newly added import
import EntityView from './pages/EntityView'; // Update path if you put it in a pages folder
import Signup from './Signup';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if the user is already logged in when the app loads
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // Secure Route Wrapper: Redirects to login if not authenticated
  const ProtectedRoute = ({ children }) => {
    if (isLoading) return <div className="p-8 text-center">Loading...</div>;
    return isAuthenticated ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route 
          path="/login" 
          element={<Login setAuth={setIsAuthenticated} />} 
        />

        <Route path="/signup" element={<Signup />} />
        
        {/* Protected Dashboard Route */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Client Detail Route */}
        <Route 
          path="/client/:id" 
          element={
            <ProtectedRoute>
              <ClientDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/crm/:entityId" 
          element={
            <ProtectedRoute>
              <EntityView />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;