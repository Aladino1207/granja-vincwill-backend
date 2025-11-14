//const API_URL = 'https://granja-vincwill-backend.onrender.com';

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Configuración de CORS (asumiendo que tienes una configuración)
app.use(cors({
  origin: '*', // O sé más específico con tu URL de Vercel
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_123';
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Desactivar logs de SQL en producción
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

// --- 1. DEFINICIÓN DE MODELOS (ORDENADOS) ---

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false } // 'admin', 'empleado', 'viewer'
});

const Granja = sequelize.define('Granja', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  ubicacion: { type: DataTypes.STRING, allowNull: true },
});

const UserGranja = sequelize.define('UserGranja', {
  userId: { type: DataTypes.INTEGER, references: { model: User, key: 'id' } },
  granjaId: { type: DataTypes.INTEGER, references: { model: Granja, key: 'id' } }
});

const Proveedor = sequelize.define('Proveedor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombreCompania: { type: DataTypes.STRING, allowNull: false, unique: true },
  ruc: { type: DataTypes.STRING, allowNull: false, unique: true },
  nombreRepresentante: { type: DataTypes.STRING, allowNull: true },
  emailRepresentante: { type: DataTypes.STRING, allowNull: true },
  telefono: { type: DataTypes.STRING, allowNull: true },
  direccion: { type: DataTypes.STRING, allowNull: true },
  tipoServicio: { type: DataTypes.STRING, allowNull: true } // Ej: Alimento, Medicinas
});

const Cliente = sequelize.define('Cliente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  nombre: { type: DataTypes.STRING, allowNull: false },
  tipoIdentificacion: { type: DataTypes.STRING, allowNull: false }, // Cédula, RUC, Pasaporte
  identificacion: { type: DataTypes.STRING, allowNull: false },
  telefono: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  direccion: { type: DataTypes.STRING, allowNull: true }
});

const Inventario = sequelize.define('Inventario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  proveedorId: { type: DataTypes.INTEGER, references: { model: Proveedor, key: 'id' } },
  producto: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: false },
  cantidad: { type: DataTypes.FLOAT, allowNull: false },
  costo: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Lote = sequelize.define('Lote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.STRING, allowNull: false }, // ID visible (Ej: "LOTE-001")
  cantidad: { type: DataTypes.INTEGER, allowNull: false }, // Cantidad actual (disminuye con mortalidad/ventas)
  cantidadInicial: { type: DataTypes.INTEGER, allowNull: false }, // Para cálculos de mortalidad
  pesoInicial: { type: DataTypes.FLOAT, allowNull: false },
  fechaIngreso: { type: DataTypes.DATE, allowNull: false },
  estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'disponible' } // 'disponible', 'vendido'
});

const Seguimiento = sequelize.define('Seguimiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  alimentoId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Inventario, key: 'id' } },
  semana: { type: DataTypes.INTEGER, allowNull: false },
  peso: { type: DataTypes.FLOAT, allowNull: false },
  consumo: { type: DataTypes.FLOAT, allowNull: false },
  observaciones: { type: DataTypes.TEXT },
  fecha: { type: DataTypes.DATE }
});

const Salud = sequelize.define('Salud', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  tipo: { type: DataTypes.STRING, allowNull: false }, // 'Mortalidad', 'Vacuna', 'Tratamiento'
  nombre: { type: DataTypes.STRING, allowNull: false }, // Ej: "Newcastle" o "Mortalidad Diaria"
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false },
  fechaRetiro: { type: DataTypes.DATE, allowNull: true } // Para bioseguridad
});

const Costo = sequelize.define('Costo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Lote, key: 'id' } }, // Puede ser costo general
  categoria: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
}, { tableName: 'Costos' });

