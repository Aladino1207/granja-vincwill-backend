//const API_URL = 'https://granja-vincwill-backend.onrender.com';

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Configuración avanzada de CORS
app.use(cors({
  origin: 'https://granja-vincwill-frontend.vercel.app', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_123';

// Configurar PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

// Definir modelos
const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false }
});

const Lote = sequelize.define('Lote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loteId: { type: DataTypes.STRING, unique: true, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  pesoInicial: { type: DataTypes.FLOAT, allowNull: false },
  fechaIngreso: { type: DataTypes.DATE, allowNull: false },
  estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'disponible' }
});

const Seguimiento = sequelize.define('Seguimiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loteId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Lote, key: 'id' } },
  alimentoId: { type: DataTypes.INTEGER, allowNull: false,references: { model: Inventario, key: 'id' } },
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
}, {
  tableName: 'Costos', // Especifica el nombre exacto de la tabla
  timestamps: true // Opcional: añade createdAt y updatedAt
});

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

// Definir relaciones explícitas
Lote.hasMany(Seguimiento, { foreignKey: 'loteId' });
Inventario.hasMany(Seguimiento, { foreignKey: 'alimentoId' });
Seguimiento.belongsTo(Inventario, { foreignKey: 'alimentoId' });
Lote.hasMany(Salud, { foreignKey: 'loteId' });
Salud.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Costo, { foreignKey: 'loteId' });
Costo.belongsTo(Lote, { foreignKey: 'loteId' });
Lote.hasMany(Venta, { foreignKey: 'loteId' });
Venta.belongsTo(Lote, { foreignKey: 'loteId' });

// Sincronizar base de datos con depuración
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos establecida');
    await sequelize.sync({ alter: true });
    console.log('Base de datos sincronizada con PostgreSQL');
    // Verifica si la tabla Inventarios existe
    const tableExists = await sequelize.getQueryInterface().showAllTables().then(tables => tables.includes('Inventarios'));
    if (!tableExists) {
      console.log('Tabla Inventarios no encontrada, forzando recreación');
      await Inventario.sync({ force: true });
    }
    const user = await User.findOne({ where: { email: 'admin@example.com' } });
    if (!user) {
      const hashedPassword = bcryptjs.hashSync('admin123', 10);
      const newUser = await User.create({
        name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Usuario creado:', newUser.toJSON());
    } else {
      console.log('Usuario admin@example.com ya existe:', user.toJSON());
    }
    await Config.create({
      notificaciones: 'Activadas',
      idioma: 'Español',
      nombreGranja: 'Granja Avícola VincWill',
      vacunasGallinas: '',
      vacunasPollos: '',
      vacunasPavos: ''
    });
  } catch (error) {
    console.error('Error al conectar o sincronizar la base de datos, pero el servidor continuará:', error);
  }
})();

// Middleware de autenticación
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Token recibido:', token);
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decodificado:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error al verificar token:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

//borrrar despues
app.use((req, res, next) => {
  console.log(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: '¡Bienvenido a la API de Granja Avícola VincWill! Usa /login para autenticarte.' });
});

