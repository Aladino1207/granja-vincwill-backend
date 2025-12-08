//const API_URL = 'https://granja-vincwill-backend.onrender.com';

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Configuración de CORS (asumiendo que tienes una configuración)
app.use(cors({
  origin: '*',
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
  proveedorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Proveedor, key: 'id' } },
  producto: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: false },
  unidadMedida: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Unidades' },
  cantidad: { type: DataTypes.FLOAT, allowNull: false },
  costo: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false }
});

const Galpon = sequelize.define('Galpon', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  nombre: { type: DataTypes.STRING, allowNull: false },
  capacidad: { type: DataTypes.INTEGER, allowNull: false },
  estado: { type: DataTypes.STRING, defaultValue: 'libre' }, // 'libre', 'ocupado', 'mantenimiento'
  fechaDisponible: { type: DataTypes.DATE, allowNull: true }
});

const Lote = sequelize.define('Lote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  proveedorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Proveedor, key: 'id' } },
  galponId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Galpon, key: 'id' } },
  loteId: { type: DataTypes.STRING, allowNull: false },
  cantidadMachos: { type: DataTypes.INTEGER, defaultValue: 0 },
  pesoPromedioMachos: { type: DataTypes.FLOAT, defaultValue: 0 },
  cantidadHembras: { type: DataTypes.INTEGER, defaultValue: 0 },
  pesoPromedioHembras: { type: DataTypes.FLOAT, defaultValue: 0 },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  cantidadInicial: { type: DataTypes.INTEGER, allowNull: false },
  pesoInicial: { type: DataTypes.FLOAT, allowNull: false },
  costoInicial: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  fechaIngreso: { type: DataTypes.DATE, allowNull: false },
  estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'disponible' }
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
  vacunaId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Inventario, key: 'id' } }, // Relación Inventario
  tipo: { type: DataTypes.STRING, allowNull: false },
  nombre: { type: DataTypes.STRING, allowNull: false },
  cantidad: { type: DataTypes.FLOAT, allowNull: false },
  fecha: { type: DataTypes.DATE, allowNull: false },
  fechaRetiro: { type: DataTypes.DATE, allowNull: true }
});

const Costo = sequelize.define('Costo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Lote, key: 'id' } },
  galponId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Galpon, key: 'id' } },
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

const Agenda = sequelize.define('Agenda', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  granjaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Granja, key: 'id' } },
  loteId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Lote, key: 'id' } },
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
  planVacunacion: { type: DataTypes.STRING, allowNull: true, defaultValue: "7,14,21" },
  logoUrl: { type: DataTypes.TEXT, allowNull: true }
});

// --- 2. DEFINIR RELACIONES ---

// --- RELACIONES DE USUARIOS Y GRANJAS ---
// Un usuario puede tener acceso a muchas granjas y una granja puede tener muchos usuarios.
User.belongsToMany(Granja, { through: UserGranja, foreignKey: 'userId' });
Granja.belongsToMany(User, { through: UserGranja, foreignKey: 'granjaId' });

