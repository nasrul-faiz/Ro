-- Machines table
CREATE TABLE IF NOT EXISTS machines (
  id SERIAL PRIMARY KEY,
  value VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  shift VARCHAR(10) DEFAULT 'AM',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product master table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(100) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  image VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Route location assignments
CREATE TABLE IF NOT EXISTS route_locations (
  id SERIAL PRIMARY KEY,
  route_id VARCHAR(50) NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(route_id, location_code)
);

-- Refill data table (stores inventory per machine)
CREATE TABLE IF NOT EXISTS refill_items (
  id SERIAL PRIMARY KEY,
  machine_id VARCHAR(50) NOT NULL,
  slot VARCHAR(50) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  image VARCHAR(500),
  stock_in INTEGER DEFAULT 0,
  overflow INTEGER DEFAULT 0,
  stock_out INTEGER DEFAULT 0,
  current_inventory INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(machine_id, slot)
);

-- Delivery Orders table
CREATE TABLE IF NOT EXISTS delivery_orders (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  machine_id VARCHAR(50) NOT NULL,
  machine_label VARCHAR(255) NOT NULL,
  date VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Delivery Order Items table
CREATE TABLE IF NOT EXISTS delivery_order_items (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER NOT NULL,
  slot VARCHAR(50) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE CASCADE
);

-- Custom (user-defined) route location sort orders
CREATE TABLE IF NOT EXISTS custom_orders (
  id SERIAL PRIMARY KEY,
  route_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Items belonging to a saved custom order
CREATE TABLE IF NOT EXISTS custom_order_items (
  id SERIAL PRIMARY KEY,
  custom_order_id INTEGER NOT NULL,
  location_code VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (custom_order_id) REFERENCES custom_orders(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_product_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_route_locations_route_id ON route_locations(route_id);
CREATE INDEX IF NOT EXISTS idx_refill_items_machine_id ON refill_items(machine_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_code ON delivery_orders(code);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_machine_id ON delivery_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_delivery_order_items_delivery_order_id ON delivery_order_items(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_custom_orders_route_id ON custom_orders(route_id);
CREATE INDEX IF NOT EXISTS idx_custom_order_items_custom_order_id ON custom_order_items(custom_order_id);
