const express = require('express');
const LTRutas = require('../../controlador/trabajadores/LoginTrabajadorControlador');
const HTRutas = require('../../controlador/trabajadores/ConsultarHorariosTrabajadorControlador');

const router = express.Router();

router.post('/trabajador/login', LTRutas.validarCredencial);
router.get('/trabajador/horarios/:idtrabajador', HTRutas.consultarHorarios);

module.exports = router;