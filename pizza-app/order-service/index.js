const express = require('express');
const axios = require('axios');
const cors = require('cors');
const pino = require('pino');

const logger = pino({ name: 'order-service' });

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

const KITCHEN_SERVICE_URL = process.env.KITCHEN_SERVICE_URL || 'http://localhost:3001';
const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3002';

// Generate order ID
function generateOrderId() {
  return `PIZZA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

// Create pizza order
app.post('/order', async (req, res) => {
  const { pizzaType, size, customerName } = req.body;
  const orderId = generateOrderId();
  
  logger.info({ orderId, pizzaType, size, customerName }, 'Order received');
  
  try {
    // Step 1: Check kitchen availability
    logger.info({ orderId }, 'Checking kitchen availability');
    const kitchenResponse = await axios.post(`${KITCHEN_SERVICE_URL}/check-availability`, {
      orderId,
      pizzaType,
      size
    });
    
    if (!kitchenResponse.data.available) {
      logger.warn({ orderId }, 'Kitchen not available');
      return res.status(503).json({ 
        error: 'Kitchen is currently unavailable',
        orderId 
      });
    }
    
    // Step 2: Start cooking
    logger.info({ orderId }, 'Starting to cook');
    const cookResponse = await axios.post(`${KITCHEN_SERVICE_URL}/cook`, {
      orderId,
      pizzaType,
      size
    });
    
    // Step 3: Assign delivery driver
    logger.info({ orderId }, 'Assigning driver');
    const deliveryResponse = await axios.post(`${DELIVERY_SERVICE_URL}/assign-driver`, {
      orderId,
      customerName,
      size
    });
    
    logger.info({ orderId }, 'Order completed successfully');
    
    res.json({
      orderId,
      status: 'confirmed',
      pizzaType,
      size,
      customerName,
      estimatedTime: cookResponse.data.cookingTime + deliveryResponse.data.estimatedDeliveryTime,
      driver: deliveryResponse.data.driverName,
      message: `Your ${size} ${pizzaType} pizza will be delivered in ${cookResponse.data.cookingTime + deliveryResponse.data.estimatedDeliveryTime} minutes!`
    });
    
  } catch (error) {
    const upstreamUrl = error.config?.url;
    const upstreamStatus = error.response?.status;
    const upstreamBody = error.response?.data;

    logger.error({
      orderId,
      err: error,
      upstreamUrl,
      upstreamStatus,
      upstreamError: upstreamBody?.error
    }, 'Error processing order');

    if (upstreamStatus) {
      return res.status(upstreamStatus).json({
        error: upstreamBody?.error || 'Failed to process order',
        orderId,
        message: upstreamBody?.message,
        upstream: {
          url: upstreamUrl,
          status: upstreamStatus
        }
      });
    }

    res.status(500).json({
      error: 'Failed to process order',
      orderId,
      details: error.message,
      upstream: {
        url: upstreamUrl
      }
    });
  }
});

// Get order status
app.get('/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  logger.info({ orderId }, 'Status check');
  
  res.json({
    orderId,
    status: 'in-progress',
    message: 'Your pizza is being prepared'
  });
});

app.listen(PORT, () => {
  logger.info({
    port: PORT,
    kitchenServiceUrl: KITCHEN_SERVICE_URL,
    deliveryServiceUrl: DELIVERY_SERVICE_URL
  }, 'Order Service listening');
});