// --- RELACIONES MAESTRAS DE LA GRANJA (Uno a Muchos) ---
// La Granja es la entidad principal. Si se borra una granja, se borra todo lo relacionado (CASCADE).
// Infraestructura y Configuración
Granja.hasMany(Galpon, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Galpon.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasOne(Config, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Config.belongsTo(Granja, { foreignKey: 'granjaId' });

// Entidades de Negocio
Granja.hasMany(Cliente, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Cliente.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Agenda, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Agenda.belongsTo(Granja, { foreignKey: 'granjaId' });

// Producción e Inventario (Relación directa con Granja para consultas rápidas y seguridad)
Granja.hasMany(Lote, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Lote.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Galpon, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Galpon.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Inventario, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Inventario.belongsTo(Granja, { foreignKey: 'granjaId' });

// Registros Operativos (También vinculados a Granja por seguridad)
Granja.hasMany(Seguimiento, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Seguimiento.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Salud, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Salud.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Costo, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Costo.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Venta, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Venta.belongsTo(Granja, { foreignKey: 'granjaId' });
Granja.hasMany(Agua, { foreignKey: 'granjaId', onDelete: 'CASCADE' });
Agua.belongsTo(Granja, { foreignKey: 'granjaId' });
// --- RELACIONES DE GALPONES Y LOTES ---
// Los lotes viven dentro de un galpón.
Galpon.hasMany(Lote, { foreignKey: 'galponId' });
Lote.belongsTo(Galpon, { foreignKey: 'galponId' });
Galpon.hasMany(Costo, { foreignKey: 'galponId', onDelete: 'CASCADE' });
Costo.belongsTo(Galpon, { foreignKey: 'galponId' });
// --- RELACIONES DE OPERACIÓN DEL LOTE (Uno a Muchos) ---
// El Lote es el centro de la producción. Si borras un lote, borras su historial.
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
Lote.hasMany(Agenda, { foreignKey: 'loteId', onDelete: 'CASCADE' });
Agenda.belongsTo(Lote, { foreignKey: 'loteId' });

// --- RELACIONES CON PROVEEDORES (Globales) ---
// Los proveedores existen independientemente, pero se vinculan a Lotes e Inventario.
Proveedor.hasMany(Lote, { foreignKey: 'proveedorId' });
Lote.belongsTo(Proveedor, { foreignKey: 'proveedorId' });
Proveedor.hasMany(Inventario, { foreignKey: 'proveedorId' });
Inventario.belongsTo(Proveedor, { foreignKey: 'proveedorId' });
// --- RELACIONES CON CLIENTES ---
// Los clientes compran a través de Ventas.
Cliente.hasMany(Venta, { foreignKey: 'clienteId' });
Venta.belongsTo(Cliente, { foreignKey: 'clienteId' });
// --- RELACIONES DE INVENTARIO Y CONSUMO ---
// Conectan el stock físico con el uso en los lotes.

// Alimento consumido en seguimiento
Inventario.hasMany(Seguimiento, { foreignKey: 'alimentoId', onDelete: 'SET NULL' });
Seguimiento.belongsTo(Inventario, { foreignKey: 'alimentoId' });

// Vacunas aplicadas en salud (Nueva Relación V 3.3)
Inventario.hasMany(Salud, { foreignKey: 'vacunaId', onDelete: 'SET NULL' });
Salud.belongsTo(Inventario, { foreignKey: 'vacunaId', as: 'Vacuna' }); // Alias para incluir nombre en consultas

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

    //await sequelize.sync({ force: true }); // Usar 1 VEZ para borrar y migrar
    await sequelize.sync({ alter: true }); // Usar esta línea para el día a día

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

app.get('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      // CORRECCIÓN: Incluir explícitamente las Granjas asociadas
      include: {
        model: Granja,
        attributes: ['id', 'nombre'],
        through: { attributes: [] } // Ocultar datos de la tabla intermedia
      },
      order: [['name', 'ASC']]
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar usuarios' });
  }
});

app.post('/users/:id/asignar-granjas', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const { granjaIds } = req.body; // Manamnama a listaan dagiti ID [1, 2]

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Ti 'setGranjas' ket automatiko a mangikkat kadagiti daan ken mangikabil kadagiti baro
    await user.setGranjas(granjaIds);

    res.json({ message: 'Asignación actualizada correctamente' });
  } catch (error) { res.status(500).json({ error: 'Error al asignar: ' + error.message }); }
});

app.put('/granjas/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const granja = await Granja.findByPk(req.params.id);
    if (!granja) return res.status(404).json({ error: 'Granja no encontrada' });

    await granja.update(req.body);
    res.json(granja);
  } catch (error) { res.status(500).json({ error: 'Error al actualizar granja' }); }
});

app.delete('/granjas/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const granja = await Granja.findByPk(req.params.id);
    if (!granja) return res.status(404).json({ error: 'Granja no encontrada' });

    // Borrar una granja es destructivo (cascade), cuidado
    await granja.destroy();
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Error al eliminar granja' }); }
});

