const express = require('express');
const cors = require('cors');
//const rutacliente = require('./vista/ClienteRutas');
//const rutaadmin = require('./vista/AdminRutas');
const app = express();
const PORT = process.env.PORT || 3333;

// Midleware
app.use(cors({
    origin: '*', // Cambiar ['https://guillodelapena.xo.je/evidencias/', 'http://yo.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'], // Encabezados permitidos
    credentials: true // Habilita el envío de credenciales si es necesario
  }));

// Midleware para parseo de solicitudes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Rutas 
//app.use('/', rutacliente);
//app.use('/seguridad', rutaadmin);
app.get('/', (req, res) => {
    res.send('¡Hola desde mi servidor en Node.js!');
});
// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });