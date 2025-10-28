/**
 * BTCTurk Exchange Client
 * REST API and WebSocket implementation
 */

import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';
import WebSocket from 'ws';
import logger from '../utils/logger.js';

class BTCTurkClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.baseURL = config.baseURL || 'https://api.btcturk.com';
        this.wsURL = config.wsURL || 'wss://ws-feed-pro.btcturk.com';
        
        this.ws = null;
        this.priceCallback = null;
        this.reconnectInterval = config.rateLimit?.retryDelay || 5000;
        this.pingInterval = null;
        this.isConnected = false;
        this.isManualClose = false; // Manuel kapatma flag'i
        
        // Rate limiting
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // 10 requests per second = 100ms interval

        // XRPUSDT precision cache (from /api/v2/server/exchangeinfo)
        this.xrpPrecision = {
            numeratorScale: 4,    // Quantity decimals - max 4 decimal places (e.g., 10.1234)
            denominatorScale: 4,  // Price decimals - max 4 decimal places
            lastUpdate: null
        };
    }

    /**
     * HMAC-SHA256 imza oluşturma
     */
    generateSignature(message) {
        const secret = Buffer.from(this.apiSecret, 'base64');
        const signature = crypto
            .createHmac('sha256', secret)
            .update(message)
            .digest('base64');
        return signature;
    }

    /**
     * API Request Headers oluşturma
     */
    getHeaders(method, uri, body = '') {
        const stamp = Date.now().toString();
        const message = `${this.apiKey}${stamp}`;
        const signature = this.generateSignature(message);

        return {
            'X-PCK': this.apiKey,
            'X-Stamp': stamp,
            'X-Signature': signature,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Rate-limited API request
     */
    async makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ method, endpoint, data, resolve, reject });
            this.processQueue();
        });
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

            const { method, endpoint, data, resolve, reject } = this.requestQueue.shift();
            
            try {
                const result = await this.executeRequest(method, endpoint, data);
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
    async executeRequest(method, endpoint, data = null) {
        const uri = endpoint;
        const urlString = `${this.baseURL}${uri}`;
        const headers = this.getHeaders(method, uri, data ? JSON.stringify(data) : '');
        const url = new URL(urlString);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: headers
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(responseData);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            logger.api(`BTCTurk ${method} ${endpoint}`, {
                                status: res.statusCode
                            });
                            resolve(jsonData);
                        } else {
                            logger.error(`BTCTurk API Error: ${method} ${endpoint}`, {
                                status: res.statusCode,
                                message: jsonData.message || 'Unknown error'
                            });
                            
                            // BTCTurk'ün error response'unu logla
                            logger.error('❌ BTCTurk emir oluşturma hatası:', {
                                error: jsonData,
                                params: data
                            });
                            
                            const error = new Error(`Request failed with status code ${res.statusCode}`);
                            error.response = { data: jsonData, status: res.statusCode };
                            reject(error);
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                logger.error('❌ BTCTurk request error:', error.message);
                reject(error);
            });

            // POST/DELETE için body gönder
            if ((method === 'POST' || method === 'DELETE') && data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            const url = new URL(`${this.baseURL}/api/v2/server/exchangeinfo`);
            
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            const jsonData = JSON.parse(data);
                            logger.info('✅ BTCTurk bağlantı testi başarılı');
                            resolve(jsonData);
                        } catch (parseError) {
                            reject(new Error(`Failed to parse response: ${data}`));
                        }
                    });
                }).on('error', (error) => {
                    logger.error('❌ BTCTurk bağlantı hatası:', error.message);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('❌ BTCTurk bağlantı hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get account balances
     */
    async getBalances() {
        try {
            const result = await this.makeRequest('GET', '/api/v1/users/balances');
            
            const balances = {};
            if (result.data) {
                result.data.forEach(item => {
                    balances[item.asset] = {
                        free: parseFloat(item.free),
                        locked: parseFloat(item.locked),
                        total: parseFloat(item.balance)
                    };
                });
            }
            
            logger.balance('BTCTurk bakiyeler alındı', { 
                assets: Object.keys(balances) 
            });
            
            return balances;
        } catch (error) {
            logger.error('BTCTurk bakiye çekme hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get open orders
     */
    async getOpenOrders(pairSymbol = 'XRPTRY') {
        try {
            const result = await this.makeRequest('GET', `/api/v1/openOrders?pairSymbol=${pairSymbol}`);
            
            const orders = [];
            if (result.data) {
                // Asks (sell orders)
                if (result.data.asks) {
                    orders.push(...result.data.asks.map(order => ({
                        ...order,
                        side: 'SELL',
                        id: order.id,
                        price: parseFloat(order.price),
                        quantity: parseFloat(order.quantity),
                        leftAmount: parseFloat(order.leftAmount)
                    })));
                }
                
                // Bids (buy orders)
                if (result.data.bids) {
                    orders.push(...result.data.bids.map(order => ({
                        ...order,
                        side: 'BUY',
                        id: order.id,
                        price: parseFloat(order.price),
                        quantity: parseFloat(order.quantity),
                        leftAmount: parseFloat(order.leftAmount)
                    })));
                }
            }
            
            logger.order(`BTCTurk açık emirler: ${orders.length} adet`, { 
                pairSymbol,
                count: orders.length 
            });
            
            return orders;
        } catch (error) {
            logger.error('BTCTurk açık emir hatası:', error.message);
            throw error;
        }
    }

    /**
     * Create limit order
     */
    async createLimitOrder(params) {
        try {
            const body = {
                pairSymbol: params.symbol,
                orderType: params.side.toLowerCase(), // buy or sell
                orderMethod: 'limit',
                price: parseFloat(params.price).toFixed(4),
                quantity: parseFloat(params.quantity).toFixed(2),
                newOrderClientId: `ARB_${Date.now()}`
            };
            
            const result = await this.makeRequest('POST', '/api/v1/order', body);
            
            logger.order(`✅ BTCTurk limit ${params.side} emri oluşturuldu`, {
                orderId: result.data?.id,
                symbol: params.symbol,
                price: params.price,
                quantity: params.quantity
            });
            
            return {
                id: result.data?.id,
                symbol: params.symbol,
                side: params.side.toUpperCase(),
                price: parseFloat(params.price),
                quantity: parseFloat(params.quantity),
                status: 'NEW',
                timestamp: result.data?.datetime || Date.now()
            };
        } catch (error) {
            logger.error('❌ BTCTurk emir oluşturma hatası:', {
                error: error.response?.data || error.message,
                params
            });
            throw error;
        }
    }

    /**
     * Cancel order
     */
    async cancelOrder(orderId) {
        try {
            const result = await this.makeRequest('DELETE', `/api/v1/order?id=${orderId}`);
            
            logger.order(`✅ BTCTurk emir iptal edildi`, { orderId });
            
            return result;
        } catch (error) {
            logger.error('❌ BTCTurk emir iptal hatası:', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get order details
     */
    async getOrder(orderId) {
        try {
            const result = await this.makeRequest('GET', `/api/v1/order/${orderId}`);
            
            if (!result.data) {
                throw new Error('Order not found');
            }
            
            const order = result.data;
            
            return {
                id: order.id,
                status: order.status, // untouched, partial, closed, canceled
                side: order.type?.toUpperCase() || 'UNKNOWN',
                price: parseFloat(order.price),
                quantity: parseFloat(order.quantity),
                executedQuantity: parseFloat(order.quantity) - parseFloat(order.leftAmount || 0),
                timestamp: order.updateTime || order.datetime
            };
        } catch (error) {
            logger.error('BTCTurk emir sorgulama hatası:', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * Get all orders (history)
     */
    async getAllOrders(params = {}) {
        try {
            const queryParams = new URLSearchParams();
            if (params.orderId) queryParams.append('orderId', params.orderId);
            if (params.pairSymbol) queryParams.append('pairSymbol', params.pairSymbol);
            if (params.startDate) queryParams.append('startDate', params.startDate);
            if (params.endDate) queryParams.append('endDate', params.endDate);
            
            const endpoint = `/api/v1/allOrders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const result = await this.makeRequest('GET', endpoint);
            
            return result.data || [];
        } catch (error) {
            logger.error('BTCTurk emir geçmişi hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get ticker (24h stats)
     */
    async getTicker24h(symbol = 'XRPTRY') {
        try {
            const url = new URL(`${this.baseURL}/api/v2/ticker?pairSymbol=${symbol}`);
            
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            const response = JSON.parse(data);
                            const tickerData = response.data[0];
                            
                            resolve({
                                symbol: tickerData.pairSymbol,
                                last: parseFloat(tickerData.last),
                                bid: parseFloat(tickerData.bid),
                                ask: parseFloat(tickerData.ask),
                                volume: parseFloat(tickerData.volume),
                                daily: parseFloat(tickerData.daily),
                                dailyPercent: parseFloat(tickerData.dailyPercent),
                                high: parseFloat(tickerData.high),
                                low: parseFloat(tickerData.low),
                                timestamp: tickerData.timestamp
                            });
                        } catch (parseError) {
                            logger.error('BTCTurk ticker parse hatası:', parseError.message);
                            reject(parseError);
                        }
                    });
                }).on('error', (error) => {
                    logger.error('BTCTurk ticker hatası:', error.message);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('BTCTurk ticker hatası:', error.message);
            throw error;
        }
    }

    /**
     * Get order book
     */
    async getOrderBook(symbol = 'XRPTRY', limit = 10) {
        try {
            const url = new URL(`${this.baseURL}/api/v2/orderbook?pairSymbol=${symbol}&limit=${limit}`);
            
            return new Promise((resolve, reject) => {
                https.get(url, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            const response = JSON.parse(data);
                            
                            resolve({
                                bids: response.data.bids.map(b => ({ 
                                    price: parseFloat(b[0]), 
                                    amount: parseFloat(b[1]) 
                                })),
                                asks: response.data.asks.map(a => ({ 
                                    price: parseFloat(a[0]), 
                                    amount: parseFloat(a[1]) 
                                })),
                                timestamp: response.data.timestamp
                            });
                        } catch (parseError) {
                            logger.error('BTCTurk orderbook parse hatası:', parseError.message);
                            reject(parseError);
                        }
                    });
                }).on('error', (error) => {
                    logger.error('BTCTurk orderbook hatası:', error.message);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('BTCTurk orderbook hatası:', error.message);
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
     * WebSocket bağlantısı kurma
     */
    async connectWebSocket(callback, symbol = 'XRPUSDT') {
        this.priceCallback = callback; // Callback'i sakla
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.wsURL);
                
                this.ws.on('open', () => {
                    logger.websocket('✅ BTCTurk WebSocket bağlantısı açıldı');
                    
                    // Ticker channel'a abone ol
                    this.subscribeToTicker(symbol);
                    
                    // Ping/Pong mekanizması
                    this.setupPingPong();
                    
                    this.isConnected = true;
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleWebSocketMessage(data);
                });

                this.ws.on('error', (error) => {
                    logger.error('❌ BTCTurk WebSocket hatası:', error.message);
                    this.isConnected = false;
                });

                this.ws.on('close', () => {
                    this.isConnected = false;
                    
                    if (!this.isManualClose) {
                        logger.warn('⚠️  BTCTurk WebSocket bağlantısı kapandı');
                        this.reconnect(symbol);
                    }
                    
                    this.isManualClose = false; // Reset flag
                });

                this.ws.on('ping', () => {
                    this.ws.pong();
                });

            } catch (error) {
                logger.error('BTCTurk WebSocket bağlantı hatası:', error);
                reject(error);
            }
        });
    }

    /**
     * Ticker channel'a abone ol
     */
    subscribeToTicker(symbol) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const subscribeMessage = [
                151,
                {
                    type: 151,
                    channel: 'ticker',
                    event: symbol,
                    join: true
                }
            ];
            
            this.ws.send(JSON.stringify(subscribeMessage));
            logger.websocket(`📡 Ticker kanalına abone olundu: ${symbol}`);
        }
    }

    /**
     * Ticker channel'dan çık
     */
    unsubscribeFromTicker(symbol) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const unsubscribeMessage = [
                151,
                {
                    type: 151,
                    channel: 'ticker',
                    event: symbol,
                    join: false
                }
            ];
            
            this.ws.send(JSON.stringify(unsubscribeMessage));
            logger.websocket(`📴 Ticker kanalından çıkıldı: ${symbol}`);
        }
    }

    /**
     * WebSocket mesajlarını işle
     */
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            
            // Array formatında gelen mesajlar
            if (Array.isArray(message) && message.length >= 2) {
                const [type, payload] = message;
                
                // Ticker mesajı (type: 402)
                if (type === 402 && payload) {
                    const tickerData = {
                        exchange: 'BTCTURK',
                        symbol: payload.PS || payload.P,
                        bid: parseFloat(payload.B),
                        ask: parseFloat(payload.A),
                        last: parseFloat(payload.L),
                        high: parseFloat(payload.H),
                        low: parseFloat(payload.LO),
                        volume: parseFloat(payload.V),
                        average: parseFloat(payload.AV),
                        daily: parseFloat(payload.D),
                        dailyPercent: parseFloat(payload.DP),
                        timestamp: payload.T || Date.now()
                    };
                    
                    logger.websocket('BTCTurk', 'price_update', {
                        bid: tickerData.bid,
                        ask: tickerData.ask,
                        spread: (tickerData.ask - tickerData.bid).toFixed(4)
                    });
                    
                    // Callback'i çağır
                    if (this.priceCallback && typeof this.priceCallback === 'function') {
                        this.priceCallback(tickerData);
                    }
                }
                
                // Login response (type: 114)
                else if (type === 114) {
                    logger.websocket('🔐 WebSocket login yanıtı alındı');
                }
                
                // Subscription response (type: 151)
                else if (type === 151) {
                    logger.websocket('✅ Kanal subscription yanıtı:', payload);
                }
            }
        } catch (error) {
            logger.error('WebSocket mesaj işleme hatası:', error.message);
        }
    }

    /**
     * Ping/Pong keep-alive mekanizması
     */
    setupPingPong() {
        // Her 30 saniyede bir ping gönder
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
                logger.websocket('🏓 Ping gönderildi');
            }
        }, 30000);
    }

    /**
     * Otomatik yeniden bağlanma
     */
    reconnect(symbol = 'XRPUSDT') {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        setTimeout(() => {
            logger.websocket('🔄 BTCTurk WebSocket yeniden bağlanıyor...');
            this.connectWebSocket(this.priceCallback, symbol);
        }, this.reconnectInterval);
    }

    /**
     * Fiyat güncellemesi için callback
     */
    onPriceUpdate(callback) {
        this.priceCallback = callback;
    }

    /**
     * WebSocket bağlantısını kapat
     */
    disconnectWebSocket() {
        this.isManualClose = true; // Manuel kapatma işareti
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    /**
     * Bağlantıyı kapat
     */
    async disconnect() {
        this.disconnectWebSocket();
        logger.info('BTCTurk bağlantısı kapatıldı');
    }
}

export default BTCTurkClient;
