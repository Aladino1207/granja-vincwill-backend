require('dotenv').config();
const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { Sequelize, DataTypes, Transaction } = require('sequelize');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = new Hono();

// Configuración de CORS
app.use('*', cors({
  origin: ['https://granja-vincwill-frontend.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
  credentials: true
}));

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectModule: require('pg'),
  logging: (msg) => console.log('SQL:', msg), // Depuración
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: true }, // Usa certificados válidos
    keepAlive: true,
    connectTimeout: 30000, // 30 segundos
    socketTimeout: 30000  // 30 segundos
  },
  pool: {
    max: 5, // Aumenta a 5 conexiones
    min: 0,
    acquire: 30000, // 30 segundos
    idle: 10000, // 10 segundos
    evict: 10000 // 10 segundos
  },
  retry: {
    match: [/SequelizeConnectionError/, /Connection terminated unexpectedly/, /ETIMEDOUT/, /timeout/],
    max: 3, // 3 reintentos
    backoffBase: 2000, // 2 segundos iniciales
    backoffExponent: 1.5
  },
  define: {
    hooks: {
      beforeDefine: (attributes) => {
        Object.keys(attributes).forEach((key) => {
          if (attributes[key].type === DataTypes.HSTORE) {
            throw new Error('HSTORE is not supported in this configuration');
          }
        });
      }
    },
    timestamps: true
  }
});

// Definir modelos (sin cambios)
const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false }
});

const Lote = sequelize.define('Lote', {
  loteId: { type: DataTypes.STRING, unique: true, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  pesoInicial: { type: DataTypes.FLOAT, allowNull: false },
  fechaIngreso: { type: DataTypes.DATE, allowNull: false },
  estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'disponible' }
}, { timestamps: true });

const Seguimiento = sequelize.define('Seguimiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  semana: { type: DataTypes.INTEGER, allowNull: false },
  peso: { type: DataTypes.FLOAT, allowNull: false },
  consumo: { type: DataTypes.FLOAT, allowNull: false },
  observaciones: { type: DataTypes.TEXT },
  fecha: { type: DataTypes.DATE }
});

const Salud = sequelize.define('Salud', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  tipo: { type: DataTypes.STRING, allowNull: false },
  nombre: { type: DataTypes.STRING, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Costo = sequelize.define('Costo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  categoria: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
}, { tableName: 'Costos', timestamps: true });

const Venta = sequelize.define('Venta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  cantidadVendida: { type: DataTypes.INTEGER, allowNull: false },
  peso: { type: DataTypes.FLOAT, allowNull: false },
  precio: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false },
  cliente: { type: DataTypes.STRING, allowNull: true }
});

const Inventario = sequelize.define('Inventario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: false },
  cantidad: { type: DataTypes.FLOAT, allowNull: false },
  costo: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Config = sequelize.define('Config', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  notificaciones: { type: DataTypes.STRING, allowNull: false },
  idioma: { type: DataTypes.STRING, allowNull: false },
  nombreGranja: { type: DataTypes.STRING, allowNull: false },
  vacunasGallinas: { type: DataTypes.TEXT }
});

// Definir relaciones (sin cambios)
Lote.hasMany(Seguimiento, { foreignKey: 'loteId' });
Seguimiento.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Salud, { foreignKey: 'loteId' });
Salud.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Costo, { foreignKey: 'loteId' });
Costo.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Venta, { foreignKey: 'loteId' });
Venta.belongsTo(Lote, { foreignKey: 'loteId' });

