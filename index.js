'use strict';
/**
 * @fileOverview Biblioteca de interccion con el registro de orden cronológico y temporalidad Boliviano.
 * @name index.js
 * @author Rodrigo Garcia <rgarcia@agetic.gob.bo> (2019)
 * @license LPG-Bolivia
 */

//var Fabric_Client = require('fabric-client');
const { FileSystemWallet, Gateway } = require('fabric-network');

const Fabric_Client = require('fabric-client');

var path = require('path');
var util = require('util');
var fs = require('fs');
var os = require('os');
const yaml = require('js-yaml');

/**
 * Carga archivos de configuraciones y parametros
 * @param{string} configFile: Archivo de configuracion principal, se espera el formato indicado en el README.md
 * 
 */
const iniciar = async (configFile) => {
  let { config, wallet, gateway, network, contract, fabricNetworkErrors } = await iniciarFabricNetwork(configFile);
  var { fabric_client, channel, fabricClientErrors } = await iniciarFabricClient(config);
  
  // propiedades para el cliente blockchain
  // const boConfig = config;
  const boWallet = wallet;
  const boGateway = gateway;
  const boNetwork = network;
  const boContract = contract;

  // retornando objeto blockchain
  let bo = {
    config: config,
    // para fabric-network
    configFilePath: configFile,
    wallet: boWallet,
    gateway: boGateway,
    network: boNetwork,
    contract: boContract,
    // para fabric-client
    fabric_client,
    channel
  };

  const operaciones = require('./lib/operaciones')(bo);
  return {
    configFilePath: configFile,
    config: config,
    errors: fabricClientErrors,
    iniciado: true,
    // funciones
    escribirRegistro: operaciones.escribirRegistro,
    consultarRegistro: operaciones.consultarRegistro,
    escribirRegistroFabricNetwork: operaciones.escribirRegistroFabricNetwork,
    consultarRegistroFabricNetwork: operaciones.consultarRegistroFabricNetwork,
    consultarDetallesTransaccion: operaciones.consultarDetallesTransaccion,
    escribirRegistroDevolverDetalles: operaciones.escribirRegistroDevolverDetalles
  };
};

/**
 * Inicializa interpretando el archivo de configuracion (tipicamente config.yaml) y usando fabric-network
 * @param{string} configFile: Archivo de configuracion principal (ver config.sample.yaml)
 * @return{Object}:
  return {
    errors,           // [] en caso de que no hayan errores
    finalizado: true, //<false> en caso de error
    config,           
    wallet,
    gateway,
    network,
    contract
  };
*/
const iniciarFabricNetwork = async (configFile) => {
  let checkArchivoConfig = verificarArchivoConfig(configFile);
  if (checkArchivoConfig.finalizado == false) {
    return checkArchivoConfig;
  }
  let config = checkArchivoConfig.config;
  // const ccpPath = path.resolve(__dirname, 'connection-org1.yaml');
  let errors = [];

  let wallet;
  try {
    // Create a new file system based wallet for managing identities.
    // walletPath = path.join(process.cwd(), config.walletPath);
    wallet = new FileSystemWallet(config.walletPath);
    // console.log('wallet:::::::::::', wallet);
  } catch (e) {
    console.log(`error buscando directorio wallet ${config.walletPath}: ${e}`);
    errors.push(`error buscando directorio wallet ${config.walletPath}: ${e}`);
  }

  let userExists;
  try {
    // Check to see if we've already enrolled the user.
    userExists = await wallet.exists(config.user);
    // console.log('User exists::::', userExists);
    if (!userExists) {
      console.log(`La identidad del usuario ${config.user} no existe en el wallet`);
      console.log('Ejecute la aplicación registerUser.js antes de volver a intentar');
    }
  } catch (e) {
    console.error(`Error cargando usuario ${config.user}: ${e}`);
    errors.push(`Error cargando usuario ${config.user} ${e}`);
  }

  let gateway;
  try {
    // Create a new gateway for connecting to our peer node.
    gateway = new Gateway();
    // await gateway.connect(config, { wallet, identity: config.user, discovery: { enabled: true, asLocalhost: false } });
    let ccpPath = path.resolve(configFile);
    await gateway.connect(ccpPath,
                          {
                            wallet,
                            identity: config.user,
                            discovery:
                            {
                              enabled: true,
                              asLocalhost: false
                            }
                          }
                         );
    // console.log('Gateway::::::::::', gateway);
  } catch (e) {
    console.error(`Error cargando gateway: ${e}`);
    errors.push(`Error cargando gateway ${e}`);
  }

  let network;
  try {
    // Get the network (channel) our contract is deployed to.
    network = await gateway.getNetwork(config.channel);
  } catch (e) {
    console.error(`Error cargando network: ${e}`);
    errors.push(`Error cargando el network`);
  }
  
  
  let contract;
  try {
    // Get the contract from the network.
    contract = network.getContract(config.chaincode.name);
  } catch (e) {
    console.error(`Error obteniendo el contrato: ${e}`);
    errors.push(`Error obteniendo el contrato: ${e}`);
  }

  if (errors.length > 0) {
    return {
      errors,
      finalizado: false
    };
  }

  return {
    fabricNetworkErrors: errors,
    finalizado: true,
    config,
    wallet,
    gateway,
    network,
    contract
  };
};

