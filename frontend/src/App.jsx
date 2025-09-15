import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';

// Hooks personalizados
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useTheme } from '@/hooks/useTheme';

// Componentes de layout
import Layout from '@/components/layout/Layout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ToastContainer from '@/components/ui/ToastContainer';
import NotificationPopupContainer from '@/components/ui/NotificationPopupContainer';

// Páginas - Lazy loading para melhor performance
const LoginPage = React.lazy(() => import('@/pages/Login'));
const TestLoginPage = React.lazy(() => import('@/pages/TestLogin'));
const DashboardPage = React.lazy(() => import('@/pages/Dashboard'));
const OperatorMenuPage = React.lazy(() => import('@/pages/OperatorMenu'));
const LeaderDashboardPage = React.lazy(() => import('@/pages/LeaderDashboard'));
const ManagerDashboardPage = React.lazy(() => import('@/pages/ManagerDashboard'));
const MachinesPage = React.lazy(() => import('@/pages/Machines'));
const MachineNewPage = React.lazy(() => import('@/pages/MachineNew'));
const MachineDetailPage = React.lazy(() => import('@/pages/MachineDetail'));
const MachineOperationPage = React.lazy(() => import('@/pages/MachineOperation'));
const ProductionOperationPage = React.lazy(() => import('@/pages/ProductionOperationPage'));
const MachineConfigPage = React.lazy(() => import('@/pages/MachineConfig'));
const MachineStatusPage = React.lazy(() => import('@/pages/MachineStatus'));
const QualityTestsPage = React.lazy(() => import('@/pages/QualityTests'));
const QualityTestFormPage = React.lazy(() => import('./pages/QualityTestForm'));
const QualityTestDetailPage = React.lazy(() => import('@/pages/QualityTestDetail'));

const QualityTestPage = React.lazy(() => import('@/pages/QualityTest'));
const ReportsPage = React.lazy(() => import('@/pages/Reports'));
const NotificationsPage = React.lazy(() => import('@/pages/Notifications'));
const AdminNotificationsPage = React.lazy(() => import('@/pages/AdminNotifications'));
const NotificationDashboardPage = React.lazy(() => import('@/pages/NotificationDashboard'));
const SettingsPage = React.lazy(() => import('@/pages/Settings'));
const PersonalSettingsPage = React.lazy(() => import('@/pages/PersonalSettings'));
const TeflonPage = React.lazy(() => import('@/pages/Teflon'));
const TeflonChangePage = React.lazy(() => import('@/pages/TeflonChange'));
const TeflonDetailPage = React.lazy(() => import('@/pages/TeflonDetail'));
const UsersPage = React.lazy(() => import('@/pages/Users'));
const UserNewPage = React.lazy(() => import('@/pages/UserNew'));
const UserDetailPage = React.lazy(() => import('@/pages/UserDetail'));
const UserEditPage = React.lazy(() => import('@/pages/UserEdit'));
const PermissionsPage = React.lazy(() => import('@/pages/Permissions'));
const OperatorAssignmentPage = React.lazy(() => import('@/pages/OperatorAssignment'));
const ShiftManagement3x3Page = React.lazy(() => import('@/pages/ShiftManagement3x3'));
const ProfilePage = React.lazy(() => import('@/pages/Profile'));

// Componente 404
const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
        Página não encontrada
      </p>
      <a
        href="/"
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Voltar ao Dashboard
      </a>
    </div>
  </div>
);

// Componente de rota protegida
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    // Se requiredRole é um array, verificar se o usuário tem pelo menos uma das roles
    if (Array.isArray(requiredRole)) {
      const hasAnyRole = requiredRole.some(role => 
        user?.role === role || hasPermission(user?.role, role)
      );
      if (!hasAnyRole) {
        return <Navigate to="/dashboard" replace />;
      }
    } else {
      // Se é uma string, verificar role específica ou hierarquia
      if (user?.role !== requiredRole && !hasPermission(user?.role, requiredRole)) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return children;
};

// Função para verificar permissões
const hasPermission = (userRole, requiredRole) => {
  const roleHierarchy = {
    'ADMIN': 4,
    'MANAGER': 3,
    'LEADER': 2,
    'OPERATOR': 1
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Componente de rota pública (apenas para usuários não autenticados)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return children;
};

// Componente de loading para Suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-gray-600">Carregando página...</p>
    </div>
  </div>
);