// 2. Actualización Masiva de Granjas (El Checkbox)
app.post('/users/:id/asignar-granjas', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const { granjaIds } = req.body; // Esperamos un array [1, 3, 5]

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Método mágico de Sequelize: Borra las anteriores y pone las nuevas
    await user.setGranjas(granjaIds);

    res.json({ message: 'Asignación actualizada correctamente' });
  } catch (error) { res.status(500).json({ error: 'Error al asignar: ' + error.message }); }
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
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Ña-actualiza umi dato
    user.name = name;
    user.email = email;
    user.role = role;

    // SÓLO si oñembohasa contraseña pyahu, ña-encripta
    if (password && password.trim() !== '') {
      user.password = await bcryptjs.hash(password, 10);
    }

    await user.save();
    res.json({ message: 'Usuario actualizado', user });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.get('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { attributes: { exclude: ['password'] } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

app.delete('/users/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await user.destroy();
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
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

// --- CRUD GALPONES ---
app.get('/galpones', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const galpones = await Galpon.findAll({ where: { granjaId }, order: [['nombre', 'ASC']] });
    const hoy = new Date();
    const actualizados = [];
    for (let g of galpones) {
      if (g.estado === 'mantenimiento' && g.fechaDisponible && new Date(g.fechaDisponible) <= hoy) {
        await g.update({ estado: 'libre', fechaDisponible: null });
        g.estado = 'libre';
      }
      actualizados.push(g);
    }
    res.json(actualizados);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/galpones/liberar/:id', authenticate, async (req, res) => {
  try {
    // 1. Obtenemos granjaId (el helper busca en body o query)
    const granjaId = checkGranjaId(req);

    // 2. Buscamos el galpón asegurando que pertenezca a esa granja
    const galpon = await Galpon.findOne({ where: { id: req.params.id, granjaId } });

    if (!galpon) return res.status(404).json({ error: 'Galpón no encontrado o no pertenece a esta granja' });

    // 3. Actualizamos
    await galpon.update({ estado: 'libre', fechaDisponible: null });
    res.json({ message: 'Galpón liberado y listo para uso.' });
  } catch (e) {
    console.error(e); // Para ver el error real en los logs de Render
    res.status(500).json({ error: e.message });
  }
});

app.delete('/galpones/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const galpon = await Galpon.findOne({ where: { id: req.params.id, granjaId } });
    if (!galpon) return res.status(404).json({ error: 'No encontrado' });
    await galpon.destroy();
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Endpoint para "Liberar Galpón" manualmente
app.post('/galpones/liberar/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const galpon = await Galpon.findOne({ where: { id: req.params.id, granjaId } });
    if (!galpon) return res.status(404).json({ error: 'Galpón no encontrado' });

    await galpon.update({ estado: 'libre', fechaDisponible: null });
    res.json({ message: 'Galpón liberado y listo para uso.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- NUEVO: REGISTRAR MANTENIMIENTO (CONSUMO) ---
app.post('/mantenimiento', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { granjaId, galponId, tipoGasto, inventarioId, cantidad, monto, descripcion, fecha } = req.body;
    if (!granjaId || !galponId || !tipoGasto || !fecha) throw new Error('Datos incompletos');

    const galpon = await Galpon.findByPk(galponId);
    if (!galpon) throw new Error('Galpón no encontrado');

    let montoFinal = 0;
    let descFinal = descripcion;

    // A: Consumo de Inventario
    if (tipoGasto === 'Inventario') {
      if (!inventarioId || !cantidad) throw new Error('Seleccione producto y cantidad');
      const item = await Inventario.findOne({ where: { id: inventarioId, granjaId }, transaction: t });
      if (!item) throw new Error('Producto no encontrado en inventario');
      if (item.cantidad < cantidad) throw new Error(`Stock insuficiente de ${item.producto}`);

      await item.decrement('cantidad', { by: cantidad, transaction: t });

      montoFinal = cantidad * item.costo;
      descFinal = `MANTENIMIENTO: ${item.producto} (${cantidad} ${item.unidadMedida}) - ${descripcion}`;
    }
    // B: Gasto Directo
    else {
      if (!monto) throw new Error('Ingrese el monto del gasto');
      montoFinal = parseFloat(monto);
      descFinal = `MANTENIMIENTO: ${descripcion}`;
    }

    // Crear el Costo asociado al Galpón
    const costo = await Costo.create({
      granjaId,
      galponId,
      loteId: null,
      categoria: 'Mantenimiento',
      descripcion: descFinal,
      monto: montoFinal,
      fecha
    }, { transaction: t });

    await t.commit();
    res.status(201).json(costo);

  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
});

// --- Lotes ---
app.get('/lotes', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const lotes = await Lote.findAll({
      where: { granjaId },
      include: [
        { model: Proveedor, attributes: ['nombreCompania'] },
        { model: Galpon, attributes: ['nombre'] }
      ],
      order: [['fechaIngreso', 'DESC']]
    });
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
  const t = await sequelize.transaction();
  try {
    const { granjaId, loteId, galponId, cantidad } = req.body;
    if (!granjaId || !loteId || !galponId) throw new Error('Faltan datos');

    // 1. Validaciones (ID y Galpón)
    const existe = await Lote.findOne({ where: { loteId, granjaId }, transaction: t });
    if (existe) throw new Error('El ID de Lote ya existe');

    const galpon = await Galpon.findOne({ where: { id: galponId, granjaId }, transaction: t });
    if (!galpon || galpon.estado !== 'libre') throw new Error('Galpón ocupado o no existe');

    // 2. Crear Lote
    req.body.cantidadInicial = cantidad;
    const lote = await Lote.create(req.body, { transaction: t });
    await galpon.update({ estado: 'ocupado' }, { transaction: t });

    // 3. AUTOMATIZACIÓN V 4.2: CREAR AGENDA SANITARIA
    // Leemos la configuración de la granja
    const config = await Config.findOne({ where: { granjaId }, transaction: t });
    const planStr = config ? config.planVacunacion : "7,14,21";

    if (planStr) {
      const dias = planStr.split(',').map(d => parseInt(d.trim())).filter(n => !isNaN(n));
      const fechaIngreso = new Date(lote.fechaIngreso);

      // Creamos un evento de agenda por cada día del plan
      for (let dia of dias) {
        const fechaEvento = new Date(fechaIngreso);
        fechaEvento.setDate(fechaIngreso.getDate() + dia);

        await Agenda.create({
          granjaId: granjaId,
          loteId: lote.id, // Vinculamos al lote
          fecha: fechaEvento,
          descripcion: `Plan Sanitario (Día ${dia}): ${loteId}`,
          completado: false
        }, { transaction: t });
      }
      console.log(`Generados ${dias.length} eventos de agenda para ${loteId}`);
    }

    await t.commit();
    res.status(201).json(lote);
  } catch (error) { await t.rollback(); res.status(500).json({ error: error.message }); }
});
app.put('/lotes/:id', authenticate, async (req, res) => {
  try {
    const granjaId = checkGranjaId(req);
    const lote = await Lote.findOne({ where: { id: req.params.id, granjaId } });
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

    // Si editan cantidades, recalcular totales (si no se han vendido)
    // Nota: Esto es delicado si ya hubo ventas/muertes. Asumimos edición simple.
    const machos = req.body.cantidadMachos !== undefined ? parseInt(req.body.cantidadMachos) : lote.cantidadMachos;
    const hembras = req.body.cantidadHembras !== undefined ? parseInt(req.body.cantidadHembras) : lote.cantidadHembras;

    // Solo actualizamos el total si el lote está intacto (mismo stock que inicial)
    // Si no, requeriría lógica de ajuste más compleja.
    if (lote.cantidad === lote.cantidadInicial) {
      req.body.cantidad = machos + hembras;
      req.body.cantidadInicial = machos + hembras;
    }

    await lote.update(req.body);
    res.json(lote);
  } catch (error) { res.status(500).json({ error: error.message }); }
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
  const t = await sequelize.transaction();
  try {
    // Recibimos 'costoTotal' en lugar de unitario
    const { granjaId, proveedorId, producto, categoria, cantidad, costoTotal, fecha, unidadMedida } = req.body;

    if (!granjaId) throw new Error('granjaId requerido');

    // CÁLCULO AUTOMÁTICO: Costo Unitario = Total / Cantidad
    // Si costoTotal es 1500 y cantidad 1320 => 1.1363...
    const cantidadNum = parseFloat(cantidad);
    const costoTotalNum = parseFloat(costoTotal);

    if (cantidadNum <= 0) throw new Error('Cantidad debe ser mayor a 0');

    const costoUnitario = costoTotalNum / cantidadNum;

    const item = await Inventario.create({
      granjaId,
      proveedorId,
      producto,
      categoria,
      unidadMedida, // <-- Guardar unidadMedida
      cantidad: cantidadNum,
      costo: costoUnitario,
      fecha
    }, { transaction: t });

    await t.commit();
    res.status(201).json(item);

  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
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

// --- REGISTRAR USO/CONSUMO MANUAL ---
app.post('/inventario/consumo', authenticate, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { granjaId, inventarioId, cantidad, motivo, loteId } = req.body;
    if (!granjaId || !inventarioId || !cantidad) throw new Error('Faltan datos');

    // 1. Buscar el ítem
    const item = await Inventario.findOne({
      where: { id: inventarioId, granjaId },
      transaction: t
    });
    if (!item) throw new Error('Insumo no encontrado');

    // 2. Validar Stock
    if (item.cantidad < cantidad) {
      throw new Error(`Stock insuficiente. Disponible: ${item.cantidad} ${item.unidadMedida}`);
    }

    // 3. Restar Stock
    await item.decrement('cantidad', { by: cantidad, transaction: t });

    // 4. Generar Costo Financiero
    const costoTotal = cantidad * item.costo;
    const descLote = loteId ? ` (Lote Asignado)` : ` (General/Mantenimiento)`;

    await Costo.create({
      granjaId,
      loteId: loteId || null, // Si es null, es gasto general/mantenimiento
      categoria: item.categoria, // Mantiene la categoría (ej: Cama, Medicina)
      descripcion: `CONSUMO: ${item.producto} - ${motivo}${descLote}`,
      monto: costoTotal,
      fecha: new Date()
    }, { transaction: t });

    await t.commit();
    res.json({ message: 'Consumo registrado con éxito', nuevoStock: item.cantidad - cantidad });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
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
    const { granjaId, loteId, alimentoId, consumo, semana, peso, observaciones, fecha } = req.body;
    if (!granjaId) throw new Error('granjaId requerido');

    // 1. Crear el registro de seguimiento físico (peso, consumo kg)
    const seguimiento = await Seguimiento.create({
      granjaId, loteId, alimentoId, semana, peso, consumo, observaciones, fecha
    }, { transaction: t });

    // 2. Lógica de Alimento (Si se seleccionó un insumo)
    if (alimentoId && consumo > 0) {
      const alimento = await Inventario.findOne({ where: { id: alimentoId, granjaId }, transaction: t });

      if (!alimento) throw new Error('Alimento no encontrado en esta granja');
      if (alimento.cantidad < consumo) throw new Error(`Stock insuficiente. Quedan ${alimento.cantidad} kg de ${alimento.producto}`);

      // A. Descontar del Inventario Físico
      await alimento.decrement('cantidad', { by: consumo, transaction: t });

      // B. ¡MAGIA! Crear el Costo Financiero automáticamente
      const costoDinero = consumo * alimento.costo; // kg * precio_unitario

      await Costo.create({
        granjaId,
        loteId, // Asignado a este lote
        categoria: 'Alimento',
        descripcion: `CONSUMO AUTOMÁTICO: ${alimento.producto} (${consumo} kg)`,
        monto: costoDinero,
        fecha: fecha
      }, { transaction: t });
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
    const items = await Salud.findAll({
      where: { granjaId },
      include: [
        // Incluimos el nombre del producto (Vacuna)
        { model: Inventario, as: 'Vacuna', attributes: ['producto'] },
        // IMPORTANTE: Incluimos el nombre del Lote (esto faltaba)
        { model: Lote, attributes: ['loteId'] }
      ],
      order: [['fecha', 'DESC']]
    });
    res.json(items);
  } catch (error) {
    console.error("Error GET /salud:", error); // Ver error en consola del servidor
    res.status(500).json({ error: error.message });
  }
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
    // Recibimos vacunaId (opcional)
    const { granjaId, loteId, tipo, nombre, cantidad, vacunaId, fecha, fechaRetiro } = req.body;
    if (!granjaId || !loteId || !tipo || !nombre || !cantidad) throw new Error('Faltan campos obligatorios');

    const cantidadNum = parseFloat(cantidad);

    // 1. Crear registro de Salud
    const salud = await Salud.create({
      granjaId, loteId, tipo, nombre, cantidad: cantidadNum, vacunaId, fecha, fechaRetiro
    }, { transaction: t });

    // 2. Lógica Mortalidad (Resta aves del lote)
    if (tipo.toLowerCase() === 'mortalidad') {
      const lote = await Lote.findOne({ where: { id: loteId, granjaId }, transaction: t });
      if (!lote) throw new Error('Lote no encontrado');
      if (lote.cantidad < cantidadNum) throw new Error(`Mortalidad (${cantidadNum}) excede stock (${lote.cantidad})`);
      await lote.decrement('cantidad', { by: cantidadNum, transaction: t });
    }

    // 3. Lógica Vacunación (Resta dosis del inventario)
    if ((tipo.toLowerCase() === 'vacunación' || tipo.toLowerCase() === 'tratamiento') && vacunaId) {
      const insumo = await Inventario.findOne({ where: { id: vacunaId, granjaId }, transaction: t });
      if (!insumo) throw new Error('Insumo/Vacuna no encontrada en inventario');
      if (insumo.cantidad < cantidadNum) throw new Error(`Stock insuficiente de ${insumo.producto}. Quedan ${insumo.cantidad}`);

      await insumo.decrement('cantidad', { by: cantidadNum, transaction: t });

      // Opcional: Generar Costo financiero automático
      const costoDinero = cantidadNum * insumo.costo;
      await Costo.create({
        granjaId, loteId, categoria: 'Vacuna',
        descripcion: `CONSUMO AUTOMÁTICO: ${insumo.producto} (${cantidadNum} dosis)`,
        monto: costoDinero, fecha
      }, { transaction: t });
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
    const { granjaId, loteId, cantidadVendida, fecha } = req.body;
    if (!granjaId) throw new Error('granjaId requerido');

    // Check Bioseguridad
    const fechaVenta = new Date(fecha);
    const ultimoTratamiento = await Salud.findOne({ where: { loteId, granjaId, fechaRetiro: { [Op.gt]: fechaVenta } } });
    if (ultimoTratamiento) throw new Error(`Venta bloqueada. Retiro hasta: ${new Date(ultimoTratamiento.fechaRetiro).toLocaleDateString()}`);

    const lote = await Lote.findOne({ where: { id: loteId, granjaId }, transaction: t });
    if (!lote) throw new Error('Lote no encontrado');
    if (lote.estado !== 'disponible' || lote.cantidad < cantidadVendida) throw new Error(`Stock insuficiente (${lote.cantidad})`);

    const venta = await Venta.create(req.body, { transaction: t });

    // Calcular nuevo stock
    const nuevoStock = lote.cantidad - cantidadVendida;
    const nuevoEstado = nuevoStock > 0 ? 'disponible' : 'vendido';

    await lote.update({ cantidad: nuevoStock, estado: nuevoEstado }, { transaction: t });

    // --- LÓGICA V 4.2: SI SE VENDE TODO, GALPÓN A MANTENIMIENTO ---
    if (nuevoStock === 0) {
      const diasDesinfeccion = 7;
      const fechaLibre = new Date();
      fechaLibre.setDate(fechaLibre.getDate() + diasDesinfeccion);

      await Galpon.update({
        estado: 'mantenimiento',
        fechaDisponible: fechaLibre
      }, { where: { id: lote.galponId }, transaction: t });

      console.log(`Galpón ${lote.galponId} puesto en mantenimiento hasta ${fechaLibre}`);
    }

    await t.commit();
    res.status(201).json(venta);
  } catch (error) { await t.rollback(); res.status(500).json({ error: error.message }); }
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
      defaults: { granjaId, nombreGranja: 'Mi Granja', planVacunacion: "7,14,21" }
    });
    res.json(config);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/config', authenticate, async (req, res) => {
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
    // ... (validaciones iniciales igual) ...
    const { tipoReporte, loteId, fechaInicio, fechaFin, granjaId } = req.body;
    const whereClause = { granjaId: parseInt(granjaId), fecha: { [Op.between]: [new Date(fechaInicio), new Date(fechaFin)] } };
    if (loteId) whereClause.loteId = loteId;
    let data = [];

    switch (tipoReporte) {
      case 'liquidacion':
        if (!loteId) throw new Error('Selecciona un lote.');
        const lote = await Lote.findOne({ where: { id: loteId, granjaId }, include: [{ model: Proveedor, attributes: ['nombreCompania'] }] });
        if (!lote) throw new Error('Lote no encontrado');

        const ventas = await Venta.findAll({ where: { loteId, granjaId } });
        const costos = await Costo.findAll({ where: { loteId, granjaId } });
        const salud = await Salud.findAll({ where: { loteId, granjaId } });
        const seguimiento = await Seguimiento.findAll({ where: { loteId, granjaId } });

        const totalIngresos = ventas.reduce((sum, v) => sum + (v.peso * v.precio), 0);
        const totalCostosOperativos = costos.reduce((sum, c) => sum + c.monto, 0);

        // AQUÍ ESTÁ EL CAMBIO: Sumamos el costo de compra del lote
        const costoCompraLote = lote.costoInicial || 0;
        const totalCostosReales = totalCostosOperativos + costoCompraLote;

        const avesVendidas = ventas.reduce((sum, v) => sum + v.cantidadVendida, 0);
        const totalKilosCarne = ventas.reduce((sum, v) => sum + v.peso, 0);
        const mortalidad = salud.filter(s => s.tipo.toLowerCase() === 'mortalidad').reduce((sum, s) => sum + s.cantidad, 0);
        const consumoAlimento = seguimiento.reduce((sum, s) => sum + s.consumo, 0);

        const avesIniciadas = lote.cantidadInicial;
        const mortalidadPorc = avesIniciadas > 0 ? ((mortalidad / avesIniciadas) * 100).toFixed(2) : 0;
        const conversionAlimenticia = totalKilosCarne > 0 ? (consumoAlimento / totalKilosCarne).toFixed(3) : 0;
        const pesoPromedioVenta = avesVendidas > 0 ? (totalKilosCarne / avesVendidas).toFixed(3) : 0;

        const utilidadNeta = totalIngresos - totalCostosReales;
        const rentabilidad = totalCostosReales > 0 ? ((utilidadNeta / totalCostosReales) * 100).toFixed(2) : 0;

        data = [{
          lote: lote.loteId,
          proveedor: lote.Proveedor ? lote.Proveedor.nombreCompania : 'N/A',
          fechaIngreso: new Date(lote.fechaIngreso).toLocaleDateString(),
          avesIniciadas, avesVendidas,
          mortalidad: `${mortalidad} (${mortalidadPorc}%)`,
          pesoPromedio: `${pesoPromedioVenta} kg`,
          conversion: conversionAlimenticia,
          consumoTotal: `${consumoAlimento} kg`,

          // Datos financieros desglosados
          totalIngresos,
          costoOperativo: totalCostosOperativos,
          costoCompraLote: costoCompraLote, // Para mostrarlo en el reporte
          totalCostos: totalCostosReales,
          utilidad: utilidadNeta,
          rentabilidad: `${rentabilidad}%`
        }];
        break;

      // --- CASO 2: INVENTARIO VALORIZADO (NUEVO) ---
      case 'inventario-actual':
        // No usa fechas, es una foto del momento actual
        const inventario = await Inventario.findAll({
          where: { granjaId, cantidad: { [Op.gt]: 0 } }, // Solo lo que tiene stock > 0
          include: [{ model: Proveedor, attributes: ['nombreCompania'] }]
        });

        data = inventario.map(i => ({
          Producto: i.producto,
          Categoria: i.categoria,
          Proveedor: i.Proveedor ? i.Proveedor.nombreCompania : '-',
          Stock: i.cantidad,
          CostoUnit: i.costo.toFixed(4), // 4 decimales para precisión
          ValorTotal: (i.cantidad * i.costo).toFixed(2)
        }));

        // Añadir fila de total general
        const granTotal = inventario.reduce((sum, i) => sum + (i.cantidad * i.costo), 0);
        data.push({ Producto: 'TOTAL ACTIVOS', Categoria: '', Proveedor: '', Stock: '', CostoUnit: '', ValorTotal: granTotal.toFixed(2) });
        break;

      // --- CASO 3: HISTORIAL SANITARIO (NUEVO) ---
      case 'sanitario':
        const eventosSalud = await Salud.findAll({
          where: {
            ...whereClause,
            tipo: { [Op.or]: ['Vacunación', 'Tratamiento'] }
          },
          include: [{ model: Inventario, as: 'Vacuna', attributes: ['producto'] }, { model: Lote, attributes: ['loteId'] }],
          order: [['fecha', 'ASC']]
        });

        data = eventosSalud.map(s => ({
          Fecha: new Date(s.fecha).toLocaleDateString(),
          Lote: s.Lote ? s.Lote.loteId : 'N/A',
          Tipo: s.tipo,
          Producto: s.Vacuna ? s.Vacuna.producto : s.nombre,
          Dosis: s.cantidad,
          Retiro: s.fechaRetiro ? new Date(s.fechaRetiro).toLocaleDateString() : '-'
        }));
        break;

      case 'costos':
        const costosSimples = await Costo.findAll({ where: whereClause, include: [{ model: Lote, attributes: ['loteId'] }] });
        data = costosSimples.map(c => ({ Lote: c.Lote ? c.Lote.loteId : 'General', Categoria: c.categoria, Descripcion: c.descripcion, Monto: c.monto, Fecha: new Date(c.fecha).toLocaleDateString() }));
        data.push({ Lote: 'TOTAL', Categoria: '', Descripcion: '', Monto: costosSimples.reduce((s, c) => s + c.monto, 0), Fecha: '' });
        break;

      case 'ventas':
        const ventasSimples = await Venta.findAll({ where: whereClause, include: [{ model: Lote, attributes: ['loteId'] }, { model: Cliente, attributes: ['nombre'] }] });
        data = ventasSimples.map(v => ({ Lote: v.Lote?.loteId, Cliente: v.Cliente?.nombre, Cantidad: v.cantidadVendida, Peso: v.peso, Total: (v.peso * v.precio).toFixed(2), Fecha: new Date(v.fecha).toLocaleDateString() }));
        break;

      default:
        data = [{ Error: `Reporte '${tipoReporte}' no implementado.` }];
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al generar reporte: ' + error.message });
  }
});


// Inicia el servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor V 3.0 corriendo en puerto ${PORT}`));