/**
 * Inicializa usando fabric-client
 * @param {object} config: Objeto con los datos del archivo de configuracion
 * @return {Object}: {
     fabric_client,
     channel,
     fabricClientErrors: errors
 * }
 */
const iniciarFabricClient = async (config) => {
  let errors = [];

  // canal
  var fabric_client = new Fabric_Client();
  var channel = fabric_client.newChannel(config.channel);

  // cargando datos de peers
  try {
    let peers = Object.keys(config.peers);
    peers.forEach(peer => {
      let peerConfig = config.peers[peer];
      // console.log('[cliente-blockchain-bo] agregando peer:\n', peer, '\n', peerConfig);
      let tlscaCertsPath = peerConfig['tlsCACerts']['path'];
      let orgtlscacert = fs.readFileSync(tlscaCertsPath, 'utf8');
      let peerData = fabric_client
            .newPeer(peerConfig.url,
                     {
                       //pem: Buffer.from(tlscaCertsPath, 'utf8'),
                       pem: orgtlscacert,
                       'ssl-target-name-override': peerConfig.grpcOptions['ssl-target-name-override']
                       // 'request-timeout': 40000
                     }
                    );
      channel.addPeer(peerData);
      // console.log('[cliente-blockchain-bo] agregado peer:', peerData);
    });
  } catch (e) {
    console.error('[cliente-blockchain-bo] Error cargando peers:', e);
  }
  
  // credenciales de usuario
  try {
    const store_path = path.join(config.hfcKeyStorePath);
    const state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
    fabric_client.setStateStore(state_store);

    const crypto_suite = Fabric_Client.newCryptoSuite();
    const crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path });
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);

    // cargando usuario
    try {
      const user = await fabric_client.getUserContext(config.user, true);
      if (user && user.isEnrolled()) {
        // console.log('usuario enrolado cargado', user);
      } else {
        console.error('Error cargando usuario enrolado', config.user);
        // retornar error
        // ..
      }
    } catch (e) {
      console.error('[cliente-blockchain-bo] Error cargando usuario enrolado:', e);
      // retornar error
      // ..
    }
  } catch (e) {
    console.error('[cliente-blockchain-bo] Error cargando de credenciales de usuario', e);
    // retornar error
    // ..
  }

  // inicializando el canal mediante servicio 'discovery'
  await channel.initialize({ discover: true });

  // console.log('*** Channel peers:', channel._channel_peers);
  // console.log('--------------------------');
  // for (let peerData of channel._channel_peers) {
  //   console.log('IIIIII peerObject:', peerData);
  // }
  
  //console.log('Channel_options', Object.keys(channel));
  // console.log('>>>>>>>>>>', channel._channels.get('_orderers'));
  // cargando datos de orderes
  // try {
  //   let orderers = Object.keys(config.orderers);
  //   orderers.forEach(orderer => {
  //     let ordererConfig = config.orderers[orderer];
  //     console.log('orderer:', orderer, '\n', ordererConfig);
  //     // let tlsca
  //   });
  // } catch (e) {
  //   console.log('[cliente-blockchain-bo] Error cargando orederers:', e);
  // }

  return {
    fabric_client,
    channel,
    fabricClientErrors: errors
  };
  
};

/**
 * Verifica estructura correcta del archivo de configuracion
 */
const verificarArchivoConfig = (configFile) => {
  let config;
  try {
    config = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
    // console.log('config::::::::', config);
  } catch (e) {
    console.log('Error leyendo el archivo', e);
    return {
      error: `Error leyendo el archivo ${configFile}`,
      finalizado: false
    };
  }

  // const config = require(configFile);
  let errors = [];

  // console.log('Contenido del archivo:::', config, '))))', typeof config);
  try {
    Object.keys(config.peers).forEach(p => {
      let peer = config.peers[p];
      if (!fs.existsSync(peer.tlsCACerts)) {
        return {
          error: `No se encuentra el archivo ${peer.tlsCACerts}`,
          finalizado: false
        };
      }
    });
  } catch (e) {
    console.log('Error buscando peers:', e);
    return {
      error: `Error buscando peers ${config.certificateAuthorities}: ${e}`,
      finalizado: false
    };
  }

  console.log('comprobando certificate authorities');
  try {
    Object.keys(config.certificateAuthorities).forEach(o => {
      let ca = config.certificateAuthorities[o];
      if (!fs.existsSync(ca.tlsCACerts.path)) {
        errors.push(`Error al buscar CertificateAuthorities ${ca.tlsCACerts.path}`);
      }
    });
  } catch (e) {
    console.log('CertificateAuthorities error >>>', e);
    console.log(config.certificateAuthorities);
    return {
      error: `Error al buscar CA ${config.certificateAuthorities}: ${e}`,
      finalizado: false
    };
  }

  if (errors.length > 0) {
    return {
      error: 'Errores encontrados: ' + JSON.stringify(errors),
      finalizado: false
    };
  }
  return {
    finalizado: true,
    config
  };
};

module.exports = {
  iniciar: iniciar
};