// Sincronizar base de datos (sin cambios)
(async () => {
  let retryCount = 0;
  const maxRetries = 5; // Aumenta a 5 reintentos
  while (retryCount < maxRetries) {
    try {
      await sequelize.authenticate();
      console.log('Conexión a la base de datos establecida');
      await sequelize.sync({ alter: true });
      console.log('Base de datos sincronizada con PostgreSQL');
      break;
    } catch (error) {
      retryCount++;
      console.error(`Intento ${retryCount}/${maxRetries}:`, error.message);
      if (retryCount === maxRetries) {
        console.error('Falló la conexión después de reintentos máximos.');
        throw error; // Lanza el error para que el worker falle y se reinicie
      }
      await new Promise(resolve => setTimeout(resolve, 5000 * Math.pow(1.5, retryCount)));
    }
  }

  try {
    const user = await User.findOne({ where: { email: 'admin@example.com' } });
    if (!user) {
      const hashedPassword = bcryptjs.hashSync('admin123', 10);
      await User.create({
        name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Usuario admin creado');
    } else {
      console.log('Usuario admin encontrado, forzando actualización de rol...');
      await user.update({
        role: 'admin',
        password: bcryptjs.hashSync('admin123', 10)
      });
      console.log('Usuario admin actualizado');
    }
    const config = await Config.findOne();
    if (!config) {
      await Config.create({
        notificaciones: 'Activadas',
        idioma: 'Español',
        nombreGranja: 'Granja Avícola VincWill',
        vacunasGallinas: ''
      });
      console.log('Configuración inicial creada');
    }
  } catch (error) {
    console.error('Error al crear datos iniciales:', error);
  }
})();

// Middleware de autenticación (ajustado para manejar timeouts)
app.use('*', async (c, next) => {
  if (c.req.path === '/' || c.req.path === '/login') {
    await next();
    return;
  }

  const token = c.req.header('Authorization')?.split(' ')[1];
  console.log('Token recibido:', token);
  if (!token) {
    return c.json({ error: 'Token requerido' }, 401);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 10, timeout: 5000 });
    console.log('Token decodificado:', decoded);
    c.set('user', decoded);
    await next();
  } catch (error) {
    console.error('Error al verificar token:', error.message);
    if (error.name === 'TokenExpiredError' || error.message.includes('timeout')) {
      return c.json({ error: 'Token expirado o tiempo de espera agotado' }, 401);
    }
    return c.json({ error: 'Token inválido' }, 401);
  }
});

// Ruta raíz (sin cambios)
app.get('/', (c) => c.json({ 
  message: '¡Bienvenido a la API de Granja Avícola VincWill! Usa /login para autenticarte.' 
}));

// Endpoint de login (sin cambios)
app.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  console.log('Intentando login con email:', email);
  let retryCount = 0;
  const maxRetries = 3;
  while (retryCount < maxRetries) {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user || !bcryptjs.compareSync(password, user.password)) {
        console.log('Credenciales inválidas para email:', email);
        return c.json({ error: 'Credenciales inválidas' }, 401);
      }
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      console.log('Login exitoso para usuario:', email);
      return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      retryCount++;
      console.error(`Intento ${retryCount}/${maxRetries} de login:`, error.message);
      if (retryCount === maxRetries) {
        return c.json({ error: 'Tiempo de espera agotado al autenticar' }, 503);
      }
      if (error.name === 'SequelizeConnectionAcquireTimeoutError') {
        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
      } else {
        return c.json({ error: 'Error en el servidor: ' + error.message }, 500);
      }
    }
  }
});

// Endpoint para crear usuario admin (sin cambios)
app.post('/create-admin', async (c) => {
  try {
    const hashedPassword = bcryptjs.hashSync('admin123', 10);
    const user = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin'
    });
    return c.json({ message: 'Usuario admin creado', user }, 201);
  } catch (error) {
    return c.json({ error: 'Error al crear usuario: ' + error.message }, 500);
  }
});

