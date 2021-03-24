# Biblioteca de interacción con cadena de bloques hyperledger fabric

Colección de funciones para interactuar con la cadena de bloques. Usa las librerías fabric-client o fabric-network (a elección).

## Instalación

```
npm install --save cliente-blockchain-bo
```

## Requerimientos

Se conecta a una cadena de bloques mediante un contrato inteligente instalado en la blockchain, el nombre del contrato inteligente (*chaincode*) y las credenciales para la interacción se encuentran en archivos de configuración y llaves.

  - El **chaincode** se especifica en el archivo `config.yaml`. La ubicación de este archivo se especifica al inicializar esta biblioteca (ver ejemplos de inicialización).
  - Las **credenciales de conexión** se encuentran en los directorios `crypto-config`. La ubicación de estos directorios se especifica en el archivo `config.yaml`.
  - Para conectarse se requieren **credenciales de usuarios enrolados** que se guardan en carpetas.
    * En caso de usar **fabric-network** (recomendado) en una carpeta `wallet`
    * En caso de usar **fabric-client** (experimental) en una carpeta `hfc-key-store`

## Inicialización

```javascript
let blockchainClienteBo = require("cliente-blockchain-bo");

// Inicializar
const bcCliente = await blockchainClienteBo.iniciar("<ruta absoluta del archivo de configuracion config.yaml>");
if (bcCliente.iniciado === false) {
  // caso erroneo
  // console.log(boCliente.errors);
}

// ejemplo suponiendo que el archivo de configuracion config.yaml esta en el directorio actual
bcCliente = await blockchainClienteBo.iniciar(process.cwd() + '/config.yaml');

```

## Uso

### Fabric Network

Usando la biblioteca de inserción/consulta **recomendada**.

#### Introducir datos

```javascript
 
 try {
    let respuesta = await boClient.escribirRegistroFabricNetwork({
      fcn: 'funcion_fcn',
      chaincode: 'nombre_del_chaincode'
    },
                                                        // argumentos (todos deben ser string)
                                                        'argumento 1',
                                                        'argumento 2',
                                                        // ...
                                                        'argumento n'
                                                       );
	console.log('Respuesta en bruto:', respuesta);
    console.log('Respuesta toString:', respuesta.toString());
  } catch (e) {
    console.log(' --- error al escribir datos\n', e);
  }
```

#### Consultar datos

```javascript
  try {
    resp = await boClient.consultarRegistroFabricNetwork({
      chaincode: 'nombre del chaincode',         // opcional
      fcn: 'funcion fcn',                        // opcional
	  timeout: 20000,                            // opcional
    }, 'identificador es obligatorio');
    
	console.log('respuesta en bruto::', resp);
	console.log('respuesta toString()', resp.toString());
  } catch (e) {
    console.log('error al consultar:', e);
  }
```

### Fabric Client

Para escribir, la biblioteca selecciona al azar el *peer* al que envía la petición para escritura.

```javascript
// escribir
let resultado;
try { 
  // se indican parametros
  res = await boClient.escribirRegistro({
      identificador: 'identificador unico', 
      datos: datos,                         // array de datos que se van a introducir (de acuerdo al chaincode)
      timeout: 12000,                       // maximo tiempo de espera en este caso 12s. (opcional)
	  autogenerarIdentificador: false,      // Para obviar el identificador y usar el transaction_id como identificador unico (opcional)
      maximoIntentos: 3,                    // Indica maximo numero de intentos (opcional)
	  chaincode: 'nombre',                  // nombre de chaincode especifico (opcional)
	  fcn: 'funcionChaincode',              // funcion del chaincode a usar (opcional)
	  nArgIdentificador: <number>           // Para mandar el identificador como numero de argumento indicado (opcional)
    });
  if (resultado.finalizado !== true) {
    // error
  }
} catch(e) {
 // Error general
}

// consultar
let consulta;
try {
  consulta = await bcCliente.consultarRegistro('<identificador>');
  // otras formas de consultar
  // La siguiente especifica un timeout de 5000 ms, 5 intentos como maximo, usa el chaincode 'n1' y la funcion 'fcn1' de ese chaincode
  // consulta = await bcCliente.consultarRegistro('<identificador>', 5000, 5, 'n1', 'fcn1'); 

  if (consulta.finalizado !== true) {
    // caso erroneo
  }
  // mostrar datos
  console.log(consulta.resultado); 
  /* NOTA: consulta.resultado es la respuesta del chaincode y el tipo de respuesta esta definida por este. Si la respuesta fuese un buffer si es conveniente se puede convertir a cadena con:
  consulta.resultado.toString(); */
  } catch(e) {
    // .. caso erroeno..
  }
  
  
  // consultar detalles de una transaccion
  let detalles;
  try {
    detalles = await bcCliente.consultarDetallesTransaccion(<transaction_id>)
  } catch (e) {
    // caso erroneo
  }

  // Tambien existen los metodos que usan fabric-network: consultarRegistroFabricNetwork, escribirRegistroFabricNetwork, que hacen tareas similares *experimentales*.

```
### Archivo de configuración

