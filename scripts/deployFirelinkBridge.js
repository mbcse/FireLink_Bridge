const { artifacts, ethers, upgrades } = require('hardhat')
const getNamedSigners = require('../utils/getNamedSigners')
const saveToConfig = require('../utils/saveToConfig')
const readFromConfig = require('../utils/readFromConfig')
const deploySettings = require('./deploySettings')

async function main () {

  const chainId = await hre.getChainId()
  console.log("STARTING FIRELINK BRIDGE DEPLOYMENT ON ", chainId)

  const CHAIN_NAME = deploySettings[chainId].CHAIN_NAME

  const initialOwner = "0x8137147256EF84caea5322C4A9BE7209f0709dd7"
  const relayer = "0x0000000000000000000000000000000000000000"
  const otherBridge = "0x0000000000000000000000000000000000000000"

  console.log('Deploying Firelink Bridge Smart Contract')
  const {payDeployer} =  await getNamedSigners();
  console.log('Deploying using Owner Address: ', payDeployer.address)

  const Firelink_Bridge_Contract = await ethers.getContractFactory('FirelinkBridge')
  Firelink_Bridge_Contract.connect(payDeployer)

  const FirelinkBridgeABI = (await artifacts.readArtifact('FirelinkBridge')).abi
  await saveToConfig(`FirelinkBridge`, 'ABI', FirelinkBridgeABI, chainId)

  const firelinkBridgeContract = await upgrades.deployProxy(Firelink_Bridge_Contract, [initialOwner, relayer, otherBridge], { initializer: 'initialize', kind:'uups' })
  await firelinkBridgeContract.deployed()

  await saveToConfig(`FirelinkBridge`, 'ADDRESS', firelinkBridgeContract.address, chainId)
  console.log('FirelinkBridge contract deployed to:', firelinkBridgeContract.address, ` on ${CHAIN_NAME}`)

  console.log('Verifying FirelinkBridge Contract...')
  try {
    const currentImplAddress = await upgrades.erc1967.getImplementationAddress(firelinkBridgeContract.address)
    console.log('current implementation address: ', currentImplAddress)
    await run('verify:verify', {
      address: currentImplAddress,
      contract: 'contracts/FirelinkBridge.sol:FirelinkBridge', // Filename.sol:ClassName
      constructorArguments: [],
      network: deploySettings[chainId].NETWORK_NAME
    })
  } catch (error) {
    console.log(error)
  }

}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