// Animações de transição entre páginas
const pageVariants = {
  initial: {
    opacity: 0,
    x: -20
  },
  in: {
    opacity: 1,
    x: 0
  },
  out: {
    opacity: 0,
    x: 20
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3
};

// Componente wrapper para animações de página
const AnimatedPage = ({ children }) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
};

function App() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  
  // Inicializar Socket.IO para usuários autenticados
  useSocket();

  // Aplicar tema
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Configurar título da página baseado na rota
  const getPageTitle = (pathname) => {
    const routes = {
      '/': 'Dashboard',
      '/dashboard': 'Dashboard',
      '/operator-menu': 'Menu do Operador',
      '/leader-dashboard': 'Dashboard do Líder',
      '/machines': 'Máquinas',
      '/status': 'Status das Máquinas',
      '/quality': 'Testes de Qualidade',
      '/quality/tests': 'Testes de Qualidade',
      '/quality/new-test': 'Novo Teste de Qualidade',

      '/notifications': 'Notificações',
      '/notifications/dashboard': 'Dashboard de Notificações',
      '/notifications/admin': 'Administração de Notificações',
      '/reports': 'Relatórios',
      '/settings': 'Configurações',
      '/settings/personal': 'Configurações Pessoais',
      '/settings/system': 'Configurações do Sistema',
      '/login': 'Login'
    };
    
    // Para rotas dinâmicas
    if (pathname.startsWith('/quality/tests/')) {
      return 'Detalhes do Teste';
    }
    if (pathname.includes('/operation')) {
      return 'Operação de Máquinas';
    }
    
    return routes[pathname] || 'Sistema ZARA';
  };

  return (
    <ErrorBoundary>
      <Helmet>
        <title>{getPageTitle(location.pathname)} - Sistema ZARA</title>
        <meta name="description" content="Sistema ZARA - Controle de Qualidade e Operações Industriais" />
      </Helmet>

      <div className="App min-h-screen bg-gray-50">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Rota pública - Login */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Suspense fallback={<PageLoader />}>
                    <AnimatedPage>
                      <LoginPage />
                    </AnimatedPage>
                  </Suspense>
                </PublicRoute>
              }
            />
            
            {/* Rota de teste - Login */}
            <Route
              path="/test-login"
              element={
                <PublicRoute>
                  <Suspense fallback={<PageLoader />}>
                    <AnimatedPage>
                      <TestLoginPage />
                    </AnimatedPage>
                  </Suspense>
                </PublicRoute>
              }
            />

            {/* Rotas protegidas */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* Dashboard */}
                        <Route
                          path="/"
                          element={
                            <AnimatedPage>
                              <DashboardPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/dashboard"
                          element={
                            <AnimatedPage>
                              <DashboardPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/operator-menu"
                          element={
                            <AnimatedPage>
                              <OperatorMenuPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/leader-dashboard"
                          element={
                            <AnimatedPage>
                              <LeaderDashboardPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/manager-dashboard"
                          element={
                            <AnimatedPage>
                              <ManagerDashboardPage />
                            </AnimatedPage>
                          }
                        />

                        {/* Máquinas */}
                        <Route
                          path="/machines"
                          element={
                            <AnimatedPage>
                              <MachinesPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/machines/new"
                          element={
                            <ProtectedRoute requiredRole="MANAGER">
                              <AnimatedPage>
                                <MachineNewPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/machines/:id"
                          element={
                            <AnimatedPage>
                              <MachineDetailPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/machines/:id/config"
                          element={
                            <ProtectedRoute requiredRole="MANAGER">
                              <AnimatedPage>
                                <MachineConfigPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/machines/operation"
                          element={
                            <ProtectedRoute requiredRole="OPERATOR">
                              <AnimatedPage>
                                <MachineOperationPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/machines/:machineId/operation"
                          element={
                            <ProtectedRoute requiredRole="OPERATOR">
                              <AnimatedPage>
                                <ProductionOperationPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />

                        {/* Status Individual da Máquina */}
                        <Route
                          path="/machines/:id/status"
                          element={
                            <AnimatedPage>
                              <MachineStatusPage />
                            </AnimatedPage>
                          }
                        />

                        {/* Testes de Qualidade */}
                        <Route
                          path="/quality"
                          element={
                            <AnimatedPage>
                              <QualityTestsPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/quality/tests"
                          element={
                            <AnimatedPage>
                              <QualityTestsPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/quality/tests/:id"
                          element={
                            <AnimatedPage>
                              <QualityTestDetailPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/quality/:id/edit"
                          element={
                            <AnimatedPage>
                              <QualityTestFormPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/quality/new-test"
                          element={
                            <AnimatedPage>
                              <QualityTestFormPage />
                            </AnimatedPage>
                          }
                        />

                        <Route
                          path="/quality/test/:machineId"
                          element={
                            <AnimatedPage>
                              <QualityTestPage />
                            </AnimatedPage>
                          }
                        />

                        {/* Notificações */}
                        <Route
                          path="/notifications"
                          element={
                            <AnimatedPage>
                              <NotificationsPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/notifications/dashboard"
                          element={
                            <AnimatedPage>
                              <NotificationDashboardPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/notifications/admin"
                          element={
                            <ProtectedRoute requiredRole={['ADMIN', 'MANAGER']}>
                              <AnimatedPage>
                                <AdminNotificationsPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />

                        {/* Relatórios */}
                        <Route
                          path="/reports"
                          element={
                            <AnimatedPage>
                              <ReportsPage />
                            </AnimatedPage>
                          }
                        />

                        {/* Configurações */}
                        <Route
                          path="/settings"
                          element={
                            <AnimatedPage>
                              <SettingsPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/settings/personal"
                          element={
                            <AnimatedPage>
                              <PersonalSettingsPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/settings/system"
                          element={
                            <ProtectedRoute requiredRole="ADMIN">
                              <AnimatedPage>
                                <SettingsPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />

                        {/* Teflon */}
                        <Route
                          path="/teflon"
                          element={
                            <AnimatedPage>
                              <TeflonPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/teflon/change"
                          element={
                            <AnimatedPage>
                              <TeflonChangePage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/teflon/:id"
                          element={
                            <AnimatedPage>
                              <TeflonDetailPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/teflon/history"
                          element={
                            <AnimatedPage>
                              <TeflonPage />
                            </AnimatedPage>
                          }
                        />

                        {/* Usuários */}
                        <Route
                          path="/users"
                          element={
                            <AnimatedPage>
                              <UsersPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/users/new"
                          element={
                            <AnimatedPage>
                              <UserNewPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/users/:id"
                          element={
                            <AnimatedPage>
                              <UserDetailPage />
                            </AnimatedPage>
                          }
                        />
                        <Route
                          path="/users/:id/edit"
                          element={
                            <AnimatedPage>
                              <UserEditPage />
                            </AnimatedPage>
                          }
                        />

                        {/* Permissões */}
                        <Route
                          path="/permissions"
                          element={
                            <ProtectedRoute requiredRole={['MANAGER', 'ADMIN']}>
                              <AnimatedPage>
                                <PermissionsPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />

                        {/* Atribuição de Operadores */}
                        <Route
                          path="/operator-assignment"
                          element={
                            <ProtectedRoute requiredRole={['MANAGER', 'ADMIN']}>
                              <AnimatedPage>
                                <OperatorAssignmentPage />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />

                        {/* Sistema de Turnos 3x3 */}
                        <Route
                          path="/shifts-3x3"
                          element={
                            <ProtectedRoute requiredRole={['MANAGER', 'ADMIN']}>
                              <AnimatedPage>
                                <ShiftManagement3x3Page />
                              </AnimatedPage>
                            </ProtectedRoute>
                          }
                        />

                        {/* Perfil */}
                        <Route
                          path="/profile"
                          element={
                            <AnimatedPage>
                              <ProfilePage />
                            </AnimatedPage>
                          }
                        />

                        {/* 404 - Página não encontrada */}
                        <Route
                          path="*"
                          element={
                            <AnimatedPage>
                              <NotFoundPage />
                            </AnimatedPage>
                          }
                        />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AnimatePresence>
        
        {/* Container de Toasts para notificações em tempo real */}
        <ToastContainer />
        
        {/* Container de Pop-ups para notificações importantes */}
        <NotificationPopupContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;