El `<archivo de configuracion>` debe tener la estructura que se proporciona en el archivo `config.sample.yaml`.

Estructura del archivo de configuración:

```yaml
---
name: nombre-de-la-red
version: 1.0.0
user: Nombre de usuario enrolado
channel: Nombre del canal
# se recomiendan rutas absolutas
walletPath: "<ruta del directorio wallet>" # si se usa fabric-network
hfcKeyStorePath: "<ruta del directorio hfc-keysotre>" # si se usa fabric-client
chaincode:
  name: Nombre del chaincode
  fcns:
    introducir: createDoc
    consultar: queryDoc
	fcn1: nombreOtraFuncion1
    fcn2: nombreOtraFuncion2
client:
  organization: Nombre de la Organizacion
  connection:
    timeout:
      peer:
        endorser: '300'
organizations:
  Dominio:
    mspid: OrganizacionMSP
    peers:
    - peer0.dominio.gob.bo
    - peer1.dominio.gob.bo
    - peer2.dominio.gob.bo
    certificateAuthorities:
    - ca.gob.bo
peers:
  peer0.dominio.gob.bo:
    url: grpcs://<ip-peer0>:<puerto>
    tlsCACerts:
	  # recomendado usar rutas absolutas
      path: "/home/alguien/crypto-config/peerOrganizations/dominio.gob.bo/tlsca/tlsca.dominio.gob.bo-cert.pem"
    grpcOptions:
      ssl-target-name-override: peer0.dominio.gob.bo
  peer1.dominio.gob.bo:
    url: grpcs://<ip-peer1>:<puerto>
    tlsCACerts:
	  # recomendado usar rutas absolutas
      path: "/home/alguien/crypto-config/peerOrganizations/dominio.gob.bo/tlsca/tlsca.dominio.gob.bo-cert.pem"
    grpcOptions:
      ssl-target-name-override: peer1.dominio.gob.bo
  peer2.dominio.gob.bo:
    url: grpcs://<ip-peer2>:<puerto>
    tlsCACerts:
	  # recomendado usar rutas absolutas
      path: "/home/alguien/crypto-config/peerOrganizations/dominio.gob.bo/tlsca/tlsca.dominio.gob.bo-cert.pem"
    grpcOptions:
      ssl-target-name-override: peer2.dominio.gob.bo
certificateAuthorities:
  ca.gob.bo:
    url: https://<ip-ca>:<puerto>
    caName: ca.gob.bo
    tlsCACerts:
	  # recomendado usar rutas absolutas
      path: "/home/alguien/crypto-config/peerOrganizations/dominio.gob.bo/tlsca/tlsca.dominio.gob.bo-cert.pem"
    httpOptions:
      verify: false
```

### Nota sobre resolución de dominios

En algunos casos es necesario hacer que el sistema resuelva la dirección IP de los peers por ejemplo si `peer0.dominio.gob.bo` apunta a la ip: `192.168.1.100`, en Debian se puede asociar ips y dominios agregando en `/etc/hosts`, por ejemplo:

```
192.168.1.100 peer0.dominio.gob.bo
192.168.1.102 peer1.dominio.gob.bo
192.168.1.104 peer2.dominio.gob.bo
192.168.1.103 ca.gob.bo
192.168.1.105 orderer.gob.bo
```

### Ejemplos de uso básico

Primero se require instalar todas las dependencias y ajustar el archivo `config.yaml`.

### Fabric network (recomendado)

Script `test-fabric-network.js`, se ejecuta con `node test-fabric-network.js`.