// Endpoint de login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !bcryptjs.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    // Distingue errores de DB vs otros
    if (err.name?.includes('Sequelize')) {
      return res.status(503).json({ error: 'Servicio de base de datos no disponible' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint temporal para crear usuario admin
app.post('/create-admin', async (req, res) => {
  try {
    const hashedPassword = bcryptjs.hashSync('admin123', 10);
    const user = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin'
    });
    res.status(201).json({ message: 'Usuario admin creado', user });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario: ' + error.message });
  }
});

// Endpoint para generar reportes
app.post('/reporte', authenticate, async (req, res) => {
  const { tipoReporte, loteId, fechaInicio, fechaFin } = req.body;

  try {
    let data = [];
    const whereClause = {
      fecha: {
        [Sequelize.Op.between]: [new Date(fechaInicio), new Date(fechaFin)]
      }
    };
    if (loteId) whereClause.loteId = loteId;

    switch (tipoReporte) {
      case 'produccion':
        const seguimiento = await Seguimiento.findAll({ where: whereClause, include: [{ model: Lote }] });
        data = seguimiento.map(s => ({
          loteId: s.Lote.loteId,
          semana: s.semana,
          pesoPromedio: s.peso,
          consumoDiario: (s.consumo / 7).toFixed(2), // Convertir consumo semanal a diario
          fecha: s.fecha.toISOString().split('T')[0]
        }));
        // Añadir resumen
        const totalPeso = seguimiento.reduce((sum, s) => sum + s.peso, 0);
        const avgPeso = data.length ? (totalPeso / data.length).toFixed(2) : 0;
        data.push({ loteId: 'Total', semana: '', pesoPromedio: avgPeso, consumoDiario: '', fecha: '' });
        break;
      case 'costos':
        const costos = await Costo.findAll({ where: whereClause, include: [{ model: Lote }] });
        data = costos.map(c => ({
          loteId: c.Lote.loteId,
          categoria: c.categoria,
          descripcion: c.descripcion,
          monto: `$${c.monto.toFixed(2)}`,
          fecha: c.fecha.toISOString().split('T')[0]
        }));
        // Añadir total
        const totalCostos = costos.reduce((sum, c) => sum + c.monto, 0);
        data.push({ loteId: 'Total', categoria: '', descripcion: '', monto: `$${totalCostos.toFixed(2)}`, fecha: '' });
        break;
      case 'ventas':
        const ventas = await Venta.findAll({ where: whereClause, include: [{ model: Lote }] });
        data = ventas.map(v => ({
          loteId: v.Lote.loteId,
          cantidadVendida: v.cantidadVendida,
          pesoTotal: `${v.peso.toFixed(2)} kg`,
          precioTotal: `$${((v.peso || 0) * v.precio).toFixed(2)}`,
          fecha: v.fecha.toISOString().split('T')[0],
          cliente: v.cliente || 'No especificado'
        }));
        // Añadir total de ingresos
        const totalIngresos = ventas.reduce((sum, v) => sum + (v.peso * v.precio), 0);
        data.push({ loteId: 'Total', cantidadVendida: '', pesoTotal: '', precioTotal: `$${totalIngresos.toFixed(2)}`, fecha: '', cliente: '' });
        break;
      case 'sanitario':
        const salud = await Salud.findAll({ where: whereClause, include: [{ model: Lote }] });
        data = salud.map(s => ({
          loteId: s.Lote.loteId,
          tipo: s.tipo,
          nombre: s.nombre,
          cantidad: s.cantidad,
          fecha: s.fecha.toISOString().split('T')[0],
          impacto: s.tipo === 'Mortalidad' ? 'Alto' : 'Bajo'
        }));
        // Añadir total de eventos
        const totalEventos = salud.length;
        data.push({ loteId: 'Total', tipo: '', nombre: '', cantidad: totalEventos, fecha: '', impacto: '' });
        break;
      case 'seguimiento':
        const seguimientoAll = await Seguimiento.findAll({ where: whereClause, include: [{ model: Lote }] });
        data = seguimientoAll.map(s => ({
          loteId: s.Lote.loteId,
          semana: s.semana,
          pesoPromedio: s.peso,
          consumoTotal: s.consumo.toFixed(2),
          fecha: s.fecha.toISOString().split('T')[0]
        }));
        // Añadir promedio de peso
        const avgPesoSeguimiento = seguimientoAll.length ? (seguimientoAll.reduce((sum, s) => sum + s.peso, 0) / seguimientoAll.length).toFixed(2) : 0;
        data.push({ loteId: 'Promedio', semana: '', pesoPromedio: avgPesoSeguimiento, consumoTotal: '', fecha: '' });
        break;
      default:
        return res.status(400).json({ error: 'Tipo de reporte no válido' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({ error: 'Error al generar reporte: ' + error.message });
  }
});

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
    const hashedPassword = bcryptjs.hashSync(password, 10);
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
    if (req.body.password) req.body.password = bcryptjs.hashSync(req.body.password, 10);
    await user.update(req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
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
    const { loteId, cantidad, pesoInicial, fechaIngreso, estado } = req.body;
    console.log('Datos recibidos para crear lote:', req.body);
    if (!loteId || !cantidad || !pesoInicial || !fechaIngreso) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (loteId, cantidad, pesoInicial, fechaIngreso)' });
    }
    const lote = await Lote.create({
      id: null, // Permitir que autoIncrement genere el ID
      loteId,
      cantidad: parseInt(cantidad),
      pesoInicial: parseFloat(pesoInicial),
      fechaIngreso: new Date(fechaIngreso),
      estado: estado || 'disponible'
    });
    console.log('Lote creado:', lote.toJSON());
    res.status(201).json(lote);
  } catch (error) {
    console.error('Error al crear lote:', error);
    res.status(500).json({ error: 'Error al crear lote: ' + error.message });
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

// Endpoints CRUD para Seguimiento
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
  const t = await sequelize.transaction();

  try {
    const { loteId, alimentoId, semana, peso, consumo, observaciones, fecha } = req.body;
    
    if (!loteId || !semana || !peso || !consumo || !fecha) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Validamos el consumo
    const consumoNumerico = parseFloat(consumo);
    if (!loteId || !alimentoId || !semana || !peso || !consumo || !fecha || isNaN(consumoNumerico) || consumoNumerico <= 0) {
      return res.status(400).json({ error: 'Faltan campos obligatorios o el consumo es inválido' });
    }
    // BUSCAMOS EL ALIMENTO ESPECÍFICO
    const alimento = await Inventario.findByPk(parseInt(alimentoId), {
      transaction: t,
      lock: t.LOCK.UPDATE // Bloqueamos la fila para evitar concurrencia
    });

    // Validar el stock
    if (!alimento) {
      throw new Error('Insumo de alimento no encontrado.');
    }
    if (alimento.cantidad < consumoNumerico) {
      throw new Error(`Stock de ${alimento.producto} insuficiente. Stock actual: ${alimento.cantidad} kg.`);
    }

    // 4. Crear el registro de seguimiento
    const seguimiento = await Seguimiento.create({
      loteId: parseInt(loteId),
      alimentoId: parseInt(alimentoId), // <--- GUARDAMOS EL ID
      semana: parseInt(semana),
      peso: parseFloat(peso),
      consumo: consumoNumerico,
      observaciones: observaciones || null,
      fecha: new Date(fecha)
    }, { transaction: t });

    await alimento.decrement('cantidad', { by: consumoNumerico, transaction: t });
    await t.commit();
    res.status(201).json(seguimiento);
  } catch (error) {
    await t.rollback();
    console.error('Error en transacción de seguimiento:', error);
    res.status(500).json({ error: 'Error al crear seguimiento: ' + error.message });
  }
});

app.get('/seguimiento/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const seguimiento = await Seguimiento.findByPk(id);
    if (!seguimiento) return res.status(404).json({ error: 'Seguimiento no encontrado' });
    res.json(seguimiento);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener seguimiento: ' + error.message });
  }
});

