// src/utils/errors.js

/**
 * Base application error class
 */
class AppError extends Error {
    constructor(message, isOperational = false) {
        super(message);
        this.name = this.constructor.name;
        this.isOperational = isOperational; // Errors that are expected (e.g., API errors) vs. programmer errors
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Represents an error from an external API
 */
class APIError extends AppError {
    constructor(message, statusCode = 500, exchange = 'unknown') {
        super(message, true);
        this.statusCode = statusCode;
        this.exchange = exchange;
    }
}

/**
 * Represents a WebSocket connection or message error
 */
class WebSocketError extends AppError {
    constructor(message, exchange = 'unknown') {
        super(message, true);
        this.exchange = exchange;
    }
}

/**
 * Represents a configuration or validation error
 */
class ValidationError extends AppError {
    constructor(message) {
        super(message, true);
    }
}

export { AppError, APIError, WebSocketError, ValidationError };
