const express = require('express');
const cors = require('cors');
const pino = require('pino');

const logger = pino({ name: 'delivery-service' });

const app = express();
const PORT = 3002;

app.use(express.json());
app.use(cors());

const NO_DRIVERS = process.env.NO_DRIVERS === 'true';

// Simulate async delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Available drivers.
// `bagSize` is the biggest pizza this driver's thermal bag can carry.
const drivers = [
  { name: 'Mario', distance: 2.5, rating: 4.8, bagSize: 'Large' },
  { name: 'Luigi', distance: 3.0, rating: 4.9, bagSize: 'Medium' },
  { name: 'Peach', distance: 1.5, rating: 5.0, bagSize: 'Medium' },
  { name: 'Toad', distance: 4.0, rating: 4.7, bagSize: 'Large' }
];

// Pizza sizes, smallest to biggest. A driver can carry any pizza whose rank
// is <= the rank of their bag.
const SIZE_RANK = {
  Small: 1,
  Medium: 2,
  Large: 3
};

// Find nearest available driver whose bag fits this pizza
async function findNearestDriver(size) {
  logger.info({ size }, 'Searching for nearest driver');
  await sleep(100);
  
  if (NO_DRIVERS) {
    return null;
  }
  
  const eligible = drivers.filter(d => SIZE_RANK[d.bagSize] >= SIZE_RANK[size]);
  logger.info({ size, eligible: eligible.length, total: drivers.length }, 'Drivers able to carry this pizza');
  
  // Sort by distance and return closest
  const sortedDrivers = [...eligible].sort((a, b) => a.distance - b.distance);
  return sortedDrivers[0];
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'delivery-service' });
});

// Assign driver to delivery
app.post('/assign-driver', async (req, res) => {
  const { orderId, customerName, size } = req.body;
  
  logger.info({ orderId, customerName, size }, 'Assigning driver');
  
  // Find nearest driver
  const driver = await findNearestDriver(size);
  
  if (!driver) {
    logger.warn({ orderId }, 'No drivers available');
    return res.status(503).json({
      error: 'No drivers available',
      orderId,
      message: 'All drivers are currently busy. Please try again later.'
    });
  }
  
  // Calculate estimated delivery time based on distance
  const estimatedDeliveryTime = Math.ceil(driver.distance * 5); // 5 min per km
  
  await sleep(150);
  
  logger.info({ orderId, driver: driver.name, distanceKm: driver.distance }, 'Driver assigned');
  
  res.json({
    orderId,
    driverName: driver.name,
    driverRating: driver.rating,
    distance: driver.distance,
    estimatedDeliveryTime,
    status: 'driver-assigned'
  });
});

// Get delivery status
app.get('/status/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  logger.info({ orderId }, 'Delivery status check');
  
  res.json({
    orderId,
    status: 'on-the-way',
    message: 'Your pizza is on the way!'
  });
});

app.listen(PORT, () => {
  logger.info({ port: PORT, noDrivers: NO_DRIVERS, availableDrivers: drivers.length }, 'Delivery Service listening');
});