app.put('/seguimiento/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const { loteId, semana, peso, consumo, observaciones, fecha } = req.body;
    const seguimiento = await Seguimiento.findByPk(id);
    if (!seguimiento) return res.status(404).json({ error: 'Seguimiento no encontrado' });
    await seguimiento.update({
      loteId: loteId !== undefined ? parseInt(loteId) : seguimiento.loteId,
      semana: semana !== undefined ? parseInt(semana) : seguimiento.semana,
      peso: peso !== undefined ? parseFloat(peso) : seguimiento.peso,
      consumo: consumo !== undefined ? parseFloat(consumo) : seguimiento.consumo,
      observaciones: observaciones || seguimiento.observaciones,
      fecha: fecha ? new Date(fecha) : seguimiento.fecha
    });
    res.json(seguimiento);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar seguimiento: ' + error.message });
  }
});

app.delete('/seguimiento/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const seguimiento = await Seguimiento.findByPk(id);
    if (!seguimiento) return res.status(404).json({ error: 'Seguimiento no encontrado' });
    await seguimiento.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar seguimiento: ' + error.message });
  }
});

// Endpoints CRUD para Salud
app.get('/salud', authenticate, async (req, res) => {
  try {
    const salud = await Salud.findAll();
    console.log('Datos de /salud enviados:', salud);
    res.json(salud);
  } catch (error) {
    console.error('Error al obtener salud:', error);
    res.status(500).json({ error: 'Error al obtener salud' });
  }
});

app.post('/salud', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { loteId, tipo, nombre, cantidad, fecha } = req.body;
    console.log('Solicitud POST /salud recibida:', req.body);
    if (!loteId || !tipo || !nombre || !cantidad || !fecha) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: 'Cantidad debe ser un número positivo' });
    }
    const salud = await Salud.create({ loteId, tipo, nombre, cantidad, fecha });
    console.log('Evento de salud creado:', salud.toJSON());
    res.status(201).json(salud);
  } catch (error) {
    console.error('Error al crear evento de salud:', error);
    res.status(500).json({ error: 'Error al crear evento de salud: ' + error.message });
  }
});

app.get('/salud/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const salud = await Salud.findByPk(id);
    if (!salud) return res.status(404).json({ error: 'Evento de salud no encontrado' });
    res.json(salud);
  } catch (error) {
    console.error('Error al obtener evento de salud por id:', error);
    res.status(500).json({ error: 'Error al obtener evento de salud: ' + error.message });
  }
});