// Endpoint para reportes (ajustado con timeout)
app.post('/reporte', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  const { tipoReporte, loteId, fechaInicio, fechaFin } = await c.req.json();
  try {
    let data = [];
    const whereClause = {
      fecha: {
        [Sequelize.Op.between]: [new Date(fechaInicio), new Date(fechaFin)]
      }
    };
    if (loteId) whereClause.loteId = loteId;

    const options = { timeout: 5000 }; // Limita el tiempo de consulta

    switch (tipoReporte) {
      case 'produccion':
        const seguimiento = await Seguimiento.findAll({ where: whereClause, include: [{ model: Lote }], ...options });
        data = seguimiento.map(s => ({
          loteId: s.Lote.loteId,
          semana: s.semana,
          pesoPromedio: s.peso,
          consumoDiario: (s.consumo / 7).toFixed(2),
          fecha: s.fecha.toISOString().split('T')[0]
        }));
        const totalPeso = seguimiento.reduce((sum, s) => sum + s.peso, 0);
        const avgPeso = data.length ? (totalPeso / data.length).toFixed(2) : 0;
        data.push({ loteId: 'Total', semana: '', pesoPromedio: avgPeso, consumoDiario: '', fecha: '' });
        break;
      // Resto de casos sin cambios, pero con options aplicado
      case 'costos':
        const costos = await Costo.findAll({ where: whereClause, include: [{ model: Lote }], ...options });
        data = costos.map(c => ({
          loteId: c.Lote.loteId,
          categoria: c.categoria,
          descripcion: c.descripcion,
          monto: `$${c.monto.toFixed(2)}`,
          fecha: c.fecha.toISOString().split('T')[0]
        }));
        const totalCostos = costos.reduce((sum, c) => sum + c.monto, 0);
        data.push({ loteId: 'Total', categoria: '', descripcion: '', monto: `$${totalCostos.toFixed(2)}`, fecha: '' });
        break;
      case 'ventas':
        const ventas = await Venta.findAll({ where: whereClause, include: [{ model: Lote }], ...options });
        data = ventas.map(v => ({
          loteId: v.Lote.loteId,
          cantidadVendida: v.cantidadVendida,
          pesoTotal: `${v.peso.toFixed(2)} kg`,
          precioTotal: `$${((v.peso || 0) * v.precio).toFixed(2)}`,
          fecha: v.fecha.toISOString().split('T')[0],
          cliente: v.cliente || 'No especificado'
        }));
        const totalIngresos = ventas.reduce((sum, v) => sum + (v.peso * v.precio), 0);
        data.push({ loteId: 'Total', cantidadVendida: '', pesoTotal: '', precioTotal: `$${totalIngresos.toFixed(2)}`, fecha: '', cliente: '' });
        break;
      case 'sanitario':
        const salud = await Salud.findAll({ where: whereClause, include: [{ model: Lote }], ...options });
        data = salud.map(s => ({
          loteId: s.Lote.loteId,
          tipo: s.tipo,
          nombre: s.nombre,
          cantidad: s.cantidad,
          fecha: s.fecha.toISOString().split('T')[0],
          impacto: s.tipo === 'Mortalidad' ? 'Alto' : 'Bajo'
        }));
        const totalEventos = salud.length;
        data.push({ loteId: 'Total', tipo: '', nombre: '', cantidad: totalEventos, fecha: '', impacto: '' });
        break;
      case 'seguimiento':
        const seguimientoAll = await Seguimiento.findAll({ where: whereClause, include: [{ model: Lote }], ...options });
        data = seguimientoAll.map(s => ({
          loteId: s.Lote.loteId,
          semana: s.semana,
          pesoPromedio: s.peso,
          consumoTotal: s.consumo.toFixed(2),
          fecha: s.fecha.toISOString().split('T')[0]
        }));
        const avgPesoSeguimiento = seguimientoAll.length ? (seguimientoAll.reduce((sum, s) => sum + s.peso, 0) / seguimientoAll.length).toFixed(2) : 0;
        data.push({ loteId: 'Promedio', semana: '', pesoPromedio: avgPesoSeguimiento, consumoTotal: '', fecha: '' });
        break;
      default:
        return c.json({ error: 'Tipo de reporte no válido' }, 400);
    }
    return c.json(data);
  } catch (error) {
    console.error('Error al generar reporte:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar la base de datos' }, 503);
    }
    return c.json({ error: 'Error al generar reporte: ' + error.message }, 500);
  }
});

// Endpoints CRUD para User (sin cambios)
app.get('/users', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const users = await User.findAll();
    return c.json(users);
  } catch (error) {
    return c.json({ error: 'Error al obtener usuarios' }, 500);
  }
});

app.post('/users', async (c) => {
  const user = c.get('user');
  if (user?.role !== 'admin') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { name, email, password, role } = await c.req.json();
    const hashedPassword = bcryptjs.hashSync(password, 10);
    const newUser = await User.create({ name, email, password: hashedPassword, role });
    return c.json(newUser, 201);
  } catch (error) {
    return c.json({ error: 'Error al crear usuario' }, 500);
  }
});

