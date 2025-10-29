/**
 * Binance Exchange Client
 * REST API implementation for Spot trading
 */

import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';
import WebSocket from 'ws';
import logger from '../utils/logger.js';

class BinanceClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.baseURL = config.baseURL || 'https://api.binance.com';

        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 50; // 1200 req/min = ~50ms interval

        this.serverTimeOffset = 0;
        this.lastTimeSyncTime = 0;
        this.timeSyncInterval = 60000;

        // Task 4.3: WebSocket Robustness
        this.ws = null;
        this.priceCallback = null;
        this.isManualClose = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.websocket?.maxReconnectAttempts || 10;
        this.initialReconnectDelay = config.websocket?.reconnectDelay || 5000;
        this.lastMessageTimestamp = null;
        this.healthCheckInterval = null;
        this.staleConnectionThreshold = 60000; // 60 saniye

        this.xrpPrecision = {
            stepSize: 0.1,
            minQty: 0.1,
            maxQty: 9222449.0,
            lastUpdate: null
        };
    }

    /**
     * HMAC SHA256 imza oluşturma
     */
    generateSignature(queryString) {
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }

    /**
     * ✅ DÜZELTME: Binance server time ile senkronize timestamp
     */
    async getTimestamp() {
        // Server time sync gerekli mi?
        const now = Date.now();
        if (now - this.lastTimeSyncTime > this.timeSyncInterval) {
            await this.syncServerTime();
        }

        // Offset'i uygula
        return Date.now() - this.serverTimeOffset;
    }

    /**
     * ✅ YENİ: Binance server time'ı çek ve offset hesapla
     */
    async syncServerTime() {
        try {
            const startTime = Date.now();
            const response = await this.makeRequestDirect('GET', '/api/v3/time', {}, false);
            const endTime = Date.now();

            const serverTime = response.serverTime;
            const localTime = Math.floor((startTime + endTime) / 2); // RTT kompansasyonu

            this.serverTimeOffset = localTime - serverTime;
            this.lastTimeSyncTime = Date.now();

            logger.info('🕐 Binance server time senkronize edildi', {
                offset: this.serverTimeOffset + 'ms',
                serverTime: new Date(serverTime).toISOString(),
                localTime: new Date(localTime).toISOString()
            });
        } catch (error) {
            logger.warn('⚠️  Server time sync başarısız, local time kullanılıyor', {
                error: error.message
            });
            // Hata durumunda offset'i sıfırla
            this.serverTimeOffset = 0;
        }
    }

    /**
     * Query string oluşturma
     */
    buildQueryString(params) {
        return Object.keys(params)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');
    }

    /**
     * Rate-limited API request
     */
    async makeRequest(method, endpoint, params = {}, signed = false) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ method, endpoint, params, signed, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * ✅ YENİ: Direkt istek (queue'suz, server time sync için)
     */
    async makeRequestDirect(method, endpoint, params = {}, signed = false) {
        return this.executeRequest(method, endpoint, params, signed);
    }

    /**
     * Process request queue with rate limiting
     */
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const timeSinceLastRequest = Date.now() - this.lastRequestTime;
            if (timeSinceLastRequest < this.minRequestInterval) {
                await this.sleep(this.minRequestInterval - timeSinceLastRequest);
            }

            const { method, endpoint, params, signed, resolve, reject } = this.requestQueue.shift();
            
            try {
                const result = await this.executeRequest(method, endpoint, params, signed);
                this.lastRequestTime = Date.now();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Execute HTTP request with native HTTPS
     */
    async executeRequest(method, endpoint, params = {}, signed = false) {
        // Config'den ayarları al
        const enableRetry = this.rateLimit?.enableRetry ?? true;
        const maxRetries = this.rateLimit?.maxRetries || 3;
        const initialDelay = this.rateLimit?.retryDelay || 1000;

        // Eğer yeniden deneme mekanizması aktif değilse, direkt isteği yap
        if (!enableRetry) {
            return this.performRequest(method, endpoint, params, signed);
        }

        // Yeniden deneme mekanizması aktifse, döngü içinde isteği yap
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.performRequest(method, endpoint, params, signed, attempt > 0);
            } catch (error) {
                const isRateLimitError = error.response?.status === 429 || error.response?.status === 418 || error.response?.data?.code === -1003;
                const isTimeoutError = error.code === 'ETIMEDOUT';
                const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ENOTFOUND';

                if ((isRateLimitError || isTimeoutError || isNetworkError) && attempt < maxRetries) {
                    const delay = initialDelay * (2 ** attempt);
                    let reason = 'Binance API request failed';
                    if (isTimeoutError) reason = 'Binance connection timed out';
                    if (isRateLimitError) reason = 'Binance rate limit hit';
                    if (isNetworkError) reason = 'Binance network error';

                    logger.warn(`${reason} (Attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`, {
                        error: error.message,
                        code: error.response?.data?.code,
                        status: error.response?.status
                    });
                    await this.sleep(delay);
                    continue; // Retry
                }

                logger.error(`Binance API Error after all retries: ${method} ${endpoint}`, {
                    status: error.response?.status,
                    message: error.response?.data?.msg || error.message,
                    code: error.response?.data?.code
                });
                throw error;
            }
        }
    }

    /**
     * Gerçek HTTP isteğini yapan özel metod
     */
    async performRequest(method, endpoint, params = {}, signed = false, isRetry = false) {
        const startTime = Date.now(); // Performans ölçümü için başlangıç zamanı
        if (signed) {
            params.timestamp = await this.getTimestamp();
            params.recvWindow = 10000;
            const queryString = this.buildQueryString(params);
            const signature = this.generateSignature(queryString);
            params.signature = signature;
        }

        const queryString = this.buildQueryString(params);
        const url = new URL(`${this.baseURL}${endpoint}?${queryString}`);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'X-MBX-APIKEY': this.apiKey,
                'Content-Type': 'application/json'
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const duration = Date.now() - startTime; // Performans ölçümü için bitiş
                        const jsonData = JSON.parse(data);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            if (!isRetry) logger.api(`Binance ${method} ${endpoint}`, { status: res.statusCode, duration: `${duration}ms` });
                            resolve(jsonData);
                        } else {
                            const error = new Error(`Request failed with status code ${res.statusCode}: ${jsonData.msg}`);
                            error.response = { data: jsonData, status: res.statusCode };
                            reject(error);
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            const url = new URL(`${this.baseURL}/api/v3/ping`);
            
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            logger.info('✅ Binance bağlantı testi başarılı');
                            resolve(JSON.parse(data || '{}'));
                        } else {
                            reject(new Error(`Status ${res.statusCode}`));
                        }
                    });
                }).on('error', reject);
            });
        } catch (error) {
            logger.error('❌ Binance bağlantı hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get server time
     */
    async getServerTime() {
        const url = new URL(`${this.baseURL}/api/v3/time`);
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve(JSON.parse(data)));
            }).on('error', reject);
        });
    }

    /**
     * Get account information (balances)
     */
    async getBalances() {
        try {
            const result = await this.makeRequest('GET', '/api/v3/account', {}, true);
            
            const balances = {};
            if (result.balances) {
                result.balances.forEach(item => {
                    const free = parseFloat(item.free);
                    const locked = parseFloat(item.locked);
                    
                    // Task 4.5: Balance Data Validation
                    if (isNaN(free) || isNaN(locked) || free < 0 || locked < 0) {
                        logger.warn(`[Data Validation] Binance'ten geçersiz bakiye verisi geldi, atlanıyor.`, { asset: item.asset, free: item.free, locked: item.locked });
                        return; // Bu varlığı atla
                    }

                    if (free > 0 || locked > 0) {
                        balances[item.asset] = {
                            free: free,
                            locked: locked,
                            total: free + locked
                        };
                    }
                });
            }
            
            logger.balance('Binance bakiyeler alındı', {
                assets: Object.keys(balances)
            });
            
            return balances;
        } catch (error) {
            logger.error('Binance bakiye çekme hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get 24hr ticker
     */
    async getTicker24h(symbol = 'XRPUSDT') {
        try {
            const url = new URL(`${this.baseURL}/api/v3/ticker/24hr?symbol=${symbol}`);
            
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        const jsonData = JSON.parse(data);
                        resolve({
                            symbol: jsonData.symbol,
                            last: parseFloat(jsonData.lastPrice),
                            bid: parseFloat(jsonData.bidPrice),
                            ask: parseFloat(jsonData.askPrice),
                            high: parseFloat(jsonData.highPrice),
                            low: parseFloat(jsonData.lowPrice),
                            volume: parseFloat(jsonData.volume),
                            quoteVolume: parseFloat(jsonData.quoteVolume),
                            priceChange: parseFloat(jsonData.priceChange),
                            priceChangePercent: parseFloat(jsonData.priceChangePercent),
                            timestamp: jsonData.closeTime
                        });
                    });
                }).on('error', (error) => {
                    logger.error('Binance ticker hatası:', error.message);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('Binance ticker hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get order book
     */
    async getOrderBook(symbol = 'XRPUSDT', limit = 10) {
        try {
            const url = new URL(`${this.baseURL}/api/v3/depth?symbol=${symbol}&limit=${limit}`);
            
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        const jsonData = JSON.parse(data);
                        resolve({
                            bids: jsonData.bids.map(b => ({
                                price: parseFloat(b[0]),
                                amount: parseFloat(b[1])
                            })),
                            asks: jsonData.asks.map(a => ({
                                price: parseFloat(a[0]),
                                amount: parseFloat(a[1])
                            })),
                            timestamp: Date.now()
                        });
                    });
                }).on('error', (error) => {
                    logger.error('Binance orderbook hatası:', error.message);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('Binance orderbook hatası:', error.message);
            throw error;
        }
    }

    /**
     * Create market order
     */
    async createMarketOrder(params) {
        try {
            const orderParams = {
                symbol: params.symbol,
                side: params.side.toUpperCase(), // BUY or SELL
                type: 'MARKET',
                quantity: parseFloat(params.quantity) // Binance quantity formatını otomatik yapacak
            };
            
            logger.debug('📋 Binance Market Order Parameters:', orderParams);
            
            const result = await this.makeRequest('POST', '/api/v3/order', orderParams, true);
            
            logger.order(`✅ Binance market ${params.side} emri gerçekleşti`, {
                orderId: result.orderId,
                symbol: params.symbol,
                side: params.side,
                quantity: params.quantity,
                executedQty: result.executedQty,
                cummulativeQuoteQty: result.cummulativeQuoteQty
            });
            
            return {
                id: result.orderId,
                symbol: result.symbol,
                side: result.side,
                type: result.type,
                quantity: parseFloat(result.executedQty),
                price: parseFloat(result.cummulativeQuoteQty) / parseFloat(result.executedQty),
                status: result.status,
                fills: result.fills,
                timestamp: result.transactTime
            };
        } catch (error) {
            logger.error('❌ Binance market emir hatası:', {
                error: error.response?.data || error.message,
                params
            });
            throw error;
        }
    }

    /**
     * Query order
     */
    async getOrder(symbol, orderId) {
        try {
            const result = await this.makeRequest('GET', '/api/v3/order', {
                symbol: symbol,
                orderId: orderId
            }, true);
            
            const price = parseFloat(result.price);
            const quantity = parseFloat(result.origQty);
            const executedQuantity = parseFloat(result.executedQty);

            // Task 4.5: Order Data Validation
            if (isNaN(price) || isNaN(quantity) || isNaN(executedQuantity) || price < 0 || quantity < 0 || executedQuantity < 0) {
                logger.error(`[Data Validation] Binance'ten geçersiz emir verisi geldi.`, { orderId, data: result });
                throw new Error('Invalid order data received from Binance');
            }
            
            return {
                id: result.orderId,
                symbol: result.symbol,
                status: result.status,
                side: result.side,
                type: result.type,
                price: price,
                quantity: quantity,
                executedQuantity: executedQuantity,
                timestamp: result.time
            };
        } catch (error) {
            // Binance: -2013, Order does not exist.
            if (error.response?.data?.code === -2013) {
                throw new Error('Order not found');
            }
            logger.error('Binance emir sorgulama hatası:', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Cancel order
     */
    async cancelOrder(symbol, orderId) {
        try {
            const result = await this.makeRequest('DELETE', '/api/v3/order', {
                symbol: symbol,
                orderId: orderId
            }, true);
            
            logger.order(`✅ Binance emir iptal edildi`, {
                orderId: result.orderId,
                symbol: result.symbol
            });
            
            return result;
        } catch (error) {
            logger.error('❌ Binance emir iptal hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get current open orders
     */
    async getOpenOrders(symbol = null) {
        try {
            const params = {};
            if (symbol) {
                params.symbol = symbol;
            }
            
            const result = await this.makeRequest('GET', '/api/v3/openOrders', params, true);
            
            logger.order(`Binance açık emirler: ${result.length} adet`, {
                symbol: symbol || 'ALL'
            });
            
            return result.map(order => ({
                id: order.orderId,
                symbol: order.symbol,
                side: order.side,
                type: order.type,
                price: parseFloat(order.price),
                quantity: parseFloat(order.origQty),
                executedQuantity: parseFloat(order.executedQty),
                status: order.status,
                timestamp: order.time
            }));
        } catch (error) {
            logger.error('Binance açık emir hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get all orders (history)
     */
    async getAllOrders(symbol, params = {}) {
        try {
            const orderParams = {
                symbol: symbol,
                ...params
            };
            
            const result = await this.makeRequest('GET', '/api/v3/allOrders', orderParams, true);
            
            return result;
        } catch (error) {
            logger.error('Binance emir geçmişi hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get account information including commission rates
     */
    async getAccountInfo() {
        try {
            const result = await this.makeRequest('GET', '/api/v3/account', {}, true);
            
            logger.api('Binance', 'Account info alındı', {
                commissionRates: result.commissionRates
            });
            
            return result;
        } catch (error) {
            logger.error('Binance account info hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get commission rates for a specific symbol
     */
    async getCommissionRates(symbol = 'XRPUSDT') {
        try {
            const result = await this.makeRequest('GET', '/api/v3/account/commission', { symbol }, true);
            
            logger.api('Binance', `${symbol} commission rates alındı`, {
                maker: result.standardCommission.maker,
                taker: result.standardCommission.taker
            });
            
            return result;
        } catch (error) {
            logger.error(`Binance ${symbol} commission hatası:`, error.message);
            throw error;
        }
    }

    /**
     * FAZ 2: Order Book Depth Sorgulama
     * Order book'u alır ve depth analizi için hazırlar
     * 
     * @param {string} symbol - Trading pair (örn: 'XRPUSDT')
     * @param {number} limit - Depth seviyesi (5, 10, 20, 50, 100, 500, 1000, 5000)
     * @returns {Promise<object>} Order book data
     */
    async getOrderBook(symbol = 'XRPUSDT', limit = 20) {
        try {
            // Binance limit değerleri: 5, 10, 20, 50, 100, 500, 1000, 5000
            const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000];
            const closestLimit = validLimits.reduce((prev, curr) => 
                Math.abs(curr - limit) < Math.abs(prev - limit) ? curr : prev
            );
            
            const result = await this.makeRequest('GET', '/api/v3/depth', { 
                symbol: symbol.toUpperCase(), 
                limit: closestLimit 
            }, false);
            
            // Bids ve asks'i parse et
            const bids = result.bids.map(b => ({
                price: parseFloat(b[0]),
                amount: parseFloat(b[1])
            }));
            
            const asks = result.asks.map(a => ({
                price: parseFloat(a[0]),
                amount: parseFloat(a[1])
            }));
            
            return {
                symbol: symbol.toUpperCase(),
                bids,
                asks,
                timestamp: Date.now(),
                lastUpdateId: result.lastUpdateId
            };
        } catch (error) {
            logger.error(`Binance ${symbol} order book hatası:`, error.message);
            throw error;
        }
    }

    /**
     * Helper: Sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * WebSocket bağlantısı kur
     * Stream: <symbol>@bookTicker - En iyi bid/ask fiyatları gerçek zamanlı
     */
    connectWebSocket(callback) {
        this.priceCallback = callback;
        this.isManualClose = false;
        const symbol = 'xrpusdt';
        const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@bookTicker`;

        return new Promise((resolve, reject) => {
            logger.api('Binance', 'WebSocket bağlantısı kuruluyor', { url: wsUrl });
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                logger.info('✅ Binance WebSocket bağlandı (XRPUSDT)');
                this.reconnectAttempts = 0;
                this.lastMessageTimestamp = Date.now();
                this.startHealthCheck();
                resolve(this.ws);
            });

            this.ws.on('error', (error) => {
                logger.error('Binance WebSocket bağlantı hatası:', error);
                reject(error); // Let promise fail on initial connection error
            });

            this.ws.on('message', (data) => {
                this.lastMessageTimestamp = Date.now();
                try {
                    const message = JSON.parse(data);
                    const priceData = {
                        exchange: 'BINANCE',
                        symbol: message.s,
                        timestamp: Date.now(),
                        bid: parseFloat(message.b),
                        ask: parseFloat(message.a),
                        bidQty: parseFloat(message.B),
                        askQty: parseFloat(message.A),
                        updateId: message.u
                    };
                    if (this.priceCallback) this.priceCallback(priceData);
                } catch (error) {
                    logger.error('Binance WebSocket mesaj parse hatası:', error);
                }
            });

            this.ws.on('close', (code, reason) => {
                logger.warn('❌ Binance WebSocket bağlantısı kapandı', { code, reason: reason.toString() });
                if (!this.isManualClose) {
                    this.reconnect();
                }
            });
        });
    }

    startHealthCheck() {
        this.clearTimers();
        this.healthCheckInterval = setInterval(() => {
            if (Date.now() - this.lastMessageTimestamp > this.staleConnectionThreshold) {
                logger.warn('Binance WebSocket stale connection detected. Forcing reconnect.');
                if (this.ws) this.ws.terminate();
            }
        }, 15000);
    }

    reconnect() {
        this.clearTimers();
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Binance WebSocket max reconnect attempts reached. Giving up.');
            return;
        }

        const delay = this.initialReconnectDelay * (2 ** this.reconnectAttempts);
        this.reconnectAttempts++;

        setTimeout(() => {
            logger.info(`🔄 Binance WebSocket ${delay}ms sonra yeniden bağlanacak... (Deneme: ${this.reconnectAttempts})`);
            this.connectWebSocket(this.priceCallback);
        }, delay);
    }

    disconnectWebSocket() {
        this.isManualClose = true;
        this.clearTimers();
        if (this.ws) {
            logger.api('Binance', 'WebSocket bağlantısı kapatılıyor');
            this.ws.close();
            this.ws = null;
        }
    }

    clearTimers() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Bağlantıyı kapat
     */
    async disconnect() {
        this.disconnectWebSocket();
        logger.info('Binance bağlantısı kapatıldı');
    }
}

export default BinanceClient;
