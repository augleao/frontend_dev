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
import RelatorioAtosConciliados from './components/RelatorioAtosConciliados';
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
import LegislacaoAdmin from './components/admin/LegislacaoAdmin';
import PromptsIAAdmin from './components/admin/PromptsIAAdmin';
import OnedriveConfig from './components/admin/OnedriveConfig';
import OnedriveOAuthCallback from './components/admin/OnedriveOAuthCallback';
import ProtocoloAcesso from './ProtocoloAcesso';
import AtosGratuitos from './AtosGratuitos';
import AverbacoesLista from './components/averbacoes/AverbacoesLista';
import AverbacaoManutencao from './components/averbacoes/AverbacaoManutencao';
import FerramentasIA from './FerramentasIA';
import AssistenteMandadosAverbacao from './components/ia/AssistenteMandadosAverbacao';
import LeituraLivros from './components/ia/LeituraLivros';
import ScrollToTop from './ScrollToTop';
import CertidoesGratuitasLista from './components/certidoes/CertidoesGratuitasLista';
import CertidaoGratuitaForm from './components/certidoes/CertidaoGratuitaForm';
import RelatoriosObrigatorios from './components/RelatoriosObrigatorios';
import Relatorios from './Relatorios';
import AnaliseDAP from './AnaliseDAP';



function App() {
  // ...existing code...
        <Route
          path="/relatorio-atos-conciliados"
          element={
            <PrivateRoute>
              <RelatorioAtosConciliados />
            </PrivateRoute>
          }
        />
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
      {/* Always scroll to top on route change to avoid new pages loading scrolled down */}
      <ScrollToTop />
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
  <Route path="/auth/onedrive/callback" element={<OnedriveOAuthCallback />} />
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
          path="/admin/legislacao"
          element={
            <AdminRoute>
              <LegislacaoAdmin />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/prompts-ia"
          element={
            <AdminRoute>
              <PromptsIAAdmin />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/onedrive"
          element={
            <AdminRoute>
              <OnedriveConfig />
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
        <Route path="/recibo/:protocolo" element={<ReciboPedido />} />
        <Route path="/protocolo" element={<ProtocoloAcesso />} />
        <Route
          path="/atos-gratuitos"
          element={
            <PrivateRoute>
              <AtosGratuitos />
            </PrivateRoute>
          }
        />
        <Route
          path="/averbacoes-gratuitas"
          element={
            <PrivateRoute>
              <AverbacoesLista />
            </PrivateRoute>
          }
        />
        <Route
          path="/averbacoes-gratuitas/nova"
          element={
            <PrivateRoute>
              <AverbacaoManutencao />
            </PrivateRoute>
          }
        />
        <Route
          path="/averbacoes-gratuitas/:id/editar"
          element={
            <PrivateRoute>
              <AverbacaoManutencao />
            </PrivateRoute>
          }
        />
        <Route
          path="/ferramentas-ia"
          element={
            <PrivateRoute>
              <FerramentasIA />
            </PrivateRoute>
          }
        />
        <Route
          path="/ferramentas-ia/assistente-mandados"
          element={
            <PrivateRoute>
              <AssistenteMandadosAverbacao />
            </PrivateRoute>
          }
        />
        <Route
          path="/ferramentas-ia/leitura-livros"
          element={
            <PrivateRoute>
              <LeituraLivros />
            </PrivateRoute>
          }
        />
        <Route
          path="/certidoes-gratuitas"
          element={
            <PrivateRoute>
              <CertidoesGratuitasLista />
            </PrivateRoute>
          }
        />
        <Route
          path="/certidoes-gratuitas/nova"
          element={
            <PrivateRoute>
              <CertidaoGratuitaForm />
            </PrivateRoute>
          }
        />
        <Route
          path="/certidoes-gratuitas/:id/editar"
          element={
            <PrivateRoute>
              <CertidaoGratuitaForm />
            </PrivateRoute>
          }
        />
        <Route
          path="/relatorios-obrigatorios"
          element={
            <PrivateRoute>
              <RelatoriosObrigatorios />
            </PrivateRoute>
          }
        />
        <Route
          path="/relatorios"
          element={
            <PrivateRoute>
              <Relatorios />
            </PrivateRoute>
          }
        />
        <Route
          path="/relatorios/dap"
          element={
            <PrivateRoute>
              <AnaliseDAP />
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;