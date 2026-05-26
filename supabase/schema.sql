-- ============================================================
-- STREAMING MANAGER - SCHEMA COMPLETO SUPABASE
-- Ejecutar en orden en el SQL Editor de Supabase
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: plataformas
-- ============================================================
CREATE TABLE IF NOT EXISTS plataformas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  icono TEXT,
  color TEXT DEFAULT '#0ea5e9',
  max_perfiles INTEGER DEFAULT 5,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  whatsapp TEXT,
  correo TEXT,
  notas TEXT,
  calidad INTEGER DEFAULT 5 CHECK (calidad >= 1 AND calidad <= 10),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  whatsapp TEXT,
  correo TEXT,
  notas TEXT,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','vencido','suspendido','pendiente')),
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cuentas (inventario/stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS cuentas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plataforma_id UUID REFERENCES plataformas(id) ON DELETE SET NULL,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  correo TEXT NOT NULL,
  contrasena TEXT NOT NULL,
  pin TEXT,
  tipo TEXT DEFAULT 'completa' CHECK (tipo IN ('completa','perfil_individual')),
  max_perfiles INTEGER DEFAULT 5,
  perfiles_disponibles INTEGER DEFAULT 5,
  perfiles_ocupados INTEGER DEFAULT 0,
  fecha_compra TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ,
  costo NUMERIC(10,2) DEFAULT 0,
  estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible','parcial','llena','vencida','reportada','suspendida')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: perfiles (de cada cuenta)
-- ============================================================
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE CASCADE,
  plataforma_id UUID REFERENCES plataformas(id) ON DELETE SET NULL,
  numero_perfil INTEGER NOT NULL,
  nombre_perfil TEXT,
  estado TEXT DEFAULT 'libre' CHECK (estado IN ('libre','ocupado','bloqueado','reportado')),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: ventas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  plataforma_id UUID REFERENCES plataformas(id) ON DELETE SET NULL,
  nombre_perfil_asignado TEXT,
  duracion_dias INTEGER NOT NULL DEFAULT 30,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  precio_venta NUMERIC(10,2) DEFAULT 0,
  costo_real NUMERIC(10,2) DEFAULT 0,
  ganancia NUMERIC(10,2) GENERATED ALWAYS AS (precio_venta - costo_real) STORED,
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa','vencida','en_garantia','repuesta','renovada','cancelada')),
  garantia_activa BOOLEAN DEFAULT true,
  dias_consumidos INTEGER DEFAULT 0,
  dias_restantes INTEGER,
  fecha_pausa TIMESTAMPTZ,
  total_dias_pausados INTEGER DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS reportes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  plataforma_id UUID REFERENCES plataformas(id) ON DELETE SET NULL,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'contrasena_cambiada','pantalla_llena','perfil_eliminado',
    'correo_cambiado','pin_cambiado','bloqueo','region_incorrecta',
    'cuenta_caida','error_plataforma','usuario_expulsado','otro'
  )),
  descripcion TEXT,
  evidencia TEXT,
  fecha_reporte TIMESTAMPTZ DEFAULT NOW(),
  fecha_falla TIMESTAMPTZ,
  dias_consumidos_al_fallo INTEGER DEFAULT 0,
  dias_restantes_al_fallo INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','solucionado','cancelado')),
  fecha_solucion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: reposiciones
