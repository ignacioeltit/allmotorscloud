import winston from 'winston'

const level = process.env.LOG_LEVEL ?? 'info'

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      return `[${timestamp}] ${level}: ${message}${extras}`
    })
  ),
  transports: [new winston.transports.Console()],
})
