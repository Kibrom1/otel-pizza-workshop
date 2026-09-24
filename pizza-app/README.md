# Pizza Order Tracker

A pizza ordering system built from three microservices and a web frontend.

## What's Inside

- **Order Service** (Port 3000): Receives pizza orders and coordinates with other services
- **Kitchen Service** (Port 3001): Checks availability and cooks pizzas
- **Delivery Service** (Port 3002): Assigns drivers for delivery
- **Frontend** (Port 8080): Simple web UI for ordering pizzas

## Architecture

```
┌─────────────┐
│   Browser   │
│  (Port 8080)│
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Order     │────▶│   Kitchen   │     │  Delivery   │
│  Service    │     │   Service   │     │   Service   │
│ (Port 3000) │     │ (Port 3001) │     │ (Port 3002) │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Running the App

Create your `.env` first, so the services know where to send telemetry:

```bash
cp .env.template .env
# then fill in DASH0_AUTH_TOKEN and DASH0_ENDPOINT
```

```bash
docker compose up
```

Then open http://localhost:8080 and order a pizza.

To stop it:

```bash
docker compose down
```

## Watching What Happens

The terminal shows all four services interleaved:

```
order-service    | {"level":30,...,"orderId":"PIZZA-123...","msg":"Order received"}
kitchen-service  | {"level":30,...,"orderId":"PIZZA-123...","msg":"Starting to cook"}
delivery-service | {"level":30,...,"orderId":"PIZZA-123...","msg":"Assigning driver"}
```

One service on its own:

```bash
docker compose logs -f kitchen-service
```

## Watching What Happens in Dash0

The three Node services are instrumented with OpenTelemetry without any
tracing code in the application. Each one starts as

```
node --require @opentelemetry/auto-instrumentations-node/register index.js
```

which patches Express, the HTTP client and Pino at load time, and exports
traces, metrics and logs to the endpoint in `.env`.

What shows up in Dash0:

- **Traces.** One trace per order, starting at `POST /order` in
  `order-service` and containing the calls it makes to `kitchen-service`
  (`/check-availability`, `/cook`) and `delivery-service`
  (`/assign-driver`), with status and duration for every hop.
- **Logs.** The existing Pino output, with `trace_id` and `span_id` attached,
  so the log lines for an order are linked to its trace.
- **Metrics.** Request rate, error rate and latency per service, plus Node.js
  runtime metrics.

The three services appear as `order-service`, `kitchen-service` and
`delivery-service` in the namespace `pizza-app`.

The browser frontend is not instrumented; traces begin when the order reaches
`order-service`.

If nothing arrives in Dash0, check the startup output of a service:

```bash
docker compose logs order-service | head
```

`OpenTelemetry automatic instrumentation started successfully` means the SDK
is loaded. Export failures (a wrong endpoint, a rejected token) are printed
as errors on the same stream.

## Failure Modes You Can Switch On

### Slow Kitchen (Oven is Broken)
```bash
SLOW_KITCHEN=true docker compose up
```

Every pizza takes about five seconds longer to cook.

### No Drivers Available
```bash
NO_DRIVERS=true docker compose up
```

Delivery has nobody to assign, so orders fail.

## Services Overview

### Order Service
- Receives orders from the frontend
- Calls Kitchen Service to check availability and cook
- Calls Delivery Service to assign a driver
- Returns order confirmation

### Kitchen Service
- Checks if kitchen is available
- Simulates cooking time
- Can be configured to be slow (SLOW_KITCHEN=true)

### Delivery Service
- Finds available drivers
- Assigns driver to order
- Can be configured to have no drivers (NO_DRIVERS=true)

### Frontend
- Simple HTML form
- Sends orders to Order Service
- Displays confirmation

## Tech Stack

- **Node.js** - Runtime
- **Express** - Web framework
- **Axios** - HTTP client
- **Docker** - Containerization

## Ports

- `3000` - Order Service
- `3001` - Kitchen Service
- `3002` - Delivery Service
- `8080` - Frontend
