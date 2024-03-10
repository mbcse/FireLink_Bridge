
const Web3 = require('web3');
const ethers = require('ethers')
const fs = require('fs')
const { runAddressValidity } = require('../attestation/attestRequester')

const abi = JSON.parse(fs.readFileSync('/Users/raul/_dev/HACKATHONS/OXFORD/main_repo/UniCross/CONTRACT_LISTNER/contract.json'));

let blockNumber = 5451903
const waitTime = 3 // seconds

const chainData = {
    11155111: {name:"Sepolia", exploreLink: 'https://sepolia.etherscan.io'} 
}

const runContractListner = async (ethContractAddress, flareContractAddress, ethRpcUrl, flareRpcUrl ) => {
  
    const ethWeb3 = new Web3(ethRpcUrl)
    // const contract = new ethWeb3.eth.Contract(abi, ethContractAddress)
    const chainId = await ethWeb3.eth.getChainId()
    console.log(`Contract Listner Started for contract ${ethContractAddress} on chain ${chainId}`)
    blockNumber = await ethWeb3.eth.getBlockNumber()

    while(true){
        console.log(`Checking block ${blockNumber}`)
        const getBlock = await ethWeb3.eth.getBlock(blockNumber)
        if(getBlock !== null){
            const txs = getBlock.transactions
            checkTransactions(txs, ethWeb3, ethContractAddress, flareContractAddress, flareRpcUrl);
            blockNumber++
            console.log(`Waiting for ${waitTime} seconds`)
        } else {
            await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        }
    }
}

async function checkTransactions (txs, ethWeb3, ethContractAddress, flareContractAddress, flareRpcUrl) {
    const inputs = [
        {
            "indexed": true,
            "internalType": "address",
            "name": "from",
            "type": "address"
        },
        {
            "indexed": true,
            "internalType": "address",
            "name": "to",
            "type": "address"
        },
        {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
        },
        {
            "indexed": false,
            "internalType": "bytes",
            "name": "extraData",
            "type": "bytes"
        }
    ]

    for(let i = 0; i < txs.length; i++){
        const tx = await ethWeb3.eth.getTransaction(txs[i])
        if(tx.to === ethContractAddress){
            const txReceipt = await ethWeb3.eth.getTransactionReceipt(txs[i])
            txReceipt.logs.forEach(async (log) => {

                try{
                // const decodedEventDataForRouter = await decodeEventData(abi, { data: log.data, topics: log.topics })
                // decodedEventDataForRouter.eventName === 'Swapped'
            //    console.log(decodedEventDataForRouter)
                const proof = await runAddressValidity('eth', tx.hash);
                console.log("response body ", proof.data.responseBody);
                console.log("response body events", proof.data.responseBody.events[0]);
                console.log("sourceId ", proof.data.sourceId);
                console.log("proof ", proof.data.responseBody);
                console.log("merkle proof ", proof.data.merkleProof);
                const flareWeb3 = new Web3(flareRpcUrl);
                const flareContract = new flareWeb3.eth.Contract(abi, flareContractAddress);
                const ctx = await flareContract.methods.FinalizeBridgeAndReleaseEth(proof);
                console.log(ctx)
                }catch(err){
                    console.log(err.message)
            
                }
            });
            console.log(`Transaction ${tx.hash} is sent to contract ${ethContractAddress}`)
            if(txReceipt.status){
            }else{
                console.log(`Transaction ${tx.hash} is failed`)
            }
        }
    }
}

const decodeEventData = async (abi, event) => {
    const iface = new ethers.utils.Interface(abi)
    const eventData = iface.parseLog(event)
    const parsed = await parseEtherjsLog(eventData)
    return { eventName: eventData.name, ...parsed }
  }
  
  const parseEtherjsLog = async (parsed) => {
    const parsedEvent = {}
    for (let i = 0; i < parsed.args.length; i++) {
      const input = parsed.eventFragment.inputs[i]
      let arg = parsed.args[i]
      if (typeof arg === 'object' && arg._isBigNumber) {
        arg = arg.toString()
      }
      parsedEvent[input.name] = arg
    }
    return parsedEvent
  }
  
  

module.exports = {
    runContractListner
}