app.put('/salud/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const { loteId, tipo, nombre, cantidad, fecha } = req.body;
    const salud = await Salud.findByPk(id);
    if (!salud) return res.status(404).json({ error: 'Evento de salud no encontrado' });
    if (isNaN(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: 'Cantidad debe ser un número positivo' });
    }
    await salud.update({
      loteId: loteId || salud.loteId,
      tipo: tipo || salud.tipo,
      nombre: nombre || salud.nombre,
      cantidad: cantidad !== undefined ? parseFloat(cantidad) : salud.cantidad,
      fecha: fecha || salud.fecha
    });
    console.log('Evento de salud actualizado:', salud.toJSON());
    res.json(salud);
  } catch (error) {
    console.error('Error al actualizar evento de salud:', error);
    res.status(500).json({ error: 'Error al actualizar evento de salud: ' + error.message });
  }
});

app.delete('/salud/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const salud = await Salud.findByPk(id);
    if (!salud) return res.status(404).json({ error: 'Evento de salud no encontrado' });
    await salud.destroy();
    console.log('Evento de salud eliminado:', id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar evento de salud:', error);
    res.status(500).json({ error: 'Error al eliminar evento de salud: ' + error.message });
  }
});

// Endpoints CRUD para Costos
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
    const { loteId, categoria, descripcion, monto, fecha } = req.body;
    console.log('Solicitud POST /costos recibida:', req.body);
    if (!loteId || !categoria || !descripcion || !monto || !fecha) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    // Valida que el loteId exista
    const lote = await Lote.findByPk(loteId);
    if (!lote) {
      return res.status(400).json({ error: 'Lote no encontrado' });
    }
    const costo = await Costo.create({
      loteId: parseInt(loteId),
      categoria,
      descripcion,
      monto: parseFloat(monto),
      fecha: new Date(fecha)
    });
    console.log('Costo creado en la base de datos:', costo.toJSON());
    res.status(201).json(costo);
  } catch (error) {
    console.error('Error al crear costo - Detalle:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      res.status(400).json({ error: 'Registro duplicado' });
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
      res.status(400).json({ error: 'Lote no válido' });
    } else {
      res.status(500).json({ error: 'Error al crear costo: ' + error.message });
    }
  }
});


// Endpoints CRUD para Ventas
app.get('/ventas', authenticate, async (req, res) => {
  try {
    const ventas = await Venta.findAll();
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

app.post('/ventas', authenticate, async (req, res) => {
  console.log('Solicitud POST /ventas recibida en el servidor:', req.body);
  if (req.user.role === 'viewer') {
    console.log('Acceso denegado para rol viewer');
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  try {
    const { loteId, cantidadVendida, peso, precio, fecha, cliente } = req.body;
    console.log('Procesando datos:', { loteId, cantidadVendida, peso, precio, fecha, cliente });

    if (!loteId || !cantidadVendida || !peso || !precio || !fecha) {
      console.log('Faltan campos obligatorios');
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const lote = await Lote.findByPk(loteId);
    if (!lote) {
      console.log('Lote no encontrado con ID:', loteId);
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    if (lote.estado !== 'disponible' || lote.cantidad < cantidadVendida) {
      console.log('Lote no disponible o cantidad insuficiente:', lote.toJSON());
      return res.status(400).json({ error: 'Lote no disponible o cantidad insuficiente' });
    }

    const result = await sequelize.transaction(async (t) => {
      const venta = await Venta.create(
        { loteId, cantidadVendida, peso, precio, fecha, cliente },
        { transaction: t }
      );
      await lote.update(
        {
          cantidad: lote.cantidad - cantidadVendida,
          estado: lote.cantidad - cantidadVendida > 0 ? 'disponible' : 'vendido'
        },
        { transaction: t }
      );
      return venta;
    });

    console.log('Venta creada y lote actualizado:', result.toJSON(), 'Lote actualizado:', lote.toJSON());
    res.status(201).json(result);
  } catch (error) {
    console.error('Error al crear venta:', error);
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Error de base de datos:', error.original);
    }
    res.status(500).json({ error: 'Error al crear venta: ' + error.message });
  }
});

app.get('/ventas/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta por id:', error);
    res.status(500).json({ error: 'Error al obtener venta: ' + error.message });
  }
});

app.put('/ventas/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const { loteId, cantidadVendida, peso, precio, fecha, cliente } = req.body;
    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const lote = await Lote.findByPk(loteId || venta.loteId);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

    const diferencia = (cantidadVendida || venta.cantidadVendida) - venta.cantidadVendida;

    await sequelize.transaction(async (t) => {
      await venta.update({
        loteId: loteId || venta.loteId,
        cantidadVendida: cantidadVendida !== undefined ? parseInt(cantidadVendida) : venta.cantidadVendida,
        peso: peso !== undefined ? parseFloat(peso) : venta.peso,
        precio: precio !== undefined ? parseFloat(precio) : venta.precio,
        fecha: fecha || venta.fecha,
        cliente: cliente || venta.cliente
      }, { transaction: t });

      if (diferencia !== 0 && loteId === venta.loteId) {
        await lote.update({
          cantidad: lote.cantidad + diferencia,
          estado: (lote.cantidad + diferencia) > 0 ? 'disponible' : 'vendido'
        }, { transaction: t });
      }
    });

    console.log('Venta actualizada:', venta.toJSON());
    res.json(venta);
  } catch (error) {
    console.error('Error al actualizar venta:', error);
    res.status(500).json({ error: 'Error al actualizar venta: ' + error.message });
  }
});