const Venta = sequelize.define('Venta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  clienteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Cliente, key: 'id' } },
  cantidadVendida: { type: DataTypes.INTEGER, allowNull: false },
  peso: { type: DataTypes.FLOAT, allowNull: false },
  precio: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Agua = sequelize.define('Agua', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  cantidad: { type: DataTypes.FLOAT, allowNull: false }, // Litros
  fecha: { type: DataTypes.DATE, allowNull: false }
});

// Tu modelo de Agenda Manual
const Agenda = sequelize.define('Agenda', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  completado: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Config = sequelize.define('Config', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' }, unique: true },
  notificaciones: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Activadas' },
  idioma: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Español' },
  nombreGranja: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Mi Granja' },
});

// --- 2. DEFINIR RELACIONES ---
User.belongsToMany(Granja, { through: UserGranja, foreignKey: 'userId' });
Granja.belongsToMany(User, { through: UserGranja, foreignKey: 'granjaId' });

// Granja -> (El resto)
Granja.hasMany(Lote, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Inventario, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Seguimiento, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Salud, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Costo, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Venta, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Agua, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Agenda, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasOne(Config, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Granja.hasMany(Cliente, { foreignKey: 'granjaId', onDelete: 'CASCADE' });

// (El resto) -> Granja
Lote.belongsTo(Granja, { foreignKey: 'granjaId' });
Inventario.belongsTo(Granja, { foreignKey: 'granjaId' });
Seguimiento.belongsTo(Granja, { foreignKey: 'granjaId' });
Salud.belongsTo(Granja, { foreignKey: 'granjaId' });
Costo.belongsTo(Granja, { foreignKey: 'granjaId' });
Venta.belongsTo(Granja, { foreignKey: 'granjaId' });
Agua.belongsTo(Granja, { foreignKey: 'granjaId' });
Agenda.belongsTo(Granja, { foreignKey: 'granjaId' });
Config.belongsTo(Granja, { foreignKey: 'granjaId' });
Cliente.belongsTo(Granja, { foreignKey: 'granjaId' });

// --- NUEVA RELACIÓN INVENTARIO -> PROVEEDOR ---
Proveedor.hasMany(Inventario, { foreignKey: 'proveedorId' });
Inventario.belongsTo(Proveedor, { foreignKey: 'proveedorId' });

// Relaciones Internas
Lote.hasMany(Seguimiento, { foreignKey: 'loteId', onDelete: 'CASCADE' });
Seguimiento.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Salud, { foreignKey: 'loteId', onDelete: 'CASCADE' });
Salud.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Costo, { foreignKey: 'loteId', onDelete: 'CASCADE' });
Costo.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Venta, { foreignKey: 'loteId', onDelete: 'CASCADE' });
Venta.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Agua, { foreignKey: 'loteId', onDelete: 'CASCADE' });
Agua.belongsTo(Lote, { foreignKey: 'loteId' });
Inventario.hasMany(Seguimiento, { foreignKey: 'alimentoId', onDelete: 'SET NULL' });
Seguimiento.belongsTo(Inventario, { foreignKey: 'alimentoId' });
Cliente.hasMany(Venta, { foreignKey: 'clienteId' });
Venta.belongsTo(Cliente, { foreignKey: 'clienteId' });