app.put('/users/:id', async (c) => {
  const user = c.get('user');
  if (user?.role !== 'admin') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const userData = await User.findByPk(id);
    if (!userData) return c.json({ error: 'Usuario no encontrado' }, 404);
    const body = await c.req.json();
    if (body.password) body.password = bcryptjs.hashSync(body.password, 10);
    await userData.update(body);
    return c.json(userData);
  } catch (error) {
    return c.json({ error: 'Error al actualizar usuario' }, 500);
  }
});

// Endpoints CRUD para Lote (ajustado con timeout)
app.get('/lotes', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const lotes = await Lote.findAll({ timeout: 5000 });
    return c.json(lotes);
  } catch (error) {
    console.error('Error al obtener lotes:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar lotes' }, 503);
    }
    return c.json({ error: 'Error al obtener lotes' }, 500);
  }
});

app.post('/lotes', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { loteId, cantidad, pesoInicial, fechaIngreso, estado } = await c.req.json();
    console.log('Datos recibidos para crear lote:', { loteId, cantidad, pesoInicial, fechaIngreso, estado });
    if (!loteId || !cantidad || !pesoInicial || !fechaIngreso) {
      return c.json({ error: 'Faltan campos obligatorios (loteId, cantidad, pesoInicial, fechaIngreso)' }, 400);
    }
    const lote = await Lote.create({
      id: null,
      loteId,
      cantidad: parseInt(cantidad),
      pesoInicial: parseFloat(pesoInicial),
      fechaIngreso: new Date(fechaIngreso),
      estado: estado || 'disponible'
    }, { timeout: 5000 });
    console.log('Lote creado:', lote.toJSON());
    return c.json(lote, 201);
  } catch (error) {
    console.error('Error al crear lote:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear lote' }, 503);
    }
    return c.json({ error: 'Error al crear lote: ' + error.message }, 500);
  }
});

app.put('/lotes/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const lote = await Lote.findByPk(id, { timeout: 5000 });
    if (!lote) return c.json({ error: 'Lote no encontrado' }, 404);
    await lote.update(await c.req.json(), { timeout: 5000 });
    return c.json(lote);
  } catch (error) {
    console.error('Error al actualizar lote:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al actualizar lote' }, 503);
    }
    return c.json({ error: 'Error al actualizar lote' }, 500);
  }
});

app.delete('/lotes/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const lote = await Lote.findByPk(id, { timeout: 5000 });
    if (!lote) return c.json({ error: 'Lote no encontrado' }, 404);
    await lote.destroy({ timeout: 5000 });
    return c.status(204);
  } catch (error) {
    console.error('Error al eliminar lote:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al eliminar lote' }, 503);
    }
    return c.json({ error: 'Error al eliminar lote' }, 500);
  }
});

// Endpoints CRUD para Seguimiento (ajustado con timeout)
app.get('/seguimiento', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const seguimiento = await Seguimiento.findAll({ timeout: 5000 });
    return c.json(seguimiento);
  } catch (error) {
    console.error('Error al obtener seguimiento:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar seguimiento' }, 503);
    }
    return c.json({ error: 'Error al obtener seguimiento' }, 500);
  }
});

app.post('/seguimiento', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { loteId, semana, peso, consumo, observaciones, fecha } = await c.req.json();
    if (!loteId || !semana || !peso || !consumo || !fecha) {
      return c.json({ error: 'Faltan campos obligatorios' }, 400);
    }
    const seguimiento = await Seguimiento.create({
      loteId: parseInt(loteId),
      semana: parseInt(semana),
      peso: parseFloat(peso),
      consumo: parseFloat(consumo),
      observaciones: observaciones || null,
      fecha: new Date(fecha)
    }, { timeout: 5000 });
    return c.json(seguimiento, 201);
  } catch (error) {
    console.error('Error al crear seguimiento: ', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear seguimiento' }, 503);
    }
    return c.json({ error: 'Error al crear seguimiento: ' + error.message }, 500);
  }
});

