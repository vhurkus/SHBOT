/**
 * Exchange Precision Utilities
 * Handles quantity and price rounding according to exchange specifications
 */

/**
 * Round quantity to Binance LOT_SIZE stepSize
 * @param {number} quantity - Raw quantity
 * @param {number} stepSize - From Binance LOT_SIZE filter (e.g., 0.1 for XRPUSDT)
 * @returns {number} Rounded quantity that complies with LOT_SIZE
 */
export function roundToBinanceLOT_SIZE(quantity, stepSize) {
  // Calculate precision from stepSize (0.1 -> 1 decimal, 0.01 -> 2 decimals)
  const precision = stepSize.toString().split('.')[1]?.length || 0;
  
  // Round down to nearest stepSize multiple
  const rounded = Math.floor(quantity / stepSize) * stepSize;
  
  // Return with correct precision to avoid floating point issues
  return parseFloat(rounded.toFixed(precision));
}

/**
 * Round quantity to BTCTurk numeratorScale
 * @param {number} quantity - Raw quantity
 * @param {number} numeratorScale - From BTCTurk exchangeinfo (e.g., 4 for XRPUSDT)
 * @returns {number} Rounded quantity with correct decimal places
 */
export function roundToBTCTurkScale(quantity, numeratorScale) {
  return parseFloat(quantity.toFixed(numeratorScale));
}

/**
 * Round price to BTCTurk denominatorScale
 * @param {number} price - Raw price
 * @param {number} denominatorScale - From BTCTurk exchangeinfo (e.g., 4 for XRPUSDT)
 * @returns {number} Rounded price with correct decimal places
 */
export function roundBTCTurkPrice(price, denominatorScale) {
  return parseFloat(price.toFixed(denominatorScale));
}