```javascript
const blockchainClienteBo = require('cliente-blockchain-bo');

async function main() {
  const boClient = await blockchainClienteBo.iniciar(process.cwd() + '/config.yaml');
  console.log('boCLiente Object Inicializacion:::', boClient);

  let resp;
  // // escribir enviando un identificador
  const chaincodeName = 'chaincodeprueba';

  let n = Math.random()*99999999999;
  let hashDatos = '702996976c';
  let ci = '900900900';
  let nombres = 'Lucaz Monsar';
  let primer_apellido = 'Tritón';
  let segundo_apellido = 'Montes';
  let descripcion = 'Registro-de-pruebas';
  let extra = 'Algoritmo Hash Usado: sha256';

  let tx_id;
  
  // // escribir datos
  console.log(`Escribir por chaincode ${chaincodeName}:`);
  console.log('-----------------------------------------------------------------------------');
  try {
    resp = await boClient.escribirRegistroFabricNetwork({
      autogenerarIdentificador: true,
      timeout: 12000, 
      fcn: 'initDoc',
      chaincode: chaincodeName
    },
                                                        // argumentos
                                                        hashDatos,
                                                        ci,
                                                        nombres,
                                                        primer_apellido,
                                                        segundo_apellido,
                                                        descripcion,
                                                        extra                                                       
                                                       );
    console.log('------------ detalles respuesta');
    console.log(resp);
    console.log('--- to String');
    console.log(resp);
    let respuesta = JSON.parse(resp.toString());
    tx_id = respuesta.TxId; // transaction_id
    console.log('--- JSON.parse .... to String');
    console.log(JSON.parse(resp.toString()));
    console.log(respuesta.Timestamp);
    console.log(respuesta.TxID);
    console.log('--- respuesta.Value');
    console.log(respuesta.Value);
  } catch (e) {
    console.log(' --- error al escribir datos\n', e);
  }
  console.log('------ end escribir ---');
  setTimeout(async () => {
    // consultar datos
    console.log(`\nConsultar por CI (historico) ${ci}`);
    console.log('-----------------------------------------------------------------------------');
    try {
      resp = await boClient.consultarRegistroFabricNetwork(
        {
          chaincode: chaincodeName,
          fcn: 'queryDocsByCI'
        },
        ci // identificador para la consulta
      );
      console.log('---- resultado (completo)');
      console.log(resp);
      console.log('---- res.resultado.toString()');
      console.log(resp.toString(), '\n\n');
      let parsed = JSON.parse(resp.toString());
      console.log(parsed);
      console.log('ci:', parsed[0].Record.ci);
      console.log('hashdatos:', parsed[0].Record.hashdatos);
      console.log('transactionid:', parsed[0].Record.transactionid);
      console.log('nombres:', parsed[0].Record.nombres);
      
    } catch (e) {
      console.log('Error consulta:', e);
    }

    
    console.log(`\nConsultar por hash (historico) ${hashDatos}`);
    console.log('-----------------------------------------------------------------------------');
    try {
      resp = await boClient.consultarRegistroFabricNetwork({
        chaincode: chaincodeName,
        fcn: 'getHistoryForDoc'
      }, hashDatos);
      console.log('---- resultado (completo)');
      console.log(resp);
      console.log('---- res.resultado.toString()');
      console.log(resp.toString(), '\n\n');
      console.log(JSON.parse(resp.toString()));
    } catch (e) {
      console.log('Error consulta:', e);
    }

    process.exit(0);
  }, 3550);
}

main();
```
#### Fabric client

Script `test-fabric-client.js`, se ejecuta con `node test-fabric-client-js`.

```javascript
const blockchainClienteBo = require('cliente-blockchain-bo');

async function main() {
  const boClient = await blockchainClienteBo.iniciar(process.cwd() + '/config.yaml');

  let res;
  // escribir enviando un identificador
  console.log('\n---------- escribir con identificador dado ------------------');
  let identificador = Math.random()*1000000; // numero al azar
  // siempre un array, en este caso un array de un elemento.
  let datos = [JSON.stringify({
    'argumento1',                   // arg1
    45121.1141,                     // arg2
    razon: `Pruebas con id ${identificador}` // arg3
  })];
  let tx_id;
  try {
    res = await boClient.escribirRegistro({
      identificador: 'test' + identificador,
      datos: datos,
      timeout: 12000,
	  chaincode: 'c1',
	  fcn: 'createDoc'
    });
    console.log('Escribir resultado::::::::::', res);
    tx_id = res.resultado.tx_id; // transaction_id
  } catch (e) {
    console.log('escribir error::::::', e);
  }

  console.log('consultar:::::::::::::');
  try {
    res = await boClient.consultarRegistro('test' + identificador);
    console.log('resultado.toString():::::', res.resultado.toString());
  } catch (e) {
    console.log('consultar error xxxxx', e);
  }

  // escribir usando el transaction_id como identificador
  try {
    console.log('\n escribir usando transaction_id como identificador ------------------------');
    datos = [JSON.stringify({
      razon: `Introduciendo datos con transaction_id como identificador`,
      adicional: `test ${Math.random()*1000000}`
    })];
    res = await boClient.escribirRegistro({
      datos: datos,
      timeout: 12000,
      autogenerarIdentificador: true
    });
    console.log('Escribir resultado:::::::::::::::::', res);
    tx_id = res.resultado.tx_id;
  } catch (e) {
    console.log('escribir error::::::', e);
  }

  console.log('consultar por transaction_id:::::::::::::');
  try {
    res = await boClient.consultarRegistro(tx_id);
    console.log('resultado.toString() ::::::', res.resultado.toString());
  } catch (e) {
    console.log('consultar error xxxxx', e);
  }
  
  console.log('consultar detalles de una trasaccion::::::::::::::::::');
  try {
    const util = require('util');
    res = await boClient.consultarDetallesTransaccion(tx_id);
    console.log('res.resultado\n:', util.inspect(res.resultado, {showHidden: false, depth: null}));
  } catch (e) {
    console.log('Error:', e);
  }

  process.exit(0);
}

main();
```