// --- 3. SINCRONIZACIÓN DE BASE DE DATOS ---
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida');

    // ¡¡¡ ATENCIÓN V 3.0 !!!
    // 1. Descomenta 'force: true' y comenta 'alter: true'.
    // 2. Haz 'git push' y espera que Render termine (puede fallar, es normal).
    // 3. Vuelve a comentar 'force: true' y descomenta 'alter: true'.
    // 4. Haz 'git push' de nuevo.
    // 5. ¡NO SUBAS 'force: true' A PRODUCCIÓN O BORRARÁS TODO CADA REINICIO!

    // await sequelize.sync({ force: true }); // Usar 1 VEZ para borrar y migrar
    await sequelize.sync({ force: true }); // Usar esta línea para el día a día

    console.log('Base de datos sincronizada');

    // --- DATOS DE ARRANQUE ---
    const [user] = await User.findOrCreate({
      where: { email: 'admin@example.com' },
      defaults: { name: 'Admin', password: bcryptjs.hashSync('admin123', 10), role: 'admin' }
    });
    // 3. Crear granja de ejemplo
    const [granja] = await Granja.findOrCreate({
      where: { nombre: 'Granja Principal' },
      defaults: { ubicacion: 'Matriz' }
    });
    // 4. DARLE ACCESO AL ADMIN A ESA GRANJA (Esta es la línea que te desatasca)
    await UserGranja.findOrCreate({
      where: { userId: user.id, granjaId: granja.id }
    });
    // 5. Crear la config para esa granja
    await Config.findOrCreate({
      where: { granjaId: granja.id },
      defaults: { nombreGranja: 'Granja Principal' }
    });

    // Crear un Proveedor de ejemplo (Global)
    await Proveedor.findOrCreate({
      where: { ruc: '9999999999001' },
      defaults: {
        nombreCompania: 'Alimentos Balanceados S.A.',
        nombreRepresentante: 'Carlos Proveedor',
        emailRepresentante: 'carlos@proveedor.com',
        tipoServicio: 'Alimento'
      }
    });

    // Crear un Cliente de ejemplo (para Granja 1)
    await Cliente.findOrCreate({
      where: { identificacion: '9999999999', granjaId: granja.id },
      defaults: {
        nombre: 'Cliente Final (Consumidor)',
        tipoIdentificacion: 'Cédula',
        telefono: '0999999999',
        granjaId: granja.id
      }
    });

    console.log('Datos de arranque creados. Admin asignado a Granja Principal.');

  } catch (error) {
    console.error('Error al conectar o sincronizar la base de datos:', error);
  }
})();

// --- 4. Middleware de Autenticación (Sin cambios) ---
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// --- 5. ENDPOINTS BÁSICOS ---
app.get('/', (req, res) => res.json({ message: 'Bienvenido a la API V 3.1' }));

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !bcryptjs.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- 6. ENDPOINTS DE GESTIÓN (ADMIN) ---

app.get('/mis-granjas', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: { model: Granja, through: { attributes: [] } }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user.Granjas);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// Endpoint para que el Admin vea TODAS las granjas (para asignar)
app.get('/granjas/todas', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const granjas = await Granja.findAll();
    res.json(granjas);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] } });
    res.json(users);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = bcryptjs.hashSync(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role });
    res.status(201).json(user);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.put('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { name, email, role, password } = req.body;
    const updateData = { name, email, role };

    if (password) { // Solo actualiza contraseña si se envía una
      updateData.password = bcryptjs.hashSync(password, 10);
    }

    await user.update(updateData);
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/granjas', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { nombre, ubicacion } = req.body;
    const granja = await Granja.create({ nombre, ubicacion });
    // Asignar automáticamente la granja al admin que la creó
    await UserGranja.create({ userId: req.user.id, granjaId: granja.id });
    res.status(201).json(granja);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/granjas/asignar', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { userId, granjaId } = req.body;
    await UserGranja.findOrCreate({ where: { userId, granjaId } });
    res.status(200).json({ message: 'Acceso asignado' });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// --- 7. ENDPOINTS CRUD "BLINDADOS" POR granjaId ---

// Helper para chequear granjaId y permisos (simplificado)
const checkGranjaId = (req) => {
  const granjaId = req.query.granjaId || req.body.granjaId;
  if (!granjaId) {
    throw new Error('granjaId (en query o body) es requerido');
  }
  return parseInt(granjaId);
};

// --- Lotes ---
app.get('/lotes', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const lotes = await Lote.findAll({ where: { granjaId }, order: [['fechaIngreso', 'DESC']] });
    res.json(lotes);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/lotes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const lote = await Lote.findOne({ where: { id: req.params.id, granjaId } });
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    res.json(lote);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/lotes', authenticate, async (req, res) => {
  try {
    const { granjaId, loteId, cantidad } = req.body;
    if (!granjaId || !loteId || !cantidad) throw new Error('Faltan datos (granjaId, loteId, cantidad)');

    // Validar que el loteId no se repita *en esa granja*
    const existe = await Lote.findOne({ where: { loteId, granjaId } });
    if (existe) return res.status(400).json({ error: 'El ID de Lote ya existe en esta granja' });

    req.body.cantidadInicial = cantidad; // Guardamos la cantidad original
    const lote = await Lote.create(req.body);
    res.status(201).json(lote);
  } catch (error) { res.status(500).json({ error: 'Error al crear lote: ' + error.message }); }
});
app.put('/lotes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const lote = await Lote.findOne({ where: { id: req.params.id, granjaId } });
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    await lote.update(req.body);
    res.json(lote);
  } catch (error) { res.status(500).json({ error: 'Error al actualizar lote' }); }
});
app.delete('/lotes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req); // granjaId debe ir en query: ?granjaId=1
    const lote = await Lote.findOne({ where: { id: req.params.id, granjaId } });
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    await lote.destroy(); // Esto borra en CASCADA (Salud, Costos, etc.)
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Error al eliminar lote' }); }
});

