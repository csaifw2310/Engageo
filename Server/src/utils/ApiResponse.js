/**
 * Consistent success envelope for every endpoint.
 * Shape: { success, message, data }
 */
class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

export default ApiResponse;
