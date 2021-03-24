/**
 * @fileOverview Utilitarios variados para interactuar con el registro de orden cronológico y temporalidad Boliviano.
 * @name util.js
 * @author Rodrigo Garcia <rgarcia@agetic.gob.bo> 2019
 * @license LPG-Bolivia
 */

const util = require('util');
const { Gateway } = require('fabric-network');

module.exports = (bo) => {
  const consultarPorChainCodeFabricClient = async (identificador, timeout, _chaincode = '', _fcn = '') => {

    let chaincode = _chaincode !== '' ? _chaincode : bo.config.chaincode.name;
    let fcn = _fcn !== '' ? _fcn : bo.config.chaincode.fcns.consultar;
    
    return new Promise((resolve, reject) => {
      let terminado = false;
      let resultado = {};

      // controlando tiempo para evitar que la funcion que lo llama espee indefinidamente.
      setTimeout(() => {
        if (terminado != true) {
          // console.log('[cliente-blockchain-bo]:  Timeout expirado', timeout);
          resultado.finalizado = false;
          resultado.resultado = null;
          resultado.error = `Timeout ${timeout} ms expirado`;
          // console.log(' timeout expirado (consultar) :D', timeout);
          reject(resultado);
        }
      }, timeout);

      // let selectionPeers = [];
      // for(let peer of bo.channel['_channel_peers']) {
      //   selectionPeers.push(peer[1]['_peer']);
      // }
      // console.log('selection Peers:', selectionPeers);
      const request = {
        // targets: selectionPeers,
        chaincodeId: chaincode,
        fcn: fcn,
        args: [identificador]
      };
      
      bo.channel.queryByChaincode(request).then((query_responses) => {
        // console.log("Query has completed, checking results");
        // console.log('>>>', query_responses);
        // console.log('-------------------------------------------');
        // console.log('-------------------------------------------');

        // query_responses could have more than one  results if there multiple peers were used as targets
        if (query_responses && query_responses.length >= 1) {
          // multiples peers
          if (query_responses.length > 1) {
            resultado.error = [];
            let i;
            // buscando la respuesta positiva de al menos un peer
            for(i = 0; i < query_responses.length; i ++) {
              if (query_responses[i] instanceof Error) {
                // console.log('Instancia de error ᙭:', query_responses[i]);
                // console.log(' to String()', query_responses[i].toString());
                resultado.error.push(query_responses[i].Error);
              } else {
                // console.log(' ✓  Encontrado uno exitoso:::', query_responses[i], query_responses[i].length);
                if (query_responses[i].length == 0) {
                  // un registro vacio indica tambien datos inexistentes
                  terminado = false;
                  resultado.error.push('No se han encontrado datos');
                } else {
                  terminado = true;
                  resultado.finalizado = true;
                  resultado.resultado = query_responses[i];
                  delete resultado.error;
                  break;
                }
              }
            }
            resultado.finalizado = terminado;
          } else { // solo un peer
	    if (query_responses[0] instanceof Error) {
	      console.error("[cliente-blockchain-bo] error from query = ", query_responses[0]);
              resultado.finalizado = false;
              resultado.error = 'No se han encontrado datos';
	    } else {
	      // console.log("Response is ", query_responses[0].toString());              
              terminado = true;
              resultado.finalizado = true;
              resultado.resultado = query_responses[0];
	    }
          }
        } else {
	  // console.log("[cliente-blockchain-bo] No payloads were returned from query");
          terminado = true;
          resultado.finalizado = false;
          resultado.resultado = query_responses[0];
          resultado.error = "No payloads were returned from query";
        }
        resolve(resultado);
      }).catch(err => {
        console.error('[cliente-blockchain-bo] Failed to query successfully :: ' + err);
        resultado.finalizado = false;
        resultado.resultado = null;
        resultado.error = err;
        reject(resultado);
      });
    });

  };


  /**
   * Registra la solicitud en la cadena de bloques. Si no se especifica `chaincode' y/o nombre de funcion del chaincode como argumento se utiliza la funcion `introducir' especificada en el archivo config.yaml.
   * Basado en: https://github.com/hyperledger/fabric-samples/blob/release-1.4/fabcar/javascript-low-level/invoke.js
   * @param {Object} Argumentos de consulta... tiene la forma:
     {
       identificador: 'El identificador que se va a usar',
       datos: ['arreglo con los datos a introducir'], // se envian de la misma forma mediante el chaincode.
       autogenerarIdentificador: <true>/<false> // (false por defecto) si es true usa el transaction_id como identificador para esta transaccion
       timeout: 10000, // (9500 por defecto) Timeout maximo de espera para introducir esta peticion.
       // -- opcionales --
       chaincode: 'nombreChaincode',
       fcn: 'funcionChaincode',
       nArgIdentificador: <number>            // en caso de que exista manda como este numero de argumento el identificador.
     }
   * @return {Object} json: Resultado del intento de registro:
   * {
       transaction_id: 'Id de la transaccion',
       finalizado: true/false,
       error: 'Mensaje en caso de error'
     }
   */
  const escribirPorChaincodeFabricClient = async (argumentos) => {
    let terminado = false;
    let resultado = {};

    let timeout = 9500;
    if (argumentos.timeout) {
      timeout = argumentos.timeout;
    }
    
    // transaction_id
    const tx_id = bo.fabric_client.newTransactionID();
    const transaction_id_string = tx_id.getTransactionID();
    // determinando el identificador de la transaccion
    let identificadorTransaccion;
    if (argumentos.autogenerarIdentificador) {
      identificadorTransaccion = transaction_id_string;
    } else {
      identificadorTransaccion = argumentos.identificador;
    }
    
    // armando el request
    // TODO: aqui definir la manera en que se seleccionan los peers
    //       temporalmente se selecciona un peer al azar
    let i = 0;
    let selectionPeers = [];
    for(let peer of bo.channel['_channel_peers']) {
      selectionPeers.push(peer);
      i += 1;
    }
    let selectedPeer = selectionPeers[parseInt(Math.random()*i)][1]['_peer'];

    // armando el array que se introduce en el chaincode
    // orden de los argumentos pasados
    let args = argumentos.datos.slice();
    if (argumentos.nArgIdentificador) {
      args.splice(argumentos.nArgIdentificador, 0, identificadorTransaccion);
    } else {
      // introduciendo como primer argumento
      args.unshift(identificadorTransaccion);
    }
    
    // armando la propuesta
    const proposal_request = {
      targets: [selectedPeer], // Se podria enviar la misma propocision a varios peers
      chaincodeId: argumentos.chaincode !== undefined ? argumentos.chaincode : bo.config.chaincode.name,
      fcn: argumentos.fcn !== undefined ? argumentos.fcn : bo.config.chaincode.fcns.introducir,
      args: args,
      chainId: bo.config.channel,
      txId: tx_id
    };
    
    // enviando propuesta de endorsamiento
    let endorsement_results;
    try {
      endorsement_results = await bo.channel.sendTransactionProposal(proposal_request);
    } catch (e) {
      console.error(util.format('[cliente-blockchain-bo] Error enviando propuesta de transaccion: error - ', e));
    }

    // resultados de respuesta de propocision de endorsamiento
    // TODO: ver el caso cuando la propocision se manda a varios peers
    const proposalResponses = endorsement_results[0];
    const proposal = endorsement_results[1];
    if (proposalResponses[0] instanceof Error) {
      console.error('[cliente-blockchain-bo] Failed to send Proposal. Received an error :: ' + proposalResponses[0].toString());
      throw proposalResponses[0];
    } else if (proposalResponses[0].response && proposalResponses[0].response.status === 200) {
      // console.log(util.format(
	//'[cliente-blockchain-bo] Successfully sent Proposal and received response: Status - %s',
      //proposalResponses[0].response.status));
    } else {
      const error_message = util.format('[cliente-blockchain-bo] Invoke chaincode proposal:: %j', proposalResponses[i]);
      console.error(error_message);
      // retornar error
      // ..
      throw new Error(error_message);
    }
    
    const commit_request = {
      proposalResponses: proposalResponses,
      proposal: proposal
    };

    // obteniendo timestamp que el chaincode devuelve en el payload.
    let timestamp;
    try {
      timestamp = proposalResponses[0].response.payload.toString();
    } catch (e) {
      console.error('[cliente-blockchain-bo] Error obteniendo o decodificando el timestamp');
    }

    const promises = [];

    const sendPromise = bo.channel.sendTransaction(commit_request);
    promises.push(sendPromise);
    // event hub asociado con el peer
    // TODO: ver el caso cuando son varios peers
    let event_hub = bo.channel.newChannelEventHub(selectedPeer);
    // console.log('event_hub:::', event_hub);
    try {
      // TODO: controlar si se ha generado un error en los pasos anteriores retornar de la promesa con error
      // ..
      
      let txPromise = new Promise((resolve, reject) => {
        // timeout adicional si la transaccion falla en hacer commit
        let handle = setTimeout(() => {
          event_hub.unregisterTxEvent(transaction_id_string);
	  event_hub.disconnect();
	  resolve({event_status : 'TIMEOUT'});
        }, timeout);

        // registrando un listener con el event hub
        event_hub.registerTxEvent(transaction_id_string, (tx, code, block_num) => { // on event
          // console.log('event_hub.registerTxEvent ejecutado');
          // console.log('Transaction %s has status of %s in block_num: %s', tx, code, block_num);
          clearTimeout(handle);

          const return_status = { event_status : code, tx_id : transaction_id_string };
          // console.log('return status', return_status);
          if (code !== 'VALID') {
            console.error('[cliente-blockchain-bo] The transaction was invalid, code = ', code);
            resolve(return_status);
          } else {
            console.log('[cliente-blockchain-bo] La transacción ha hecho commit en el peer:', event_hub.getPeerAddr());
            resolve(return_status);
          }
        }, (err) => {
          console.error('There was a problem with the eventhub ::'+err);
          reject(new Error('There was a problem with the eventhub ::'+err));
        },{ disconnected: true } // desconectar al completar
                                 );

        // now that we have a protective timer running and the listener registered,
	// have the event hub instance connect with the peer's event service
	event_hub.connect();
	// console.log('[cliente-blockchain-bo] Registered transaction listener with the peer event service for transaction ID:'+ transaction_id_string);

      });

      // set the event work with the orderer work so they may be run at the same time
      promises.push(txPromise);

      // console.log('[cliente-blockchain-bo] Enviando transacción endorsada al orderer');
      const results = await Promise.all(promises);

      // console.log('resultado promesas:::::', results);

      let message;
      // segun pruebas retorna [ { status: '...', info: '' }, { event_status: '...' } ]

      if (results[0].status === 'SUCCESS') {
        // console.log('[cliente-blockchain-bo] Transacción enviada al orderer exitosamente');
      } else {
        message = util.format('[cliente-blockchain-bo] Failed to order the transaction. Error code: %s', results[0].status);
        console.error(message);
        // TODO: retornar error
        terminado = false;
        resultado.finalizado = false;
        resultado.transaction_id = tx_id;
        resultado.resultado = results[0];
        resultado.error = message;
        return(resultado);
        //throw new Error(message);
      }

      // controlando resultado de la transaccion
      if (results[1] instanceof Error || results[1].event_status !== 'VALID') {
        console.error(message);
        terminado = false;
        resultado.finalizado = false;
        resultado.transaction_id = tx_id;
        resultado.resultado = results[0];
        resultado.error = message;
        return(resultado);
      } else if (results[1].event_status === 'VALID') {
        // console.log('[cliente-blockchain-bo] La transacción ha hecho commit exitósamente, se ha hecho el cambio al ledger por el peer');
        // console.log('results:::::::::::::::', results);
        terminado = true;
        resultado.finalizado = true;
        resultado.transaction_id = tx_id;
        resultado.resultado = results[1];
        resultado.error = '';
        results[1].timestamp = timestamp;
        // resultado.timestamp = timestamp;
        return(resultado);
      } else {
        message = util.format('[cliente-blockchain-bo] Transaction failed to be committed to the ledger due to : %s', results[1].event_status);
	console.error(message);
        terminado = false;
        resultado.finalizado = false;
        resultado.transaction_id = tx_id;
        resultado.resultado = results[0];
        resultado.error = message;
        return(resultado);
      }

    } catch (e) {
      console.error('[cliente-blockchain-bo] No se pudo escribir registro', e);
      return {
        resultado:  {
          transaction_id: tx_id,
          finalizado: false
        }
      };
    }
  };

  /**
   * Escribe en la blockchain usando la biblioteca fabric-network
   * @param {Object} argumentos
   * {
   *   chaincode: 'nombre del chaincode' (opcional)
   *   fcn: 'nombre de la funcion fcn'   (opcional)
   * }
   * @return {Buffer} Respuesta en bruto del chaincode
   */
  const escribirPorChaincodeFabricNetwork = async (argumentos, ...datos) => {
    let chaincode = argumentos.chaincode ? argumentos.chaincode : bo.config.chaincode.name;
    let fcn = argumentos.fcn ? argumentos.fcn : bo.config.chaincode.fcns.introducir;
    try {
      const gateway = new Gateway();
      await gateway.connect(bo.configFilePath, {
        wallet: bo.wallet,
        identity: bo.config.user,
        discovery: { enabled: true, asLocalhost: false }
      });

      const network = await gateway.getNetwork(bo.config.channel);
      let contract = network.getContract(chaincode);
      let result = await contract.submitTransaction(fcn, ...datos);
      
      // console.log('result en bruto:::::\n', result);
      // console.log('result to string::::::\n', result.toString());
      await gateway.disconnect();

      return result;
    } catch (e) {
      throw new Error(e);
    }
  };

  /**
   * Consulta si un registro existe usando fabric-network
   * @param {string} identificador
   * @return {Buffer} Respuesta en bruto del chaincode
   */
  const consultarPorChaincodeFabricNetwork = async (argumentos, identificador) => {
    let chaincode = argumentos.chaincode ? argumentos.chaincode : bo.config.chaincode.name;
    let fcn = argumentos.fcn ? argumentos.fcn : bo.config.chaincode.fcns.introducir;
    try {
      const gateway = new Gateway();
      await gateway.connect(bo.configFilePath,
                            {
                              wallet: bo.wallet,
                              identity: bo.config.user,
                              discovery: { enabled: true, asLocalhost: false }
                            }
                           );

      const network = await gateway.getNetwork(bo.config.channel);
      let contract = network.getContract(chaincode);
      let result = await contract.evaluateTransaction(fcn, identificador);
      return result;
    } catch (e) {
      throw new Error(e);
    }
  };
  
  return {
    consultarPorChainCodeFabricClient,
    escribirPorChaincodeFabricClient,
    escribirPorChaincodeFabricNetwork,
    consultarPorChaincodeFabricNetwork
  };
};
