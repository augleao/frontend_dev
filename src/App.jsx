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
import CaixaDiario from './CaixaDiario'; // ajuste o caminho se necessário
import ImportarAtos from './ImportarAtos'; // ajuste o caminho se necessário
import RelatorioCNJ from './RelatorioCNJ';
import MeusFechamentos from './RelatoriosCaixaDiario'; // ajuste o caminho se necessário


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
  // path="/atos-pagos"
  path="/caixa-diario"
 //path="/CaixaDiario"
  element={
    <PrivateRoute>
      <CaixaDiario />
    </PrivateRoute>
  }
/>
        <Route
          path="/relatorio-cnj"
          element={
            <PrivateRoute>
              <RelatorioCNJ />
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
        <Route
  path="/admin/importar-atos"
  element={
    <AdminRoute>
      <ImportarAtos />
    </AdminRoute>
  }
/>
        <Route
          path="/meus-fechamentos"
          element={<MeusFechamentos />}
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;