/**
 * Winston Logger Configuration
 * Provides centralized logging for the entire application
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log seviyeleri ve renkleri
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
};

winston.addColors(logColors);

// Log formatı - Console için
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = '\n' + JSON.stringify(meta, null, 2);
        }
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

// Log formatı - File için (JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Logger instance oluştur
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // Combined log file (tüm loglar)
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            format: fileFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Error log file (sadece hatalar)
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Trading log file (işlem logları)
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/trading.log'),
            format: fileFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            tailable: true
        })
    ],
    
    // Hataları yakala
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/exceptions.log')
        })
    ],
    
    // Promise rejection'ları yakala
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/rejections.log')
        })
    ]
});

// Production'da debug logları kapalı
if (process.env.NODE_ENV === 'production') {
    logger.level = 'info';
}

// Helper metodlar
logger.trade = (message, data = {}) => {
    logger.info(`[TRADE] ${message}`, data);
};

logger.order = (message, data = {}) => {
    logger.info(`[ORDER] ${message}`, data);
};

logger.balance = (message, data = {}) => {
    logger.debug(`[BALANCE] ${message}`, data);
};

logger.websocket = (message, data = {}) => {
    logger.debug(`[WS] ${message}`, data);
};

logger.api = (message, data = {}) => {
    logger.debug(`[API] ${message}`, data);
};

logger.profit = (message, data = {}) => {
    logger.info(`[PROFIT] ${message}`, data);
};

// Startup log
logger.info('📝 Logger sistemi başlatıldı', {
    level: logger.level,
    environment: process.env.NODE_ENV || 'development'
});

export default logger;