app.get('/seguimiento/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const { id } = c.req.param();
    const seguimiento = await Seguimiento.findByPk(id, { timeout: 5000 });
    if (!seguimiento) return c.json({ error: 'Seguimiento no encontrado' }, 404);
    return c.json(seguimiento);
  } catch (error) {
    console.error('Error al obtener seguimiento: ', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar seguimiento' }, 503);
    }
    return c.json({ error: 'Error al obtener seguimiento: ' + error.message }, 500);
  }
});

app.put('/seguimiento/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const { loteId, semana, peso, consumo, observaciones, fecha } = await c.req.json();
    const seguimiento = await Seguimiento.findByPk(id, { timeout: 5000 });
    if (!seguimiento) return c.json({ error: 'Seguimiento no encontrado' }, 404);
    await seguimiento.update({
      loteId: loteId !== undefined ? parseInt(loteId) : seguimiento.loteId,
      semana: semana !== undefined ? parseInt(semana) : seguimiento.semana,
      peso: peso !== undefined ? parseFloat(peso) : seguimiento.peso,
      consumo: consumo !== undefined ? parseFloat(consumo) : seguimiento.consumo,
      observaciones: observaciones || seguimiento.observaciones,
      fecha: fecha ? new Date(fecha) : seguimiento.fecha
    }, { timeout: 5000 });
    return c.json(seguimiento);
  } catch (error) {
    console.error('Error al actualizar seguimiento: ', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al actualizar seguimiento' }, 503);
    }
    return c.json({ error: 'Error al actualizar seguimiento: ' + error.message }, 500);
  }
});

app.delete('/seguimiento/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const seguimiento = await Seguimiento.findByPk(id, { timeout: 5000 });
    if (!seguimiento) return c.json({ error: 'Seguimiento no encontrado' }, 404);
    await seguimiento.destroy({ timeout: 5000 });
    return c.status(204);
  } catch (error) {
    console.error('Error al eliminar seguimiento: ', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al eliminar seguimiento' }, 503);
    }
    return c.json({ error: 'Error al eliminar seguimiento: ' + error.message }, 500);
  }
});

// Endpoints CRUD para Salud (ajustado con timeout)
app.get('/salud', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const salud = await Salud.findAll({ timeout: 5000 });
    console.log('Datos de /salud enviados:', salud);
    return c.json(salud);
  } catch (error) {
    console.error('Error al obtener salud:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar salud' }, 503);
    }
    return c.json({ error: 'Error al obtener salud' }, 500);
  }
});

app.post('/salud', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { loteId, tipo, nombre, cantidad, fecha } = await c.req.json();
    console.log('Solicitud POST /salud recibida:', { loteId, tipo, nombre, cantidad, fecha });
    if (!loteId || !tipo || !nombre || !cantidad || !fecha) {
      return c.json({ error: 'Faltan campos obligatorios' }, 400);
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      return c.json({ error: 'Cantidad debe ser un número positivo' }, 400);
    }
    const salud = await Salud.create({ loteId, tipo, nombre, cantidad, fecha }, { timeout: 5000 });
    console.log('Evento de salud creado:', salud.toJSON());
    return c.json(salud, 201);
  } catch (error) {
    console.error('Error al crear evento de salud:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear evento de salud' }, 503);
    }
    return c.json({ error: 'Error al crear evento de salud: ' + error.message }, 500);
  }
});

app.get('/salud/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const { id } = c.req.param();
    const salud = await Salud.findByPk(id, { timeout: 5000 });
    if (!salud) return c.json({ error: 'Evento de salud no encontrado' }, 404);
    return c.json(salud);
  } catch (error) {
    console.error('Error al obtener evento de salud por id:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar evento de salud' }, 503);
    }
    return c.json({ error: 'Error al obtener evento de salud: ' + error.message }, 500);
  }
});

app.put('/salud/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const { loteId, tipo, nombre, cantidad, fecha } = await c.req.json();
    const salud = await Salud.findByPk(id, { timeout: 5000 });
    if (!salud) return c.json({ error: 'Evento de salud no encontrado' }, 404);
    if (isNaN(cantidad) || cantidad <= 0) {
      return c.json({ error: 'Cantidad debe ser un número positivo' }, 400);
    }
    await salud.update({
      loteId: loteId || salud.loteId,
      tipo: tipo || salud.tipo,
      nombre: nombre || salud.nombre,
      cantidad: quantity !== undefined ? parseFloat(cantidad) : salud.cantidad,
      fecha: fecha || salud.fecha
    }, { timeout: 5000 });
    console.log('Evento de salud actualizado:', salud.toJSON());
    return c.json(salud);
  } catch (error) {
    console.error('Error al actualizar evento de salud:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al actualizar evento de salud' }, 503);
    }
    return c.json({ error: 'Error al actualizar evento de salud: ' + error.message }, 500);
  }
});

