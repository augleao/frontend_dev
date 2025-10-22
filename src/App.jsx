import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
import UsuariosAdmin from './UsuariosAdmin';
import RenderBackupManager from './RenderBackupManager';
import AdminRoute from './AdminRoute';
import CaixaDiario from './CaixaDiario'; // ajuste o caminho se necessário
import ImportarAtos from './ImportarAtos'; // ajuste o caminho se necessário
import RelatorioCNJ from './RelatorioCNJ';
import MeusFechamentos from './RelatoriosCaixaDiario'; // ajuste o caminho se necessário
import AtosPraticados from './AtosPraticados'; // ajuste o caminho se necessário
import PesquisaAtosPraticados from './pesquisaAtosPraticados'; // ajuste o caminho se necessário
import ServicoManutencao from './components/servicos/ServicoManutencao'; // ajuste o caminho se necessário
import ListaServicos from './components/servicos/ServicoLista'; // adicione esta linha
import ReciboPedido from './ReciboPedido';
import EditarCombos from './components/admin/EditarCombos';
import ProtocoloAcesso from './ProtocoloAcesso';



function App() {
  // Fallback: se a URL vier com hash (ex.: /#/recibo/...), redireciona internamente
  function HashRedirector() {
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
      const h = window.location.hash || '';
      if (h.startsWith('#/')) {
        const target = h.slice(1);
        if (location.pathname !== target) {
          navigate(target, { replace: true });
        }
      }
      // não depende de location para evitar loop
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  return (
    <AuthProvider>
      <HashRedirector />
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* <Route path="/recibo" element={<ReciboBusca />} /> */}
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
         path="/pesquisa-atos-praticados"
         element={
           <PrivateRoute>
             <PesquisaAtosPraticados />
           </PrivateRoute>
         }
         />
        <Route
          path="/caixa-diario"
          element={
            <PrivateRoute>
              <CaixaDiario />
          </PrivateRoute>
         }
        />
        <Route
         path="/atos-praticados"
         element={
           <PrivateRoute>
             <AtosPraticados />
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
          path="/admin/usuarios"
          element={
            <AdminRoute>
              <UsuariosAdmin />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/backup"
          element={
            <AdminRoute>
              <RenderBackupManager />
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
        <Route
          path="/lista-servicos"
          element={
            <PrivateRoute>
              <ListaServicos />
            </PrivateRoute>
          }
        />
        <Route
          path="/manutencao-servicos"
          element={
            <PrivateRoute>
              <ServicoManutencao />
            </PrivateRoute>
          }
        />
        <Route
  path="/admin/editar-combos"
  element={
    <AdminRoute>
      <EditarCombos />
    </AdminRoute>
  }
/>
        <Route
          path="/recibo/:protocolo"
          element={
            <PrivateRoute>
              <ReciboPedido />
            </PrivateRoute>
          }
        />
        <Route path="/protocolo" element={<ProtocoloAcesso />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;