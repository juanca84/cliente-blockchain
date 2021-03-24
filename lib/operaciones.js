/**
 * @fileOverview Conjunto de operaciones para interactuar con el registro de orden cronológico y temporalidad Boliviano.
 * @name operaciones.js
 * @author Rodrigo Garcia <rgarcia@agetic.gob.bo> 2019
 * @license LPG-Bolivia
 */
'use strict';
const util = require('util');
const { FileSystemWallet, Gateway } = require('fabric-network');

/**
 * Cliente cadena de bloques 
 * @param {object} bo: Blockchain Object, se genera instanciando la biblioteca llamando a ../index.js iniciar()
*/
module.exports = (bo) => {
  const utils = require('./utils')(bo);

  /**
   * Consultar detalles de transaccion completada
   * @param {string} tx_id: transaction_id
   * @param {Object} peer (opcional): peer del canal seleccionado para hacer la consultar
   */
  const consultarDetallesTransaccion = async (tx_id, peer) => {
    let resultado = {};

    try {
      let detalles;
      if (peer) {
        detalles = await bo.channel.queryTransaction(tx_id, peer);
      } else {
        detalles = await bo.channel.queryTransaction(tx_id);
      }
      resultado.finalizado = true;
      resultado.resultado = detalles;
      resultado.error = null;
      return resultado;
    } catch (error) {
      resultado.finalizado = false;
      resultado.resultado = null;
      resultado.error = error;
    } finally {
      return resultado;
    }
  };

  /**
   * Recibe un `identificador' y consulta si existe un registro con ese `identificador' en la blockchain, retorna el registro devuelto, si no se especifica el argmuento `chaincode' y/o `fcn' usa el chaincode y funcion indicada en el archivo de configuracion "config.yaml". Retorna la respuesta del chaincode.
   * @param {string} identificador: Identificador
   * @param {int} timeout: (opcional, por defecto 7500) timeout en ms máximo para esperar una respuesta.
   * @param {int} maximoIntentos: (opcional, por defecto 2) Número máximo de intentos en caso de no recibir respuesta favorable antes de asumir que la consulta ha falldo.
   * @param {string} chaincode: (opcional) 
   * @param {string} fcn: (opcional)
   */
  const consultarRegistro = async (identificador, timeout = 7500, maximoIntentos = 2, chaincode = '', fcn = '') => {
    // console.log(` [cliente-blockchain-bo] (fabric-client):  consultado por identificador: ${identificador}`);

    let terminado = false;
    let resultado = {
      finalizado: false,
      resultado: null
    };

    while(maximoIntentos > 0 && !terminado) {
      console.log('[cliente-blockchain-bo]: Intentos restantes', maximoIntentos);
      try {
        resultado = await utils.consultarPorChainCodeFabricClient(identificador, timeout, chaincode, fcn);
        terminado = resultado.finalizado;
      } catch (e) {
        console.error('[cliente-blockchain-bo] Error consultado:', e);
      }
      maximoIntentos -= 1;
    }
    return resultado;
  };

  /**
   * @description Recibe un `identificador' y consulta si existe ese registro en el blockchain, retorna el objeto devuelto y detalles de la consulta.
   * Usa fabric-network como libreria de peticion
   * @arg identificador 
   * @return {Buffer} Respuesta en bruto del chaincode
   */
  const consultarRegistroFabricNetwork = async (argumentos, identificador) => {
    // console.log(` [cliente-blockchain-bo] (fabric-network):  consultado por identificador: ${identificador}`);
    let timeout = argumentos.timeout ? argumentos.timeout : 12500;
    return new Promise(async (resolve, reject) => {
      let terminado = false;
      // controlando tiempo para evitar que la funcion que lo llama espere indefinidamente.
      setTimeout(() => {
        if (terminado != true) {
          console.log('[cliente-blockchain-bo] consultarRegisgroFabricNetwork:  Timeout expirado', timeout);
          reject(new Error(`Timeout ${timeout} ms expirado`));
        }
      }, timeout);
      //const result = await bo.contract.evaluateTransaction(bo.config.chaincode.fcns.consultar, identificador);
      try {
        const resultado = await utils.consultarPorChaincodeFabricNetwork(argumentos, identificador);
        resolve(resultado);
      } catch (e) {
        reject(e);
      }
    });
  };
  
  /**
   * Registra la solicitud en la cadena de bloques, por defecto se usa el chaincode y funcion `introducir' espeficicada en el archivo config.yaml. Se puede especificar un chaincode y funcion distinta.
   * Basado en: https://github.com/hyperledger/fabric-samples/blob/release-1.4/fabcar/javascript-low-level/invoke.js
   * @param {Object} Argumentos de consulta... tiene la forma:
     {
       identificador: 'El identificador que se va a usar', (opcional en caso de usar autogenerarIdentificador)
       datos: ['arreglo con los datos a introducir'], // se envian de la misma forma mediante el chaincode.
       autogenerarIdentificador: true/false    // (false por defecto) si es true usa el transaction_id como identificador para esta transaccion
       timeout: 10000,                         // (9500 por defecto) Timeout maximo de espera para introducir esta peticion.
       // -- opcionales --
       chaincode: 'nombre',                    // esto por si se require usar un chaincode distinto al especificado en config.yaml
       fcn: 'funcionChaincode',                // nombre de la funcion especifica del chaincode 
       nArgIdentificador: <number>,            // en caso de que exista manda como este numero de argumento el identificador.
     }
   * @return {Object} json: Resultado del intento de registro:
   * {
       transaction_id: 'Id de la transaccion',
       finalizado: true/false,
       error: 'Mensaje en caso de error'
     }
   */
  const escribirRegistro = async ( argumentos ) => {
    if (argumentos.autogenerarIdentificador) {
      // console.log(`[cliente-blockchain-bo] (fabric-client): Escribir registro con identificador autogenerado (transaction_id)`);
    } else {
      // console.log(`[cliente-blockchain-bo] (fabric-client): Escribir registro: ${argumentos.identificador}`);
    }
    // validaciones preliminares
    let terminado = false;
    let resultado = {
      finalizado: false,
      resultado: null
    };
    let maximoIntentos = 2;
    if (argumentos.maximoIntentos) {
      maximoIntentos = argumentos.maximoIntentos;
    }
    if (argumentos.datos.length === 0) {
      resultado.finalizado = false;
      resultado.resultado = null;
      resultado.error = 'No se puede introducir una cadena vacía';
      return resultado;
    }

    while(maximoIntentos > 0 && !terminado) {
      console.log('[cliente-blockchain-bo] Escribir registro, intentos restantes:', maximoIntentos);
      try {
        resultado = await utils.escribirPorChaincodeFabricClient(argumentos);
        terminado = resultado.finalizado;
      } catch (e) {
        console.error('[cliente-blockchain-bo] Error escribiendo:', e);
        resultado.finalizado = false;
        resultado.resultado = null;
        resultado.error = 'Error escribiendo: ' + e;
      }
      maximoIntentos -= 1;
    }
    
    return resultado;
  };

  const escribirRegistroDevolverDetalles = async (argumentos) => {
    if (argumentos.autogenerarIdentificador) {
      // console.log(`[cliente-blockchain-bo] (fabric-client): Escribir registro devolver detalles: con identificador autogenerado (transaction_id)`);
    } else {
      // console.log(`[cliente-blockchain-bo] (fabric-client): Escribir registro devolver detalles: ${argumentos.identificador}`);
    }

    let terminado = false;
    let resultado = {
      finalizado: false,
      resultado: null
    };
    let maximoIntentos = 2;
    if (argumentos.maximoIntentos) {
      maximoIntentos = argumentos.maximoIntentos;
    }
    let mi = maximoIntentos;
    if (argumentos.datos.length === 0) {
      resultado.finalizado = false;
      resultado.resultado = null;
      resultado.error = 'No se puede introducir una cadena vacía';
      return resultado;
    }
    while(maximoIntentos > 0 && !terminado) {
      // console.log('[cliente-blockchain-bo] Escribir registro devolver detalles, intentos restantes:', maximoIntentos);
      try {
        resultado = await utils.escribirPorChaincodeFabricClient(argumentos);
        terminado = resultado.finalizado;
        if (terminado === true) {
          // obteniendo el timestamp
          let detalles;
          let dt = false;
          // consulta de detalles
          while(mi > 0 && !dt) {
            try {
              // escogiendo peer de consulta al azar
              let i = 0;
              let selectionPeers = [];
              for(let peer of bo.channel['_channel_peers']) {
                selectionPeers.push(peer);
                i += 1;
              }
              let selectedPeer = selectionPeers[parseInt(Math.random()*i)][1]['_peer'];
              detalles = await consultarDetallesTransaccion(resultado.resultado.tx_id, selectedPeer);
              dt = detalles.finalizado;
              if (dt) {
                resultado.detalles = detalles.resultado;
                resultado.timestamp = detalles.resultado.transactionEnvelope.payload.header.channel_header.timestamp;
              }
            } catch (e) {
              console.error('[cliente-blockchain-bo] Error consultado detalles de transaccion');
            }
            mi--;
          }
        }
      } catch (e) {
        console.error('[cliente-blockchain-bo] Error escribiendo:', e);
        resultado.finalizado = false;
        resultado.resultado = null;
        resultado.error = 'Error escribiendo: ' + e;
      }
      maximoIntentos -= 1;
    }
    return resultado;
  };

  /**
   * Registra la solicitud en la cadena de bloques de acuerdo al chaincode definido. Si al cabo de `timeout (10000 ms por defecto)' no se termina de introducir la solicitud se ignora el resultado y retorna como transaccion pendiente.
   */
  const escribirRegistroFabricNetwork = async (argumentos, ...datos) => {
    // TODO: agregar timeout
    try {
      let resultado = await utils.escribirPorChaincodeFabricNetwork(argumentos, ...datos);
      return resultado;
    } catch (e) {
      console.error('[cliente-blockchain-bo] escribirPorChaincodeFabricNetwork - Error: ', e);
      throw new Error(e);
    }
  };

  
  
  return {
    consultarRegistro,
    escribirRegistro,
    consultarRegistroFabricNetwork,
    escribirRegistroFabricNetwork,
    escribirRegistroDevolverDetalles,
    consultarDetallesTransaccion
  };
};