// ---  NUEVOS ENDPOINTS CLIENTES (Blindados) ---
app.get('/clientes', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Cliente.findAll({ where: { granjaId } });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/clientes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Cliente.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/clientes', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    // Validar que la identificación no se repita *en esa granja*
    const existe = await Cliente.findOne({ where: { identificacion: req.body.identificacion, granjaId } });
    if (existe) return res.status(400).json({ error: 'Ya existe un cliente con esa identificación en esta granja' });

    const item = await Cliente.create(req.body);
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/clientes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Cliente.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Validar si la nueva identificación ya existe (y no es él mismo)
    const { identificacion } = req.body;
    if (identificacion && identificacion !== item.identificacion) {
      const existe = await Cliente.findOne({ where: { identificacion, granjaId } });
      if (existe) return res.status(400).json({ error: 'La nueva identificación ya está en uso' });
    }

    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/clientes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Cliente.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Cliente no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});


// ---ENDPOINTS DE PROVEEDORES (Globales, Admin) ---
app.get('/proveedores', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const items = await Proveedor.findAll();
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/proveedores/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const item = await Proveedor.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/proveedores', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const item = await Proveedor.create(req.body);
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/proveedores/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const item = await Proveedor.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/proveedores/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const item = await Proveedor.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Inventario ---
app.get('/inventario', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Inventario.findAll({
      where: { granjaId },
      include: { model: Proveedor, attributes: ['nombreCompania'] } // <-- V 3.1
    });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/inventario/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Inventario.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/inventario', authenticate, async (req, res) => {
  try {
    checkGranjaId(req);
    const item = await Inventario.create(req.body);
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/inventario/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Inventario.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/inventario/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Inventario.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Seguimiento (con Transacción de Alimento) ---
app.get('/seguimiento', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Seguimiento.findAll({ where: { granjaId } });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/seguimiento/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Seguimiento.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/seguimiento', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { granjaId, alimentoId, consumo } = req.body;
    if (!granjaId) throw new Error('granjaId requerido');

    const seguimiento = await Seguimiento.create(req.body, { transaction: t });

    if (alimentoId && consumo > 0) {
      const alimento = await Inventario.findOne({ where: { id: alimentoId, granjaId }, transaction: t });
      if (!alimento) throw new Error('Alimento no encontrado en esta granja');
      if (alimento.cantidad < consumo) throw new Error('Stock de alimento insuficiente');
      await alimento.decrement('cantidad', { by: consumo, transaction: t });
    }

    await t.commit();
    res.status(201).json(seguimiento);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});
app.put('/seguimiento/:id', authenticate, async (req, res) => {
  // NOTA: Un PUT transaccional (para re-ajustar stock) es complejo.
  // Por simplicidad, este PUT solo actualiza el registro.
  try {
    const granjaId = checkGranjaId(req);
    const item = await Seguimiento.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/seguimiento/:id', authenticate, async (req, res) => {
  // NOTA: Un DELETE transaccional (para devolver stock) es complejo.
  try {
    const granjaId = checkGranjaId(req);
    const item = await Seguimiento.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Salud (con Transacción de Mortalidad) ---
app.get('/salud', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Salud.findAll({ where: { granjaId } });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/salud/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Salud.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/salud', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { granjaId, loteId, tipo, cantidad } = req.body;
    if (!granjaId) throw new Error('granjaId requerido');

    const salud = await Salud.create(req.body, { transaction: t });

    if (tipo.toLowerCase() === 'mortalidad') {
      const lote = await Lote.findOne({ where: { id: loteId, granjaId }, transaction: t });
      if (!lote) throw new Error('Lote no encontrado');
      if (lote.cantidad < cantidad) throw new Error(`Mortalidad (${cantidad}) excede stock (${lote.cantidad})`);
      await lote.decrement('cantidad', { by: cantidad, transaction: t });
    }
    await t.commit();
    res.status(201).json(salud);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});
app.put('/salud/:id', authenticate, async (req, res) => {
  // NOTA: Omitimos lógica transaccional de ajuste de stock por simplicidad
  try {
    const granjaId = checkGranjaId(req);
    const item = await Salud.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/salud/:id', authenticate, async (req, res) => {
  // NOTA: Omitimos lógica transaccional de re-stock por simplicidad
  try {
    const granjaId = checkGranjaId(req);
    const item = await Salud.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Costos ---
app.get('/costos', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Costo.findAll({ where: { granjaId } });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/costos/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Costo.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Costo no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/costos', authenticate, async (req, res) => {
  try {
    checkGranjaId(req);
    const item = await Costo.create(req.body);
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/costos/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Costo.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Costo no encontrado' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/costos/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Costo.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Costo no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- Ventas (con Transacción de Stock y Bioseguridad) ---
app.get('/ventas', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Venta.findAll({
      where: { granjaId },
      include: [
        { model: Lote, attributes: ['loteId'] }, // Trae el nombre del lote
        { model: Cliente, attributes: ['nombre'] } // Trae el nombre del cliente
      ],
      order: [['fecha', 'DESC']]
    });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/ventas/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Venta.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/ventas', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // CAMBIO: 'cliente' ya no existe, ahora es 'clienteId'
    const { granjaId, loteId, cantidadVendida, fecha, clienteId } = req.body;
    if (!granjaId || !loteId || !cantidadVendida || !fecha || !clienteId) {
      throw new Error('Faltan datos (granjaId, loteId, cantidad, fecha, clienteId)');
    }

    // Check Bioseguridad (Sin cambios)
    const fechaVenta = new Date(fecha);
    const ultimoTratamiento = await Salud.findOne({
      where: { loteId, granjaId, fechaRetiro: { [Op.gt]: fechaVenta } }
    });
    if (ultimoTratamiento) {
      throw new Error(`Venta bloqueada. Lote en retiro hasta: ${new Date(ultimoTratamiento.fechaRetiro).toLocaleDateString()}`);
    }

    // Check Stock (Sin cambios)
    const lote = await Lote.findOne({ where: { id: loteId, granjaId }, transaction: t });
    if (!lote) throw new Error('Lote no encontrado');
    if (lote.estado !== 'disponible' || lote.cantidad < cantidadVendida) {
      throw new Error(`Stock insuficiente (${lote.cantidad})`);
    }

    // Crear la Venta (con clienteId)
    const venta = await Venta.create(req.body, { transaction: t });

    // Actualizar Lote (Sin cambios)
    await lote.update({
      cantidad: lote.cantidad - cantidadVendida,
      estado: (lote.cantidad - cantidadVendida) > 0 ? 'disponible' : 'vendido'
    }, { transaction: t });

    await t.commit();
    res.status(201).json(venta);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});
app.delete('/ventas/:id', authenticate, async (req, res) => {
  // Revertir Venta
  const t = await sequelize.transaction();
  try {
    const granjaId = checkGranjaId(req);
    const venta = await Venta.findOne({ where: { id: req.params.id, granjaId } });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const lote = await Lote.findOne({ where: { id: venta.loteId, granjaId }, transaction: t });
    if (lote) {
      await lote.update({
        cantidad: lote.cantidad + venta.cantidadVendida,
        estado: 'disponible' // Marcar como disponible de nuevo
      }, { transaction: t });
    }

    await venta.destroy({ transaction: t });
    await t.commit();
    res.status(204).send();
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// --- Agua ---
app.get('/agua', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Agua.findAll({
      where: { granjaId },
      include: { model: Lote, attributes: ['loteId'] } // Incluir nombre del lote
    });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/agua/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Agua.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/agua', authenticate, async (req, res) => {
  try {
    checkGranjaId(req);
    const item = await Agua.create(req.body);
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/agua/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Agua.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    await item.update(req.body);
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/agua/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Agua.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Registro no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Agenda ---
app.get('/agenda', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const items = await Agenda.findAll({ where: { granjaId }, order: [['fecha', 'ASC']] });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/agenda', authenticate, async (req, res) => {
  try {
    checkGranjaId(req);
    const item = await Agenda.create(req.body);
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/agenda/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const item = await Agenda.findOne({ where: { id: req.params.id, granjaId } });
    if (!item) return res.status(404).json({ error: 'Evento no encontrado' });
    await item.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Config ---
app.get('/config', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const [config] = await Config.findOrCreate({
      where: { granjaId },
      defaults: { granjaId, nombreGranja: 'Mi Granja' }
    });
    res.json(config);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/config', authenticate, async (req, res) => { // Es un "Guardar" (POST o PUT)
  try {
    const granjaId = checkGranjaId(req);
    const [config] = await Config.findOrCreate({ where: { granjaId } });
    await config.update(req.body);
    res.json(config);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- Reportes ---
app.post('/reporte', authenticate, async (req, res) => {
  try {
    const { tipoReporte, loteId, fechaInicio, fechaFin, granjaId } = req.body;
    if (!granjaId) throw new Error('granjaId requerido');

    let data = [];
    const whereClause = {
      granjaId: parseInt(granjaId),
      fecha: { [Op.between]: [new Date(fechaInicio), new Date(fechaFin)] }
    };
    if (loteId) whereClause.loteId = loteId;

    switch (tipoReporte) {
      case 'costos':
        const costos = await Costo.findAll({
          where: whereClause,
          include: [{ model: Lote, attributes: ['loteId'] }]
        });
        data = costos.map(c => ({
          Lote: c.Lote ? c.Lote.loteId : 'General',
          Categoria: c.categoria,
          Descripcion: c.descripcion,
          Monto: c.monto,
          Fecha: new Date(c.fecha).toLocaleDateString()
        }));
        // Añadir total
        const totalCostos = costos.reduce((sum, c) => sum + c.monto, 0);
        data.push({ Lote: 'TOTAL', Categoria: '', Descripcion: '', Monto: totalCostos, Fecha: '' });
        break;

      // ... (añadir casos para 'ventas', 'salud', 'seguimiento') ...

      default:
        // Añadimos un reporte de ejemplo si no se especificó uno válido
        data = [{ Error: `Reporte '${tipoReporte}' no implementado.` }];
      // return res.status(400).json({ error: 'Tipo de reporte no válido' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte: ' + error.message });
  }
});


// Inicia el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor V 3.0 corriendo en puerto ${PORT}`));