app.delete('/salud/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const { id } = c.req.param();
    const salud = await Salud.findByPk(id, { timeout: 5000 });
    if (!salud) return c.json({ error: 'Evento de salud no encontrado' }, 404);
    await salud.destroy({ timeout: 5000 });
    console.log('Evento de salud eliminado:', id);
    return c.status(204);
  } catch (error) {
    console.error('Error al eliminar evento de salud:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al eliminar evento de salud' }, 503);
    }
    return c.json({ error: 'Error al eliminar evento de salud: ' + error.message }, 500);
  }
});

// Endpoints CRUD para Costos (ajustado con timeout)
app.get('/costos', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const costos = await Costo.findAll({ timeout: 5000 });
    return c.json(costos);
  } catch (error) {
    console.error('Error al obtener costos:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar costos' }, 503);
    }
    return c.json({ error: 'Error al obtener costos' }, 500);
  }
});

app.post('/costos', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { loteId, categoria, descripcion, monto, fecha } = await c.req.json();
    console.log('Solicitud POST /costos recibida:', { loteId, categoria, descripcion, monto, fecha });
    if (!loteId || !categoria || !descripcion || !monto || !fecha) {
      return c.json({ error: 'Faltan campos obligatorios' }, 400);
    }
    const lote = await Lote.findByPk(loteId, { timeout: 5000 });
    if (!lote) {
      return c.json({ error: 'Lote no encontrado' }, 400);
    }
    const costo = await Costo.create({
      loteId: parseInt(loteId),
      categoria,
      descripcion,
      monto: parseFloat(monto),
      fecha: new Date(fecha)
    }, { timeout: 5000 });
    console.log('Costo creado:', costo.toJSON());
    return c.json(costo, 201);
  } catch (error) {
    console.error('Error al crear costo:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear costo' }, 503);
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      return c.json({ error: 'Registro duplicado' }, 400);
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
      return c.json({ error: 'Lote no válido' }, 400);
    }
    return c.json({ error: 'Error al crear costo: ' + error.message }, 500);
  }
});

// Endpoints CRUD para Ventas (ajustado con timeout)
app.get('/ventas', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const ventas = await Venta.findAll({ timeout: 5000 });
    return c.json(ventas);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar ventas' }, 503);
    }
    return c.json({ error: 'Error al obtener ventas' }, 500);
  }
});

app.post('/ventas', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { loteId, cantidadVendida, peso, precio, fecha, cliente } = await c.req.json();
    console.log('Solicitud POST /ventas recibida:', { loteId, cantidadVendida, peso, precio, fecha, cliente });
    if (!loteId || !cantidadVendida || !peso || !precio || !fecha) {
      return c.json({ error: 'Faltan campos obligatorios' }, 400);
    }
    const lote = await Lote.findByPk(loteId, { timeout: 5000 });
    if (!lote) {
      return c.json({ error: 'Lote no encontrado' }, 404);
    }
    if (lote.estado !== 'disponible' || lote.cantidad < cantidadVendida) {
      return c.json({ error: 'Lote no disponible o cantidad insuficiente' }, 400);
    }
    const result = await sequelize.transaction(async (t) => {
      const venta = await Venta.create(
        { loteId, cantidadVendida, peso, precio, fecha, cliente },
        { transaction: t, timeout: 5000 }
      );
      await lote.update(
        {
          cantidad: lote.cantidad - cantidadVendida,
          estado: lote.cantidad - cantidadVendida > 0 ? 'disponible' : 'vendido'
        },
        { transaction: t, timeout: 5000 }
      );
      return venta;
    });
    console.log('Venta creada y lote actualizado:', result.toJSON());
    return c.json(result, 201);
  } catch (error) {
    console.error('Error al crear venta:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear venta' }, 503);
    }
    return c.json({ error: 'Error al crear venta: ' + error.message }, 500);
  }
});

