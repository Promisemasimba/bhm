require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,

  security: {
    serviceSecret: process.env.SERVICE_SECRET,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '1h',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  legacy: {
    scheme: process.env.BH_SCHEME,
    apiKey: process.env.BH_API_KEY,
    apiUrl: process.env.LEGACY_API_URL,
    soapEndpoint: process.env.LEGACY_SOAP_ENDPOINT,
    db: {
      host: process.env.LEGACY_DB_HOST,
      port: process.env.LEGACY_DB_PORT,
      database: process.env.LEGACY_DB_NAME,
      user: process.env.LEGACY_DB_USER,
      password: process.env.LEGACY_DB_PASSWORD,
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  cors: {
    origin: process.env.CORS_ORIGIN,
  },
};