app.delete('/ventas/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const venta = await Venta.findByPk(id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const lote = await Lote.findByPk(venta.loteId);
    if (!lote) return res.status(500).json({ error: 'Lote asociado no encontrado' });

    await sequelize.transaction(async (t) => {
      await venta.destroy({ transaction: t });
      await lote.update({
        cantidad: lote.cantidad + venta.cantidadVendida,
        estado: lote.cantidad + venta.cantidadVendida > 0 ? 'disponible' : 'vendido'
      }, { transaction: t });
    });

    console.log('Venta eliminada y lote actualizado:', id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    res.status(500).json({ error: 'Error al eliminar venta: ' + error.message });
  }
});

// Endpoints CRUD para Inventario
app.get('/inventario', authenticate, async (req, res) => {
  try {
    const inventario = await Inventario.findAll();
    res.json(inventario);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

app.get('/inventario/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const inventario = await Inventario.findByPk(id);
    if (!inventario) return res.status(404).json({ error: 'Inventario no encontrado' });
    console.log('Inventario recuperado con id:', id, inventario.toJSON());
    res.json(inventario);
  } catch (error) {
    console.error('Error al obtener inventario por id:', error);
    res.status(500).json({ error: 'Error al obtener inventario: ' + error.message });
  }
});

app.post('/inventario', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { producto, categoria, cantidad, costo, fecha } = req.body;
    console.log('Solicitud POST /inventario recibida:', req.body);
    if (!producto || !categoria || !cantidad || !costo || !fecha) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (producto, categoria, cantidad, costo, fecha)' });
    }
    const inventario = await Inventario.create({
      producto,
      categoria,
      cantidad: parseFloat(cantidad),
      costo: parseFloat(costo),
      fecha: new Date(fecha)
    });
    console.log('Inventario creado en la base de datos:', inventario.toJSON());
    res.status(201).json(inventario);
  } catch (error) {
    console.error('Error al crear inventario - Detalle:', error);
    res.status(500).json({ error: 'Error al crear inventario: ' + error.message });
  }
});

app.put('/inventario/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const { producto, categoria, cantidad, costo, fecha } = req.body;
    const inventario = await Inventario.findByPk(id);
    if (!inventario) return res.status(404).json({ error: 'Inventario no encontrado' });
    await inventario.update({
      producto: producto || inventario.producto,
      categoria: categoria || inventario.categoria,
      cantidad: cantidad !== undefined ? parseFloat(cantidad) : inventario.cantidad,
      costo: costo !== undefined ? parseFloat(costo) : inventario.costo,
      fecha: fecha ? new Date(fecha) : inventario.fecha
    });
    console.log('Inventario actualizado:', inventario.toJSON());
    res.json(inventario);
  } catch (error) {
    console.error('Error al actualizar inventario:', error);
    res.status(500).json({ error: 'Error al actualizar inventario: ' + error.message });
  }
});

app.delete('/inventario/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const inventario = await Inventario.findByPk(id);
    if (!inventario) return res.status(404).json({ error: 'Inventario no encontrado' });
    await inventario.destroy();
    console.log('Inventario eliminado con id:', id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar inventario:', error);
    res.status(500).json({ error: 'Error al eliminar inventario: ' + error.message });
  }
});

// Endpoints CRUD para Config
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
    const existingConfig = await Config.findOne();
    if (existingConfig) {
      await existingConfig.update(req.body);
      res.json(existingConfig);
    } else {
      const config = await Config.create(req.body);
      res.status(201).json(config);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al crear/actualizar configuración' });
  }
});

app.get('/config/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const config = await Config.findByPk(id);
    if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

app.delete('/config/:id', authenticate, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const config = await Config.findByPk(id);
    if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
    await config.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar configuración' });
  }
});

// Inicia el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
