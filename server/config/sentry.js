const Sentry = require('@sentry/node');

const initSentry = (app) => {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend(event) {
        // Filtrar eventos sensíveis em produção
        if (process.env.NODE_ENV === 'production') {
          // Remover dados sensíveis
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers?.authorization;
          }
        }
        return event;
      }
    });

    // Middleware do Sentry
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    console.log('📊 Sentry inicializado para monitoramento');
  } else {
    console.log('⚠️ Sentry DSN não configurado, monitoramento desabilitado');
  }
};

const captureException = (error, context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        component: 'zara-server'
      },
      extra: context
    });
  }
  console.error('❌ Erro capturado:', error);
};

const captureMessage = (message, level = 'info', context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level, {
      tags: {
        component: 'zara-server'
      },
      extra: context
    });
  }
  console.log(`📝 Mensagem capturada [${level}]:`, message);
};

const errorHandler = () => {
  if (process.env.SENTRY_DSN) {
    return Sentry.Handlers.errorHandler();
  }
  return (err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    next(err);
  };
};

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  errorHandler
};