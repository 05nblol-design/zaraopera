import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';

// Providers personalizados
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { SocketProvider } from './hooks/useSocket';
import { NotificationProvider } from './contexts/NotificationContext';

import App from './App.jsx';
import './index.css';

// Configuração do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      retry: (failureCount, error) => {
        // Não tentar novamente para erros 4xx
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    }
  }
});

// Configuração do toast
const toastOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#1f2937',
    color: '#f9fafb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    padding: '12px 16px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  },
  success: {
    iconTheme: {
      primary: '#10b981',
      secondary: '#f9fafb'
    },
    style: {
      border: '1px solid #10b981'
    }
  },
  error: {
    iconTheme: {
      primary: '#ef4444',
      secondary: '#f9fafb'
    },
    style: {
      border: '1px solid #ef4444'
    }
  },
  loading: {
    iconTheme: {
      primary: '#3b82f6',
      secondary: '#f9fafb'
    },
    style: {
      border: '1px solid #3b82f6'
    }
  }
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }
    
    // In production, you might want to log this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-medium text-gray-900">
                  Ops! Algo deu errado
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Ocorreu um erro inesperado. Por favor, recarregue a página.
                </p>
                {import.meta.env.DEV && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">
                      Detalhes do erro (desenvolvimento)
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
                      {this.state.error.toString()}
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                <div className="mt-6">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Recarregar página
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance monitoring (development only)
if (import.meta.env.DEV) {
  // Log render times
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'measure') {
        console.log(`${entry.name}: ${entry.duration}ms`);
      }
    }
  });
  observer.observe({ entryTypes: ['measure'] });
}

// Initialize app
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ThemeProvider>
              <AuthProvider>
                <SocketProvider>
                  <NotificationProvider>
                    <App />
                    <Toaster 
                      position="top-right"
                      toastOptions={{
                        duration: 3000,
                        style: {
                          background: '#fff',
                          color: '#333',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500'
                        },
                        success: {
                          style: {
                            background: '#10b981',
                            color: '#fff',
                            border: '1px solid #059669'
                          }
                        },
                        error: {
                          style: {
                            background: '#ef4444',
                            color: '#fff',
                            border: '1px solid #dc2626'
                          }
                        },
                        loading: {
                          style: {
                            background: '#3b82f6',
                            color: '#fff',
                            border: '1px solid #2563eb'
                          }
                        }
                      }} 
                    />
                    {import.meta.env.DEV && (
                      <ReactQueryDevtools 
                        initialIsOpen={false} 
                        position="bottom-right"
                        toggleButtonProps={{
                          style: {
                            marginLeft: '5px',
                            transform: 'scale(0.8)',
                            transformOrigin: 'bottom right'
                          }
                        }}
                      />
                    )}
                  </NotificationProvider>
                </SocketProvider>
              </AuthProvider>
            </ThemeProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Hot Module Replacement (HMR) - Vite
if (import.meta.hot) {
  import.meta.hot.accept();
}

// Register service worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered: ', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available, show update notification
            if (window.confirm('Nova versão disponível! Deseja atualizar?')) {
              window.location.reload();
            }
          }
        });
      });
    } catch (registrationError) {
      console.log('SW registration failed: ', registrationError);
    }
  });
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // In production, you might want to send this to an error reporting service
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // In production, you might want to send this to an error reporting service
});