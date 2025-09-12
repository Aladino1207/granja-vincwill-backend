require('dotenv').config(); // esto carga las variables de .env

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_123';

// Configurar PostgreSQL (usa la variable de entorno de Render)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres', // Cambiado de 'mysql' a 'postgres'
  logging: false
});

// Definir modelos
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

// Definir relaciones
Lote.hasMany(Seguimiento, { foreignKey: 'loteId' });
Seguimiento.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Salud, { foreignKey: 'loteId' });
Salud.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Costo, { foreignKey: 'loteId' });
Costo.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Venta, { foreignKey: 'loteId' });
Venta.belongsTo(Lote, { foreignKey: 'loteId' });

// Sincronizar base de datos
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

// Login endpoint
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

// Middleware de autenticación
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

// Endpoints CRUD para User
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

// Endpoints CRUD para Lote
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

// Repite endpoints para Seguimiento, Salud, Costo, Venta, Inventario, Config (como en el código anterior)

// Inicia el servidor
app.listen(process.env.PORT || 3000, () => console.log('Servidor corriendo'));