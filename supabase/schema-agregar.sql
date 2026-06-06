-- ============================================================
-- COMPLEMENTOS SCHEMA - EJECUTAR EN SUPABASE (SIN ELIMINAR NADA)
-- ============================================================

-- 1. AGREGAR CAMPOS FALTANTES A TABLA VENTAS
-- ============================================================
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado','pendiente','parcial','sin_cobrar'));
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta','mercadopago','paypal','otro'));
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS fecha_compra TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS historial_cambios JSONB DEFAULT '[]'::jsonb;

-- 2. TABLA: combos
-- ============================================================
CREATE TABLE IF NOT EXISTS combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  costo_total NUMERIC(10,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: combo_items
-- ============================================================
CREATE TABLE IF NOT EXISTS combo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  plataforma_id UUID NOT NULL REFERENCES plataformas(id) ON DELETE RESTRICT,
  tipo TEXT DEFAULT 'perfil' CHECK (tipo IN ('perfil','completa')),
  dias_duracion INTEGER DEFAULT 30,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: ventas_combo
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_combo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  costo_real NUMERIC(10,2) DEFAULT 0,
  ganancia NUMERIC(10,2) GENERATED ALWAYS AS (precio_venta - costo_real) STORED,
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa','vencida','cancelada')),
  estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado','pendiente','parcial')),
  metodo_pago TEXT DEFAULT 'efectivo',
  dias_restantes INTEGER,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: ventas_combo_items (relación entre venta_combo y perfiles/cuentas)
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_combo_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_combo_id UUID NOT NULL REFERENCES ventas_combo(id) ON DELETE CASCADE,
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  plataforma_id UUID REFERENCES plataformas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA: peliculas
-- ============================================================
CREATE TABLE IF NOT EXISTS peliculas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  genero TEXT,
  año INTEGER,
  drive_url TEXT,
  descripcion TEXT,
  imagen_url TEXT,
  costo_compra NUMERIC(10,2) DEFAULT 0,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  disponible BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA: ventas_peliculas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_peliculas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pelicula_id UUID NOT NULL REFERENCES peliculas(id) ON DELETE RESTRICT,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  metodo_pago TEXT DEFAULT 'efectivo',
  estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado','pendiente','parcial')),
  drive_url_enviada TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA: gaming_productos
-- ============================================================
CREATE TABLE IF NOT EXISTS gaming_productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pase_boyaah','diamantes','tarjeta','otro')),
  juego TEXT DEFAULT 'Free Fire',
  cantidad INTEGER DEFAULT 1,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  costo_compra NUMERIC(10,2) DEFAULT 0,
  stock_disponible INTEGER DEFAULT 0,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA: ventas_gaming
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas_gaming (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gaming_producto_id UUID NOT NULL REFERENCES gaming_productos(id) ON DELETE RESTRICT,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  cantidad INTEGER DEFAULT 1,
  id_juego_cliente TEXT,
  nombre_juego_cliente TEXT,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  costo_real NUMERIC(10,2) DEFAULT 0,
  ganancia NUMERIC(10,2) GENERATED ALWAYS AS (precio_venta - costo_real) STORED,
  metodo_pago TEXT DEFAULT 'efectivo',
  estado_pago TEXT DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado','pendiente','parcial')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABLA: pagos (registro detallado de todos los pagos)
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  venta_combo_id UUID REFERENCES ventas_combo(id) ON DELETE SET NULL,
  venta_pelicula_id UUID REFERENCES ventas_peliculas(id) ON DELETE SET NULL,
  venta_gaming_id UUID REFERENCES ventas_gaming(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  monto NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT NOT NULL,
  estado TEXT DEFAULT 'completado' CHECK (estado IN ('completado','pendiente','fallido')),
  referencia TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABLA: notificaciones_config (control de alertas por cliente)
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
  activas BOOLEAN DEFAULT true,
  tipo_alerta TEXT DEFAULT 'vencimiento' CHECK (tipo_alerta IN ('vencimiento','reportes','pagos','renovaciones','todas')),
  dias_anticipacion INTEGER DEFAULT 3,
  preferencia_contacto TEXT DEFAULT 'whatsapp' CHECK (preferencia_contacto IN ('whatsapp','email','ambos','ninguno')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_combos_activo ON combos(activo);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_ventas_combo_cliente ON ventas_combo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_combo_estado ON ventas_combo(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_combo_pago ON ventas_combo(estado_pago);
CREATE INDEX IF NOT EXISTS idx_peliculas_disponible ON peliculas(disponible);
CREATE INDEX IF NOT EXISTS idx_ventas_peliculas_cliente ON ventas_peliculas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_peliculas_pago ON ventas_peliculas(estado_pago);
CREATE INDEX IF NOT EXISTS idx_gaming_productos_activo ON gaming_productos(activo);
CREATE INDEX IF NOT EXISTS idx_ventas_gaming_cliente ON ventas_gaming(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_gaming_pago ON ventas_gaming(estado_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_cliente ON notificaciones_config(cliente_id);

-- ============================================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ============================================================
CREATE TRIGGER update_combos_updated_at BEFORE UPDATE ON combos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ventas_combo_updated_at BEFORE UPDATE ON ventas_combo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_peliculas_updated_at BEFORE UPDATE ON peliculas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ventas_peliculas_updated_at BEFORE UPDATE ON ventas_peliculas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gaming_productos_updated_at BEFORE UPDATE ON gaming_productos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ventas_gaming_updated_at BEFORE UPDATE ON ventas_gaming FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON pagos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notificaciones_config_updated_at BEFORE UPDATE ON notificaciones_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY - Habilitar nuevas tablas
-- ============================================================
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_combo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE peliculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_peliculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_gaming ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_config ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (authenticated)
CREATE POLICY "allow_all_authenticated" ON combos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON combo_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON ventas_combo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON ventas_combo_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON peliculas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON ventas_peliculas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON gaming_productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON ventas_gaming FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON notificaciones_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas anónimo
CREATE POLICY "allow_all_anon" ON combos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON combo_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON ventas_combo FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON ventas_combo_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON peliculas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON ventas_peliculas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON gaming_productos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON ventas_gaming FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON pagos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON notificaciones_config FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT 'Tablas y campos agregados exitosamente ✅' as resultado;