app.get('/ventas/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const { id } = c.req.param();
    const venta = await Venta.findByPk(id, { timeout: 5000 });
    if (!venta) return c.json({ error: 'Venta no encontrada' }, 404);
    return c.json(venta);
  } catch (error) {
    console.error('Error al obtener venta por id:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar venta' }, 503);
    }
    return c.json({ error: 'Error al obtener venta: ' + error.message }, 500);
  }
});

app.put('/ventas/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const { loteId, cantidadVendida, peso, precio, fecha, cliente } = await c.req.json();
    const venta = await Venta.findByPk(id, { timeout: 5000 });
    if (!venta) return c.json({ error: 'Venta no encontrada' }, 404);
    const lote = await Lote.findByPk(loteId || venta.loteId, { timeout: 5000 });
    if (!lote) return c.json({ error: 'Lote no encontrado' }, 404);
    const diferencia = (cantidadVendida || venta.cantidadVendida) - venta.cantidadVendida;
    await sequelize.transaction(async (t) => {
      await venta.update({
        loteId: loteId || venta.loteId,
        cantidadVendida: cantidadVendida !== undefined ? parseInt(cantidadVendida) : venta.cantidadVendida,
        peso: peso !== undefined ? parseFloat(peso) : venta.peso,
        precio: precio !== undefined ? parseFloat(precio) : venta.precio,
        fecha: fecha || venta.fecha,
        cliente: cliente || venta.cliente
      }, { transaction: t, timeout: 5000 });
      if (diferencia !== 0 && loteId === venta.loteId) {
        await lote.update({
          cantidad: lote.cantidad + diferencia,
          estado: (lote.cantidad + diferencia) > 0 ? 'disponible' : 'vendido'
        }, { transaction: t, timeout: 5000 });
      }
    });
    console.log('Venta actualizada:', venta.toJSON());
    return c.json(venta);
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al actualizar venta' }, 503);
    }
    return c.json({ error: 'Error al actualizar venta: ' + error.message }, 500);
  }
});

app.delete('/ventas/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const venta = await Venta.findByPk(id, { timeout: 5000 });
    if (!venta) return c.json({ error: 'Venta no encontrada' }, 404);
    const lote = await Lote.findByPk(venta.loteId, { timeout: 5000 });
    if (!lote) return c.json({ error: 'Lote asociado no encontrado' }, 500);
    await sequelize.transaction(async (t) => {
      await venta.destroy({ transaction: t, timeout: 5000 });
      await lote.update({
        cantidad: lote.cantidad + venta.cantidadVendida,
        estado: lote.cantidad + venta.cantidadVendida > 0 ? 'disponible' : 'vendido'
      }, { transaction: t, timeout: 5000 });
    });
    console.log('Venta eliminada y lote actualizado:', id);
    return c.status(204);
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al eliminar venta' }, 503);
    }
    return c.json({ error: 'Error al eliminar venta: ' + error.message }, 500);
  }
});

// Endpoints CRUD para Inventario (ajustado con timeout)
app.get('/inventario', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const inventario = await Inventario.findAll({ timeout: 5000 });
    return c.json(inventario);
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar inventario' }, 503);
    }
    return c.json({ error: 'Error al obtener inventario' }, 500);
  }
});

app.get('/inventario/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const { id } = c.req.param();
    const inventario = await Inventario.findByPk(id, { timeout: 5000 });
    if (!inventario) return c.json({ error: 'Inventario no encontrado' }, 404);
    console.log('Inventario recuperado con id:', id, inventario.toJSON());
    return c.json(inventario);
  } catch (error) {
    console.error('Error al obtener inventario por id:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar inventario' }, 503);
    }
    return c.json({ error: 'Error al obtener inventario: ' + error.message }, 500);
  }
});

