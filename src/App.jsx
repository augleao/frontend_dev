import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import NavBar from './NavBar';
import Home from './Home';
import Login from './Login';
import Signup from './Signup';
import Conciliacao from './Conciliacao';
import PrivateRoute from './PrivateRoute';
import Home2 from './Home2';
import MeusRelatorios from './components/MeusRelatorios';
import AdminDashboard from './AdminDashboard';
import AdminRoute from './AdminRoute';
import AtosPagos from './AtosPagos'; // ajuste o caminho se necessário

function App() {
  return (
    <AuthProvider>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/conciliacao"
          element={
            <PrivateRoute>
              <Conciliacao />
            </PrivateRoute>
          }
        />
        <Route
          path="/home2"
          element={
            <PrivateRoute>
              <Home2 />
            </PrivateRoute>
          }
        />
        <Route
         path="/meus-relatorios"
         element={
           <PrivateRoute>
             <MeusRelatorios />
           </PrivateRoute>
         }
        />
        <Route
  path="/atos-pagos"
  element={
    <PrivateRoute>
      <AtosPagos />
    </PrivateRoute>
  }
/>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;