-- ============================================================
CREATE TABLE IF NOT EXISTS reposiciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporte_id UUID REFERENCES reportes(id) ON DELETE SET NULL,
  venta_original_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  venta_nueva_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cuenta_anterior_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  cuenta_nueva_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  perfil_anterior_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  perfil_nuevo_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  dias_restantes INTEGER NOT NULL DEFAULT 0,
  dias_pausados INTEGER DEFAULT 0,
  fecha_falla TIMESTAMPTZ,
  fecha_reposicion TIMESTAMPTZ DEFAULT NOW(),
  nueva_fecha_vencimiento TIMESTAMPTZ,
  perdida NUMERIC(10,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: movimientos (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  entidad TEXT,
  entidad_id UUID,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: renovaciones
-- ============================================================
CREATE TABLE IF NOT EXISTS renovaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE SET NULL,
  perfil_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  plataforma_id UUID REFERENCES plataformas(id) ON DELETE SET NULL,
  dias_renovados INTEGER NOT NULL,
  fecha_anterior_vencimiento TIMESTAMPTZ,
  nueva_fecha_vencimiento TIMESTAMPTZ,
  precio_renovacion NUMERIC(10,2) DEFAULT 0,
  costo_real NUMERIC(10,2) DEFAULT 0,
  tipo TEXT DEFAULT 'mismo_perfil' CHECK (tipo IN ('mismo_perfil','nueva_cuenta','extension')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: configuracion
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave TEXT UNIQUE NOT NULL,
  valor TEXT,
  descripcion TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para mejor rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_vencimiento ON ventas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_perfiles_cuenta ON perfiles(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_cliente ON perfiles(cliente_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_estado ON perfiles(estado);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes(estado);
CREATE INDEX IF NOT EXISTS idx_reportes_cliente ON reportes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_cliente ON movimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_created ON movimientos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas(estado);
CREATE INDEX IF NOT EXISTS idx_cuentas_plataforma ON cuentas(plataforma_id);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_plataformas_updated_at BEFORE UPDATE ON plataformas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proveedores_updated_at BEFORE UPDATE ON proveedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cuentas_updated_at BEFORE UPDATE ON cuentas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_perfiles_updated_at BEFORE UPDATE ON perfiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ventas_updated_at BEFORE UPDATE ON ventas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reportes_updated_at BEFORE UPDATE ON reportes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCIÓN: crear perfiles automáticamente al insertar cuenta
-- ============================================================
CREATE OR REPLACE FUNCTION crear_perfiles_cuenta()
RETURNS TRIGGER AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..NEW.max_perfiles LOOP
    INSERT INTO perfiles (cuenta_id, plataforma_id, numero_perfil, nombre_perfil, estado)
    VALUES (NEW.id, NEW.plataforma_id, i, 'Perfil ' || i, 'libre');
  END LOOP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER crear_perfiles_al_insertar_cuenta
AFTER INSERT ON cuentas
FOR EACH ROW EXECUTE FUNCTION crear_perfiles_cuenta();

-- ============================================================
-- FUNCIÓN: actualizar perfiles_disponibles y ocupados en cuenta
-- ============================================================
CREATE OR REPLACE FUNCTION actualizar_conteo_perfiles()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cuentas SET
    perfiles_ocupados = (SELECT COUNT(*) FROM perfiles WHERE cuenta_id = COALESCE(NEW.cuenta_id, OLD.cuenta_id) AND estado = 'ocupado'),
    perfiles_disponibles = (SELECT COUNT(*) FROM perfiles WHERE cuenta_id = COALESCE(NEW.cuenta_id, OLD.cuenta_id) AND estado = 'libre'),
    estado = CASE
      WHEN (SELECT COUNT(*) FROM perfiles WHERE cuenta_id = COALESCE(NEW.cuenta_id, OLD.cuenta_id) AND estado = 'libre') = 0 THEN 'llena'
      WHEN (SELECT COUNT(*) FROM perfiles WHERE cuenta_id = COALESCE(NEW.cuenta_id, OLD.cuenta_id) AND estado = 'ocupado') > 0 THEN 'parcial'
      ELSE 'disponible'
    END
  WHERE id = COALESCE(NEW.cuenta_id, OLD.cuenta_id);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER actualizar_conteo_al_cambiar_perfil
AFTER INSERT OR UPDATE OR DELETE ON perfiles
FOR EACH ROW EXECUTE FUNCTION actualizar_conteo_perfiles();

-- ============================================================
-- DATOS INICIALES: Plataformas
-- ============================================================
INSERT INTO plataformas (nombre, icono, color, max_perfiles, descripcion) VALUES
('Netflix', '🎬', '#E50914', 5, 'Servicio de streaming de películas y series'),
('Disney+', '✨', '#113CCF', 7, 'Contenido Disney, Marvel, Star Wars, Pixar'),
('HBO Max', '🎭', '#5822B4', 5, 'HBO, Warner Bros, DC'),
('Amazon Prime Video', '📦', '#00A8E1', 6, 'Amazon Prime Video'),
('Spotify', '🎵', '#1DB954', 6, 'Música y podcasts'),
('YouTube Premium', '▶️', '#FF0000', 6, 'YouTube sin anuncios + YouTube Music'),
('Paramount+', '⭐', '#0064FF', 6, 'Paramount, MTV, Nickelodeon'),
('Crunchyroll', '⚔️', '#F47521', 4, 'Anime y manga'),
('Apple TV+', '🍎', '#000000', 6, 'Contenido original Apple'),
('IPTV', '📡', '#6366f1', 1, 'Televisión por internet')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DATOS INICIALES: Configuración
-- ============================================================
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('dias_alerta_vencimiento', '3', 'Días antes del vencimiento para mostrar alerta'),
('moneda', 'MXN', 'Moneda del sistema'),
('negocio_nombre', 'StreamingAby', 'Nombre del negocio'),
('notificaciones_email', 'false', 'Activar notificaciones por email')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Habilitar para todas las tablas
-- ============================================================
ALTER TABLE plataformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE renovaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (ajustar según necesidad)
-- Por ahora permitir todo para usuarios autenticados
CREATE POLICY "allow_all_authenticated" ON plataformas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON cuentas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON perfiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON reportes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON reposiciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON movimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON renovaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON configuracion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- También permitir acceso anónimo (para desarrollo - quitar en producción)
CREATE POLICY "allow_all_anon" ON plataformas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON proveedores FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON cuentas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON perfiles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON ventas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON reportes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON reposiciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON movimientos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON renovaciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon" ON configuracion FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT 'Schema creado exitosamente' as resultado;
