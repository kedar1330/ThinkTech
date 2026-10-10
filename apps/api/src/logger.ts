import pino, { type Logger } from 'pino';

// Structured JSON logs to stdout (D-17). Never log passwords, tokens, reset codes, cookies,
// Authorization headers or request bodies.
export function createLogger(destination?: pino.DestinationStream): Logger {
  return pino(
    {
      level: 'info',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.accessToken'],
        censor: '[redacted]',
      },
    },
    destination,
  );
}
