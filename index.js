const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_123';

// Configurar PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
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
  estado: { type: DataTypes.STRING, allowNull: false }
});

const Seguimiento = sequelize.define('Seguimiento', {
  loteId: { type: DataTypes.INTEGER, allowNull: false },
  semana: { type: DataTypes.INTEGER, allowNull: false },
  peso: { type: DataTypes.FLOAT, allowNull: false },
  consumo: { type: DataTypes.FLOAT, allowNull: false },
  observaciones: { type: DataTypes.TEXT },
  fecha: { type: DataTypes.DATE }
});

const Salud = sequelize.define('Salud', {
  loteId: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.STRING, allowNull: false },
  nombre: { type: DataTypes.STRING, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Costo = sequelize.define('Costo', {
  loteId: { type: DataTypes.INTEGER, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Venta = sequelize.define('Venta', {
  loteId: { type: DataTypes.INTEGER, allowNull: false },
  peso: { type: DataTypes.FLOAT, allowNull: false },
  precio: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false },
  cliente: { type: DataTypes.STRING, allowNull: false }
});

const Inventario = sequelize.define('Inventario', {
  producto: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: false },
  cantidad: { type: DataTypes.FLOAT, allowNull: false },
  costo: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Config = sequelize.define('Config', {
  notificaciones: { type: DataTypes.STRING, allowNull: false },
  idioma: { type: DataTypes.STRING, allowNull: false },
  nombreGranja: { type: DataTypes.STRING, allowNull: false },
  vacunasGallinas: { type: DataTypes.TEXT },
  vacunasPollos: { type: DataTypes.TEXT },
  vacunasPavos: { type: DataTypes.TEXT }
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
sequelize.sync({ force: true }).then(async () => {
  console.log('Base de datos sincronizada con PostgreSQL');
  await User.create({
    name: 'Admin',
    email: 'admin@example.com',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin'
  });
  await Config.create({
    notificaciones: 'Activadas',
    idioma: 'Español',
    nombreGranja: 'Granja Avícola VincWill',
    vacunasGallinas: '',
    vacunasPollos: '',
    vacunasPavos: ''
  });
}).catch(error => console.error('Error al sincronizar BD:', error));

// Login endpoint (sin cambios)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Error en login' });
  }
});

// Middleware de autenticación (sin cambios)
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Ruta raíz para verificar el servidor
app.get('/', (req, res) => {
  res.json({ message: '¡Bienvenido a la API de Granja Avícola VincWill! Usa /login para autenticarte.' });
});

// Endpoints CRUD para User (sin cambios)
app.get('/users', authenticate, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.post('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.put('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (req.body.password) req.body.password = bcrypt.hashSync(req.body.password, 10);
    await user.update(req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    await user.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Endpoints CRUD para Lote (sin cambios)
app.get('/lotes', authenticate, async (req, res) => {
  try {
    const lotes = await Lote.findAll();
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener lotes' });
  }
});

app.post('/lotes', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const lote = await Lote.create(req.body);
    res.status(201).json(lote);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear lote' });
  }
});

app.put('/lotes/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const lote = await Lote.findByPk(id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    await lote.update(req.body);
    res.json(lote);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar lote' });
  }
});

app.delete('/lotes/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const lote = await Lote.findByPk(id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    await lote.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar lote' });
  }
});

// Endpoints CRUD para Seguimiento (sin cambios)
app.get('/seguimiento', authenticate, async (req, res) => {
  try {
    const seguimiento = await Seguimiento.findAll();
    res.json(seguimiento);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener seguimiento' });
  }
});

app.post('/seguimiento', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const seguimiento = await Seguimiento.create(req.body);
    res.status(201).json(seguimiento);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear seguimiento' });
  }
});

// Endpoints CRUD para Salud (sin cambios)
app.get('/salud', authenticate, async (req, res) => {
  try {
    const salud = await Salud.findAll();
    res.json(salud);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener salud' });
  }
});

app.post('/salud', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const salud = await Salud.create(req.body);
    res.status(201).json(salud);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear evento sanitario' });
  }
});

// Endpoints CRUD para Costos (¡AGREGADO: Corregir GET que faltaba)
app.get('/costos', authenticate, async (req, res) => {
  try {
    const costos = await Costo.findAll();
    res.json(costos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener costos' });
  }
});

app.post('/costos', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const costo = await Costo.create(req.body);
    res.status(201).json(costo);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear costo' });
  }
});

// Endpoints CRUD para Ventas (¡AGREGADO: Corregir GET que faltaba)
app.get('/ventas', authenticate, async (req, res) => {
  try {
    const ventas = await Venta.findAll();
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

app.post('/ventas', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const venta = await Venta.create(req.body);
    res.status(201).json(venta);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear venta' });
  }
});

// Endpoints CRUD para Inventario (sin cambios)
app.get('/inventario', authenticate, async (req, res) => {
  try {
    const inventario = await Inventario.findAll();
    res.json(inventario);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

app.post('/inventario', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const inventario = await Inventario.create(req.body);
    res.status(201).json(inventario);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear inventario' });
  }
});

// Endpoints CRUD para Config (sin cambios)
app.get('/config', authenticate, async (req, res) => {
  try {
    const config = await Config.findAll();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

app.post('/config', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const config = await Config.create(req.body);
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear configuración' });
  }
});

// Inicia el servidor
app.listen(process.env.PORT || 3000, () => console.log('Servidor corriendo'));