app.post('/inventario', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { producto, categoria, cantidad, costo, fecha } = await c.req.json();
    console.log('Solicitud POST /inventario recibida:', { producto, categoria, cantidad, costo, fecha });
    if (!producto || !categoria || !cantidad || !costo || !fecha) {
      return c.json({ error: 'Faltan campos obligatorios (producto, categoria, cantidad, costo, fecha)' }, 400);
    }
    const inventario = await Inventario.create({
      producto,
      categoria,
      cantidad: parseFloat(cantidad),
      costo: parseFloat(costo),
      fecha: new Date(fecha)
    }, { timeout: 5000 });
    console.log('Inventario creado:', inventario.toJSON());
    return c.json(inventario, 201);
  } catch (error) {
    console.error('Error al crear inventario:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear inventario' }, 503);
    }
    return c.json({ error: 'Error al crear inventario: ' + error.message }, 500);
  }
});

app.put('/inventario/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const { producto, categoria, cantidad, costo, fecha } = await c.req.json();
    const inventario = await Inventario.findByPk(id, { timeout: 5000 });
    if (!inventario) return c.json({ error: 'Inventario no encontrado' }, 404);
    await inventario.update({
      producto: producto || inventario.producto,
      categoria: categoria || inventario.categoria,
      cantidad: cantidad !== undefined ? parseFloat(cantidad) : inventario.cantidad,
      costo: costo !== undefined ? parseFloat(costo) : inventario.costo,
      fecha: fecha ? new Date(fecha) : inventario.fecha
    }, { timeout: 5000 });
    console.log('Inventario actualizado:', inventario.toJSON());
    return c.json(inventario);
  } catch (error) {
    console.error('Error al actualizar inventario:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al actualizar inventario' }, 503);
    }
    return c.json({ error: 'Error al actualizar inventario: ' + error.message }, 500);
  }
});

app.delete('/inventario/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const inventario = await Inventario.findByPk(id, { timeout: 5000 });
    if (!inventario) return c.json({ error: 'Inventario no encontrado' }, 404);
    await inventario.destroy({ timeout: 5000 });
    console.log('Inventario eliminado con id:', id);
    return c.status(204);
  } catch (error) {
    console.error('Error al eliminar inventario:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al eliminar inventario' }, 503);
    }
    return c.json({ error: 'Error al eliminar inventario: ' + error.message }, 500);
  }
});

// Endpoints CRUD para Config (ajustado con timeout)
app.get('/config', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const config = await Config.findAll({ timeout: 5000 });
    return c.json(config);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar configuración' }, 503);
    }
    return c.json({ error: 'Error al obtener configuración' }, 500);
  }
});

app.post('/config', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const existingConfig = await Config.findOne({ timeout: 5000 });
    if (existingConfig) {
      await existingConfig.update(await c.req.json(), { timeout: 5000 });
      return c.json(existingConfig);
    } else {
      const config = await Config.create(await c.req.json(), { timeout: 5000 });
      return c.json(config, 201);
    }
  } catch (error) {
    console.error('Error al crear/actualizar configuración:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al crear/actualizar configuración' }, 503);
    }
    return c.json({ error: 'Error al crear/actualizar configuración' }, 500);
  }
});

app.get('/config/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autorizado' }, 403);
  try {
    const { id } = c.req.param();
    const config = await Config.findByPk(id, { timeout: 5000 });
    if (!config) return c.json({ error: 'Configuración no encontrada' }, 404);
    return c.json(config);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al consultar configuración' }, 503);
    }
    return c.json({ error: 'Error al obtener configuración' }, 500);
  }
});

app.delete('/config/:id', async (c) => {
  const user = c.get('user');
  if (user?.role === 'viewer') return c.json({ error: 'Acceso denegado' }, 403);
  try {
    const { id } = c.req.param();
    const config = await Config.findByPk(id, { timeout: 5000 });
    if (!config) return c.json({ error: 'Configuración no encontrada' }, 404);
    await config.destroy({ timeout: 5000 });
    return c.status(204);
  } catch (error) {
    console.error('Error al eliminar configuración:', error);
    if (error.name === 'SequelizeConnectionAcquireTimeoutError' || error.message.includes('timeout')) {
      return c.json({ error: 'Tiempo de espera agotado al eliminar configuración' }, 503);
    }
    return c.json({ error: 'Error al eliminar configuración' }, 500);
  }
});

export default app; 