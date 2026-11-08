/**
 * Árbol de categorías de incidencias, de profundidad libre.
 * Cada nodo es un objeto con `descripcion_global` y sus hijos; un hijo de tipo texto es una categoría final
 * (el texto es su descripción).
 */
const DESCRIPTION = 'descripcion_global';
export const isLeaf = (node) => typeof node === 'string';
export const describe = (node) => (isLeaf(node) ? node : node[DESCRIPTION]);
export const childrenOf = (node) => Object.entries(node).filter(([key]) => key !== DESCRIPTION);
export const pathId = (path) => path.join('/');

export const CATEGORIES = {
  mantenimiento: {
    descripcion_global: 'Incidencias relacionadas con la infraestructura física, mobiliario, seguridad de los recintos y limpieza.',
    instalaciones: {
      descripcion_global: 'Suministros y sistemas técnicos del edificio: climatización, electricidad y agua.',
      clima: 'Averías o desajustes en el aire acondicionado, calefacción o ventilación.',
      electricidad: 'Apagones, enchufes que no funcionan, cortocircuitos o problemas de iluminación.',
      fontaneria: 'Fugas de agua, atascos en baños, falta de suministro de agua o problemas de tuberías.'
    },
    mobiliario: {
      descripcion_global: 'Elementos físicos del edificio y del mobiliario dañados o defectuosos.',
      estructura: 'Desperfectos en paredes, techos, suelos o pintura del edificio.',
      muebles: 'Sillas, mesas, estanterías o cualquier otro mobiliario roto o defectuoso.',
      puertas_ventanas: 'Cristales rotos, puertas que no cierran, persianas atascadas o cerraduras rotas.'
    },
    seguridad: {
      descripcion_global: 'Sistemas de seguridad y control de acceso físico a los recintos.',
      alarmas: 'Fallos en el sistema de alarmas, cámaras de videovigilancia o sensores.',
      tornos: 'Problemas físicos con los tornos de acceso, barreras o puertas automáticas.'
    },
    limpieza: {
      descripcion_global: 'Higiene, suministros de aseo y gestión de residuos en las instalaciones.',
      higienicos: 'Falta de papel, jabón u otros suministros en los baños o zonas comunes.',
      residuos: 'Derrames, acumulación de basura o necesidad de retirada de residuos especiales.'
    }
  },
  informatica: {
    descripcion_global: 'Problemas técnicos con equipos, programas, redes, internet o ciberseguridad.',
    hardware: {
      descripcion_global: 'Equipos informáticos y dispositivos físicos que fallan o no funcionan.',
      pcs: 'Ordenadores de sobremesa, portátiles o monitores que no encienden o fallan físicamente.',
      perifericos: 'Fallos en ratones, teclados, auriculares, webcams o cables de conexión.',
      impresoras: 'Atascos de papel, fallos de impresión, escáner roto o falta de tóner/tinta.'
    },
    software: {
      descripcion_global: 'Programas y aplicaciones: errores, caídas o peticiones de instalación.',
      corporativo: 'Errores o caídas en el ERP, CRM, intranet o programas internos de la empresa.',
      ofimatica: 'Problemas con el correo electrónico, Word, Excel, Teams u otras herramientas diarias.',
      nuevas_instalaciones: 'Peticiones para instalar o actualizar programas que el usuario no tiene.'
    },
    redes: {
      descripcion_global: 'Conectividad: internet, red inalámbrica y telefonía.',
      internet: 'Caída total de la conexión a internet por cable o lentitud extrema en la red.',
      wifi: 'Problemas de cobertura, desconexiones o incapacidad para conectarse a la red inalámbrica.',
      telefonia: 'Averías en teléfonos fijos, móviles de empresa o centralitas telefónicas.'
    },
    cuentas: {
      descripcion_global: 'Accesos de usuario, credenciales, permisos y ciberseguridad.',
      passwords: 'Olvido, bloqueo o necesidad de reseteo de contraseñas para cualquier sistema.',
      permisos: 'Solicitud para acceder a carpetas compartidas, herramientas o cambio de roles.',
      virus: 'Sospecha de hackeo, correos de phishing, malware o alertas del antivirus.'
    }
  },
  logistica: {
    descripcion_global: 'Incidencias en la cadena de suministro, almacenes, envíos a clientes o flota de transporte.',
    recepcion: {
      descripcion_global: 'Entrada de mercancía procedente de proveedores.',
      roturas: 'Mercancía que llega de los proveedores golpeada, rota o en mal estado.',
      descuadres_albaran: 'Diferencias entre lo que dice el albarán del proveedor y lo que realmente ha llegado (sobra o falta).',
      retrasos: 'El proveedor no ha entregado la mercancía en la fecha acordada.'
    },
    almacen: {
      descripcion_global: 'Gestión interna del almacén: inventario, estado del producto y maquinaria.',
      descuadres_stock: 'El inventario físico del almacén no coincide con lo que marca el sistema informático.',
      caducidades: 'Productos almacenados que han superado su fecha de caducidad o se han deteriorado internamente.',
      maquinaria: 'Averías en carretillas elevadoras, transpaletas, cintas transportadoras o PDA de almacén.'
    },
    envios: {
      descripcion_global: 'Transporte y entrega de pedidos a los clientes.',
      retrasos_ruta: 'El transportista va con retraso y el pedido no llegará a tiempo al cliente.',
      entregas_fallidas: 'No se ha podido entregar el paquete (cliente ausente, dirección incorrecta o rechazo).',
      perdidas: 'El paquete se ha extraviado durante el trayecto y no aparece.'
    },
    flota: {
      descripcion_global: 'Vehículos de la empresa: averías, revisiones y siniestros.',
      averias: 'Problemas mecánicos o pinchazos en camiones, furgonetas o coches de empresa.',
      itv: 'Avisos o problemas relacionados con las revisiones mecánicas o ITV de los vehículos.',
      accidentes: 'Partes de seguro, golpes o siniestros con vehículos de la empresa.'
    }
  },
  comercial: {
    descripcion_global: 'Asuntos relacionados con clientes, ventas, quejas, cobros y campañas de marketing.',
    postventa: {
      descripcion_global: 'Atención al cliente después de la venta: quejas, devoluciones y fidelización.',
      quejas: 'Reclamaciones formales de clientes por mal servicio, mala atención o insatisfacción general.',
      devoluciones: 'Gestión de productos que el cliente quiere devolver (RMA) o uso de garantías.',
      fidelizacion: 'Problemas con puntos, tarjetas de socio o beneficios de clientes VIP.'
    },
    facturacion: {
      descripcion_global: 'Precios, cobros, facturas y terminales de punto de venta.',
      errores_precio: 'El sistema ha cobrado de más o no ha aplicado un descuento o promoción a un cliente.',
      cobros: 'Cargos duplicados al cliente, facturas con datos incorrectos o devoluciones de recibos.',
      tpv: 'Averías físicas o de software en los terminales de punto de venta (datáfonos o cajas).'
    },
    marketing: {
      descripcion_global: 'Material promocional, campañas, cupones y tienda online.',
      plv: 'Publicidad en el lugar de venta (carteles, expositores) que llega rota, falta o está desactualizada.',
      cupones: 'Códigos promocionales que dan error al introducirlos en la web o tienda.',
      web: 'Enlaces rotos, errores de visualización o caída de la tienda online (e-commerce).'
    },
    b2b: {
      descripcion_global: 'Relación con clientes corporativos: contratos y datos administrativos.',
      contratos: 'Incumplimientos de acuerdos de nivel de servicio (SLA) o disputas legales con clientes corporativos.',
      datos_fiscales: 'Solicitudes para cambiar el CIF, razón social o cuenta bancaria de un cliente de empresa.'
    }
  },
  rrhh: {
    descripcion_global: 'Incidencias internas del personal, pagos, prevención de riesgos y administración laboral.',
    gestion: {
      descripcion_global: 'Administración del personal: nóminas, prevención de riesgos y trámites laborales.',
      nominas: 'Errores en el cobro mensual, faltan horas extras, solicitud de anticipos o dudas con el IRPF.',
      prl: 'Accidentes de trabajo, riesgos ergonómicos, petición de material de seguridad (EPIs) o sillas adaptadas.',
      tramites: 'Problemas para registrar vacaciones, solicitar bajas médicas, permisos o pasar notas de gasto.'
    }
  },
  otros: {
    descripcion_global: 'Categoría comodín o de descarte para cuando una incidencia no encaja en ninguna otra.',
    sin_clasificar: {
      descripcion_global: 'Incidencias ambiguas, sin información suficiente o ajenas al resto de áreas.',
      desconocido: 'Clasifica aquí cualquier conversación, consulta o incidencia que sea ambigua, no tenga suficiente información para ser categorizada, o pertenezca a un ámbito totalmente ajeno a las categorías anteriores.'
    }
  }
};
